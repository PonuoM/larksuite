<?php
// One-off import of the team board kept in Lark Base (CRM_ERP_V4 repo: .claude/skills/lark-base-update/backup/)
// into Workboard. Dry run unless --apply.
//
//   php scripts/import-lark-base.php <backup dir>            show what would be created
//   php scripts/import-lark-base.php <backup dir> --apply    write it
//
// Why a script and not the API: the API stamps actual_released_at with "now" when a task is created as
// released, which would date ~80 already-live tasks to the import day. The script reuses taskData() for
// validation, writes each task in its own transaction with an `imported` history event, and skips tasks
// that already exist (same project + title), so re-running it is safe.
//
// Mapping: Lark project -> projects.name · feature -> tasks.feature · sub-task -> task.
//   status: รอทำ/รอ CEO อนุมัติ/รอดำเนินการ -> 0 · กำลังดำเนินการ -> 1 · รอเปิดใช้งาน -> 3 · เปิดใช้งาน -> 4
//           ยกเลิก/พักไว้ -> skipped
//   planned_go_live_on: null (the Lark board never had one — migration 004)
//   actual_released_at: the card's live_date (Bangkok time) when known, else null
declare(strict_types=1);
if (PHP_SAPI !== 'cli') exit(1);
require dirname(__DIR__) . '/api/bootstrap.php';

$dir = $argv[1] ?? '';
$apply = in_array('--apply', $argv, true);
if ($dir === '' || !is_dir($dir)) {fwrite(STDERR, "usage: php scripts/import-lark-base.php <backup dir> [--apply]\n"); exit(2);}

const STATUS = ['รอทำ' => 0, 'รอ CEO อนุมัติ' => 0, 'รอดำเนินการ' => 0, 'กำลังดำเนินการ' => 1, 'รอเปิดใช้งาน' => 3, 'เปิดใช้งาน' => 4];
const IMPORTER = 'นำเข้าจาก Lark Base';

function releasedUtc(?string $bangkok): ?string {
    if (!$bangkok) return null;
    $d = new DateTime($bangkok, new DateTimeZone('Asia/Bangkok'));
    return $d->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d H:i:s');
}

function evidenceText(array $row): string {
    $lines = ['นำเข้าจาก Lark Base เมื่อ ' . date('Y-m-d') . ' (record ' . $row['record_id'] . ')'];
    if (!empty($row['evidence'])) $lines[] = 'หลักฐานเดิม: ' . $row['evidence'];
    if (!empty($row['match'])) $lines[] = 'จับคู่ git: ' . implode(' · ', $row['match']);
    if (($row['status'] ?? '') === 'เปิดใช้งาน' && empty($row['live_date'])) $lines[] = 'วันที่ปล่อยจริงไม่ทราบ (ตรวจแล้วว่าใช้งานได้ ตามหลักฐานเดิม)';
    return implode("\n", $lines);
}

// ---- read the backup: one file per project, feature -> sub-tasks
$plan = [];
foreach (glob(rtrim($dir, '/\\') . '/*.json') as $file) {
    $data = json_decode((string) file_get_contents($file), true);
    if (!isset($data['features'])) continue;
    foreach ($data['features'] as $f) {
        $rows = $f['subtasks'] ?: [array_merge($f, ['subtasks' => []])]; // a feature with no sub-tasks is its own task
        foreach ($rows as $s) {
            if (!isset(STATUS[$s['status']])) {echo "skip (status {$s['status']}): {$s['name']}\n"; continue;}
            $plan[] = ['project' => $s['project'] ?? $data['project'], 'feature' => $f['name'], 'row' => $s];
        }
    }
}

$projects = [];
foreach (query('SELECT id,name FROM projects')->fetchAll() as $p) $projects[$p['name']] = (int) $p['id'];
$existing = [];
foreach (query('SELECT project_id,title FROM tasks WHERE archived=0')->fetchAll() as $t) $existing[$t['project_id'] . "\n" . $t['title']] = true;

$counts = ['create' => 0, 'exists' => 0, 'projects' => 0];
foreach (array_unique(array_column($plan, 'project')) as $name) if (!isset($projects[$name])) {
    $counts['projects']++;
    echo "project  + {$name}\n";
    if ($apply) {query('INSERT INTO projects(name,description) VALUES(?,?)', [$name, '']); $projects[$name] = (int) db()->lastInsertId();}
}

$importer = null;
if ($apply) {
    $importer = query('SELECT id FROM principals WHERE label=? LIMIT 1', [IMPORTER])->fetchColumn();
    if (!$importer) {query('INSERT INTO principals(label,is_admin) VALUES(?,0)', [IMPORTER]); $importer = (int) db()->lastInsertId();}
    $importer = ['id' => (int) $importer];
}

foreach ($plan as $item) {
    $r = $item['row'];
    $pid = $projects[$item['project']] ?? 0;
    if ($pid && isset($existing[$pid . "\n" . $r['name']])) {$counts['exists']++; continue;}
    $status = STATUS[$r['status']];
    // same validation as the API (lengths, status range, optional date)
    $d = taskData(['title' => $r['name'], 'feature' => $item['feature'], 'public_summary' => (string) ($r['detail'] ?? ''),
        'scope' => '', 'criteria' => '', 'evidence' => evidenceText($r), 'assignee' => '', 'blocked_reason' => '',
        'status' => $status, 'planned_go_live_on' => null, 'checklist' => []]);
    $released = $status === 4 ? releasedUtc($r['live_date'] ?? null) : null;
    $counts['create']++;
    printf("task     + %-10s [%d] %s · %s%s\n", $item['project'], $status, $item['feature'], $r['name'], $released ? " (released {$released} UTC)" : '');
    if (!$apply) continue;
    db()->beginTransaction();
    query('INSERT INTO tasks(project_id,title,feature,public_summary,scope,criteria,evidence,assignee,blocked_reason,checklist,status,planned_go_live_on,actual_released_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)',
        [$pid, $d['title'], $d['feature'], $d['public_summary'], $d['scope'], $d['criteria'], $d['evidence'], $d['assignee'], $d['blocked_reason'], $d['checklist'], $d['status'], null, $released]);
    $id = (int) db()->lastInsertId();
    event($id, $importer, 'imported', ['source' => 'Lark Base', 'record_id' => $r['record_id'], 'status' => $r['status'], 'feature' => $item['feature']]);
    db()->commit();
    $existing[$pid . "\n" . $r['name']] = true;
}
printf("\n%s: %d project(s) new, %d task(s) %s, %d already there\n", $apply ? 'written' : 'dry run',
    $counts['projects'], $counts['create'], $apply ? 'created' : 'to create', $counts['exists']);
