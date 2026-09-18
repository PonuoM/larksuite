<?php
declare(strict_types=1);
date_default_timezone_set('UTC');
function config(): array {
    static $config;
    if ($config === null) {
        $config = parse_ini_file(dirname(__DIR__) . '/.env', false, INI_SCANNER_RAW);
        if (!$config) throw new RuntimeException('Missing application configuration');
    }
    return $config;
}
function db(): PDO {
    static $db;
    if (!$db) {
        $c = config();
        $db = new PDO('mysql:host='.$c['DB_HOST'].';dbname='.$c['DB_NAME'].';charset=utf8mb4', $c['DB_USER'], $c['DB_PASSWORD'], [PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC, PDO::ATTR_EMULATE_PREPARES=>false]);
        $db->exec("SET time_zone = '+00:00'");
    }
    return $db;
}
function query(string $sql, array $args = []): PDOStatement { $stmt=db()->prepare($sql); $stmt->execute($args); return $stmt; }
function reply(int $status, string $message, $data = null): void {
    http_response_code($status);
    echo json_encode(['ok'=>$status<400,'message'=>$message,'data'=>$data], JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES); exit;
}
function body(): array {
    if ((int)($_SERVER['CONTENT_LENGTH']??0)>100000) reply(413,'ข้อมูลยาวเกินกำหนด');
    $data=json_decode(file_get_contents('php://input'),true);
    if (!is_array($data)) reply(422,'ข้อมูล JSON ไม่ถูกต้อง');
    return $data;
}
function textField(array $data,string $key,int $max,bool $required=false): string {
    $value=$data[$key]??'';
    if (!is_string($value) || mb_strlen($value,'UTF-8')>$max || ($required && trim($value)==='')) reply(422,'ข้อมูลไม่ถูกต้อง: '.$key);
    return trim($value);
}
function cookieToken(string $value,int $expires): void {
    setcookie('workboard_session',$value,['expires'=>$expires,'path'=>rtrim(config()['APP_BASE'],'/').'/','secure'=>config()['COOKIE_SECURE']==='1','httponly'=>true,'samesite'=>'Strict']);
}
function sessionUser(): ?array {
    $token=$_COOKIE['workboard_session']??'';
    if (!preg_match('/^[a-f0-9]{64}$/',$token)) return null;
    $row=query('SELECT p.id,p.label,p.is_admin,s.csrf_token,s.token_hash,s.invitation_id FROM access_sessions s JOIN principals p ON p.id=s.principal_id LEFT JOIN invitations i ON i.id=s.invitation_id WHERE s.token_hash=? AND s.expires_at>UTC_TIMESTAMP() AND p.revoked_at IS NULL AND i.revoked_at IS NULL',[hash('sha256',$token)])->fetch();
    return $row?:null;
}
// Only the hash is stored; the full link can be shown to the admin once, at creation.
function issueLink(int $principalId,bool $permanent): string {
    $token=bin2hex(random_bytes(32));
    query($permanent?'INSERT INTO invitations(principal_id,token_hash,reusable,expires_at) VALUES(?,?,1,NULL)':'INSERT INTO invitations(principal_id,token_hash,reusable,expires_at) VALUES(?,?,0,DATE_ADD(UTC_TIMESTAMP(),INTERVAL 7 DAY))',[$principalId,hash('sha256',$token)]);
    return config()['APP_ORIGIN'].rtrim(config()['APP_BASE'],'/').'/#invite='.$token;
}
function publicUser(array $u): array {return ['id'=>(int)$u['id'],'label'=>$u['label'],'is_admin'=>(bool)$u['is_admin']];}
function requireUser(): array {$u=sessionUser();if (!$u) reply(401,'กรุณาเปิดลิงก์เชิญที่ยังใช้งานได้');return $u;}
function requireCsrf(array $u): void {
    if (!hash_equals($u['csrf_token'],$_SERVER['HTTP_X_CSRF_TOKEN']??'')) reply(403,'คำขอหมดอายุ กรุณาโหลดหน้าใหม่');
    checkOrigin();
}
function checkOrigin(): void {
    if (isset($_SERVER['HTTP_ORIGIN']) && $_SERVER['HTTP_ORIGIN']!==config()['APP_ORIGIN']) reply(403,'ไม่อนุญาตแหล่งที่มานี้');
}
// Behind the production reverse proxy (TRUST_PROXY=1) REMOTE_ADDR is the proxy; the proxy appends the real client as the last X-Forwarded-For entry.
function clientIp(): string {
    $forwarded=$_SERVER['HTTP_X_FORWARDED_FOR']??'';
    if ((config()['TRUST_PROXY']??'0')==='1' && $forwarded!=='') { $parts=explode(',',$forwarded); return trim(end($parts)); }
    return $_SERVER['REMOTE_ADDR']??'';
}
function requireAdmin(array $u): void {if (!$u['is_admin']) reply(403,'ต้องใช้สิทธิ์ผู้ดูแล');}
function roleFor(array $u,int $project): string {
    if (!query('SELECT id FROM projects WHERE id=?',[$project])->fetch()) reply(404,'ไม่พบโปรเจกต์');
    if ($u['is_admin']) return 'admin';
    $role=query('SELECT role FROM memberships WHERE principal_id=? AND project_id=?',[$u['id'],$project])->fetchColumn();
    if (!$role) reply(404,'ไม่พบโปรเจกต์');
    return $role;
}
function editable(string $role): void {if ($role==='viewer') reply(403,'ลิงก์นี้ดูข้อมูลได้อย่างเดียว');}
function taskDto(array $t,string $role): array {
    $out=['id'=>(int)$t['id'],'project_id'=>(int)$t['project_id'],'title'=>$t['title'],'public_summary'=>$t['public_summary'],'status'=>(int)$t['status'],'planned_go_live_on'=>$t['planned_go_live_on'],'actual_released_at'=>$t['actual_released_at'],'updated_at'=>$t['updated_at'],'version'=>(int)$t['version']];
    if ($role!=='viewer') foreach (['feature','scope','criteria','evidence','assignee','blocked_reason','checklist','archived'] as $key) $out[$key]=$key==='checklist'?json_decode($t[$key],true):$t[$key];
    return $out;
}
function taskData(array $data): array {
    $out=[];
    foreach (['title'=>240,'feature'=>120,'public_summary'=>6000,'scope'=>20000,'criteria'=>12000,'evidence'=>12000,'assignee'=>120,'blocked_reason'=>6000] as $key=>$max) $out[$key]=textField($data,$key,$max,$key==='title');
    $due=$data['planned_go_live_on']??'';
    $date=is_string($due)?DateTime::createFromFormat('!Y-m-d',$due):false;
    if (!$date||$date->format('Y-m-d')!==$due) reply(422,'ทุกงานต้องมีวันที่เริ่มใช้งานที่ถูกต้อง');
    $out['planned_go_live_on']=$due;
    $status=$data['status']??0;
    if (!is_int($status)||$status<0||$status>4) reply(422,'สถานะไม่ถูกต้อง');
    $out['status']=$status;
    $list=$data['checklist']??[];
    if (!is_array($list)||count($list)>50) reply(422,'เช็กลิสต์ไม่ถูกต้อง');
    $clean=[];
    foreach ($list as $item) {if(!is_array($item)||!is_bool($item['done']??null))reply(422,'เช็กลิสต์ไม่ถูกต้อง');$clean[]=['label'=>textField($item,'label',500,true),'done'=>$item['done']];}
    $out['checklist']=json_encode($clean,JSON_UNESCAPED_UNICODE);
    return $out;
}
function event(int $id,array $u,string $action,array $payload):void {query('INSERT INTO task_events(task_id,principal_id,action,payload) VALUES(?,?,?,?)',[$id,$u['id'],$action,json_encode($payload,JSON_UNESCAPED_UNICODE)]);}
