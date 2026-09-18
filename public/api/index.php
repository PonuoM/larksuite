<?php
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('Referrer-Policy: no-referrer');
require dirname(__DIR__,2).'/api/bootstrap.php';
try {
 $method=$_SERVER['REQUEST_METHOD'];
 $path=parse_url($_SERVER['REQUEST_URI'],PHP_URL_PATH);
 $prefix=rtrim(config()['APP_BASE'],'/').'/api/v1';
 $route=substr($path,strlen($prefix));
 if ($route==='/session' && $method==='GET') {$u=sessionUser();reply(200,'พร้อมใช้งาน',$u?['user'=>publicUser($u),'csrf'=>$u['csrf_token']]:['user'=>null]);}
 if ($route==='/redeem' && $method==='POST') {
    checkOrigin();
    $bucket=hash('sha256',clientIp().':'.gmdate('Y-m-d-H').':'.floor((int)gmdate('i')/10));
    query('INSERT INTO rate_limits(bucket,attempts,expires_at) VALUES(?,1,DATE_ADD(UTC_TIMESTAMP(),INTERVAL 20 MINUTE)) ON DUPLICATE KEY UPDATE attempts=attempts+1',[$bucket]);
    if ((int)query('SELECT attempts FROM rate_limits WHERE bucket=?',[$bucket])->fetchColumn()>30) reply(429,'ลองหลายครั้งเกินไป กรุณารอ 10 นาที');
    $data=body();$token=$data['token']??'';
    if(!is_string($token)||!preg_match('/^[a-f0-9]{64}$/',$token))reply(401,'ลิงก์ไม่ถูกต้องหรือหมดอายุ');
    db()->beginTransaction();
    $invite=query('SELECT i.*,p.revoked_at AS principal_revoked FROM invitations i JOIN principals p ON p.id=i.principal_id WHERE token_hash=? FOR UPDATE',[hash('sha256',$token)])->fetch();
    $reusable=$invite&&(int)$invite['reusable']===1;
    if(!$invite||(!$reusable&&$invite['consumed_at'])||$invite['revoked_at']||$invite['principal_revoked']||($invite['expires_at']!==null&&strtotime($invite['expires_at'])<=time())){db()->rollBack();reply(401,'ลิงก์ถูกใช้แล้ว หมดอายุ หรือถูกปิด กรุณาขอลิงก์ใหม่');}
    query($reusable?'UPDATE invitations SET last_used_at=UTC_TIMESTAMP() WHERE id=?':'UPDATE invitations SET consumed_at=UTC_TIMESTAMP(),last_used_at=UTC_TIMESTAMP() WHERE id=?',[$invite['id']]);
    $sid=bin2hex(random_bytes(32));$csrf=bin2hex(random_bytes(32));
    query('INSERT INTO access_sessions(token_hash,principal_id,invitation_id,csrf_token,expires_at) VALUES(?,?,?,?,DATE_ADD(UTC_TIMESTAMP(),INTERVAL 7 DAY))',[hash('sha256',$sid),$invite['principal_id'],$invite['id'],$csrf]);
    db()->commit();cookieToken($sid,time()+604800);reply(200,'เข้าใช้งานแล้ว');
 }
 $u=requireUser();if ($method!=='GET') requireCsrf($u);
 require dirname(__DIR__,2).'/api/meetings.php';
 require dirname(__DIR__,2).'/api/task-updates.php';
 meetingRoutes($route,$method,$u);
 taskUpdateRoutes($route,$method,$u);
 if ($route==='/logout'&&$method==='POST'){query('DELETE FROM access_sessions WHERE token_hash=?',[$u['token_hash']]);cookieToken('',time()-3600);reply(200,'ออกจากระบบแล้ว');}
 if ($route==='/projects'&&$method==='GET') {
    $rows=$u['is_admin']?query("SELECT id,name,description,'admin' AS role FROM projects ORDER BY id")->fetchAll():query('SELECT p.id,p.name,p.description,m.role FROM projects p JOIN memberships m ON p.id=m.project_id WHERE m.principal_id=? ORDER BY p.id',[$u['id']])->fetchAll();
    reply(200,'โปรเจกต์',$rows);
 }
 if ($route==='/projects'&&$method==='POST') {requireAdmin($u);$d=body();query('INSERT INTO projects(name,description) VALUES(?,?)',[textField($d,'name',120,true),textField($d,'description',2000)]);reply(201,'สร้างโปรเจกต์แล้ว',['id'=>(int)db()->lastInsertId()]);}
 if ($route==='/access'&&$method==='GET') {
    requireAdmin($u);$members=[];
    foreach(query('SELECT id,label,is_admin,can_approve,revoked_at,created_at FROM principals ORDER BY id DESC')->fetchAll() as $p)$members[(int)$p['id']]=['id'=>(int)$p['id'],'label'=>$p['label'],'is_admin'=>(bool)$p['is_admin'],'can_approve'=>(bool)$p['can_approve'],'revoked_at'=>$p['revoked_at'],'created_at'=>$p['created_at'],'projects'=>[],'links'=>[]];
    foreach(query('SELECT m.principal_id,m.project_id,m.role,pr.name AS project_name FROM memberships m JOIN projects pr ON pr.id=m.project_id ORDER BY pr.id')->fetchAll() as $m)if(isset($members[(int)$m['principal_id']]))$members[(int)$m['principal_id']]['projects'][]=['project_id'=>(int)$m['project_id'],'project_name'=>$m['project_name'],'role'=>$m['role']];
    foreach(query('SELECT id,principal_id,reusable,token_cipher IS NOT NULL AS viewable,expires_at,consumed_at,last_used_at,revoked_at,created_at FROM invitations ORDER BY id DESC')->fetchAll() as $i)if(isset($members[(int)$i['principal_id']]))$members[(int)$i['principal_id']]['links'][]=['id'=>(int)$i['id'],'reusable'=>(bool)$i['reusable'],'viewable'=>(bool)$i['viewable']&&(bool)$i['reusable']&&!$i['revoked_at'],'expires_at'=>$i['expires_at'],'consumed_at'=>$i['consumed_at'],'last_used_at'=>$i['last_used_at'],'revoked_at'=>$i['revoked_at'],'created_at'=>$i['created_at'],'current'=>(int)$i['id']===(int)$u['invitation_id']];
    reply(200,'สิทธิ์การเข้าถึง',array_values($members));
 }
 if(preg_match('~^/access/links/(\d+)/url$~',$route,$m)&&$method==='GET') {
    requireAdmin($u);
    $i=query('SELECT token_cipher FROM invitations WHERE id=? AND reusable=1 AND revoked_at IS NULL',[(int)$m[1]])->fetch();
    $token=$i?openToken($i['token_cipher']):null;
    if(!$token)reply(404,'ลิงก์นี้เปิดดูย้อนหลังไม่ได้ (สร้างก่อนเปิดระบบเก็บลิงก์ หรือถูกปิดแล้ว) ให้สร้างลิงก์ถาวรใหม่แทน');
    reply(200,'ลิงก์ถาวร',['link'=>linkUrl($token)]);
 }
 if(preg_match('~^/access/links/(\d+)/close$~',$route,$m)&&$method==='POST') {
    requireAdmin($u);$id=(int)$m[1];
    if($id===(int)$u['invitation_id'])reply(422,'ปิดลิงก์ที่คุณใช้เข้าอยู่ตอนนี้ไม่ได้ ให้สร้างลิงก์ใหม่และเข้าผ่านลิงก์ใหม่ก่อน');
    db()->beginTransaction();
    if(query('UPDATE invitations SET revoked_at=UTC_TIMESTAMP() WHERE id=? AND revoked_at IS NULL',[$id])->rowCount()!==1){db()->rollBack();reply(404,'ไม่พบลิงก์ที่ยังเปิดอยู่');}
    query('DELETE FROM access_sessions WHERE invitation_id=?',[$id]);db()->commit();reply(200,'ปิดลิงก์แล้ว เครื่องที่เข้าผ่านลิงก์นี้ออกจากระบบทั้งหมด');
 }
 if(preg_match('~^/access/(\d+)/links$~',$route,$m)&&$method==='POST') {
    requireAdmin($u);$pid=(int)$m[1];$d=body();
    if(!query('SELECT id FROM principals WHERE id=? AND revoked_at IS NULL',[$pid])->fetch())reply(404,'ไม่พบสมาชิกที่ยังใช้งานได้');
    $permanent=($d['permanent']??false)===true;
    reply(201,$permanent?'ลิงก์ถาวร ใช้ซ้ำได้จนกว่าจะปิด':'ลิงก์นี้ใช้ได้หนึ่งครั้ง ภายใน 7 วัน',['id'=>$pid,'link'=>issueLink($pid,$permanent),'permanent'=>$permanent]);
 }
 if ($route==='/access'&&$method==='POST') {
    requireAdmin($u);$d=body();$label=textField($d,'label',120,true);$role=$d['role']??'';$project=(int)($d['project_id']??0);$permanent=($d['permanent']??false)===true;
    if(!in_array($role,['admin','editor','viewer'],true))reply(422,'สิทธิ์ไม่ถูกต้อง');
    $projects=[];
    if($role!=='admin') {
       $ids=$d['project_ids']??[$project];
       if(!is_array($ids)||!count($ids)||count($ids)>500)reply(422,'กรุณาเลือกอย่างน้อยหนึ่งโปรเจกต์');
       foreach($ids as $id) {
          if(!is_int($id)||$id<1)reply(422,'โปรเจกต์ไม่ถูกต้อง');
          roleFor($u,$id);$projects[$id]=$id;
       }
    }
    db()->beginTransaction();
    query('INSERT INTO principals(label,is_admin) VALUES(?,?)',[$label,$role==='admin'?1:0]);$pid=(int)db()->lastInsertId();
    foreach($projects as $projectId)query('INSERT INTO memberships(principal_id,project_id,role) VALUES(?,?,?)',[$pid,$projectId,$role]);
    $link=issueLink($pid,$permanent);
    db()->commit();reply(201,$permanent?'ลิงก์ถาวร ใช้ซ้ำได้จนกว่าจะปิด':'ลิงก์นี้ใช้ได้หนึ่งครั้ง ภายใน 7 วัน',['id'=>$pid,'link'=>$link,'permanent'=>$permanent]);
 }
 if(preg_match('~^/access/(\d+)/approver$~',$route,$m)&&$method==='POST') {
    requireAdmin($u);$d=body();if(!is_bool($d['can_approve']??null))reply(422,'ต้องระบุ can_approve เป็น true/false');
    if(query('UPDATE principals SET can_approve=? WHERE id=? AND revoked_at IS NULL',[$d['can_approve']?1:0,(int)$m[1]])->rowCount()!==1&&!query('SELECT id FROM principals WHERE id=? AND revoked_at IS NULL',[(int)$m[1]])->fetch())reply(404,'ไม่พบสมาชิกที่ยังใช้งานได้');
    reply(200,$d['can_approve']?'ให้สิทธิ์ผู้อนุมัติแล้ว':'ยกเลิกสิทธิ์ผู้อนุมัติแล้ว',['id'=>(int)$m[1],'can_approve'=>$d['can_approve']]);
 }
 if(preg_match('~^/access/(\d+)/revoke$~',$route,$m)&&$method==='POST') {
    requireAdmin($u);$id=(int)$m[1];if($id===(int)$u['id'])reply(422,'ยกเลิกสิทธิ์ของตัวเองไม่ได้');
    db()->beginTransaction();query('UPDATE principals SET revoked_at=UTC_TIMESTAMP() WHERE id=?',[$id]);query('UPDATE invitations SET revoked_at=UTC_TIMESTAMP() WHERE principal_id=?',[$id]);query('DELETE FROM access_sessions WHERE principal_id=?',[$id]);db()->commit();reply(200,'ยกเลิกทั้งลิงก์และ session แล้ว');
 }
 if(preg_match('~^/projects/(\d+)/tasks$~',$route,$m)) {
    $project=(int)$m[1];$role=roleFor($u,$project);
    if($method==='GET') {
       $cursor=max(0,(int)($_GET['cursor']??0));
       $rows=query('SELECT * FROM tasks WHERE project_id=? AND archived=0 AND id>? ORDER BY id LIMIT 101',[$project,$cursor])->fetchAll();$more=count($rows)>100;if($more)array_pop($rows);
       reply(200,'งาน',['items'=>array_map(function($t)use($role){return taskDto($t,$role);},$rows),'next_cursor'=>$more?(int)end($rows)['id']:null]);
    }
    if($method==='POST') {
       editable($role);$data=body();$target=notifyTarget($data);$d=taskData($data);db()->beginTransaction();
       query('INSERT INTO tasks(project_id,title,feature,public_summary,scope,criteria,evidence,assignee,blocked_reason,checklist,status,planned_go_live_on,actual_released_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)',[$project,$d['title'],$d['feature'],$d['public_summary'],$d['scope'],$d['criteria'],$d['evidence'],$d['assignee'],$d['blocked_reason'],$d['checklist'],$d['status'],$d['planned_go_live_on'],$d['status']===4?gmdate('Y-m-d H:i:s'):null]);
       $id=(int)db()->lastInsertId();event($id,$u,'created',['status'=>$d['status'],'deadline'=>$d['planned_go_live_on']]);$saved=query('SELECT * FROM tasks WHERE id=?',[$id])->fetch();db()->commit();
       $warning=notifyAfterCommit($target,$saved,$u,'งานใหม่'.($d['public_summary']!==''?': '.$d['public_summary']:''));reply(201,$warning??'สร้างงานแล้ว',withLarkWarning(taskDto($saved,$role),$warning));
    }
 }
 if(preg_match('~^/tasks/(\d+)(/events)?$~',$route,$m)) {
    $id=(int)$m[1];$t=query('SELECT * FROM tasks WHERE id=? AND archived=0',[$id])->fetch();if(!$t)reply(404,'ไม่พบงาน');$role=roleFor($u,(int)$t['project_id']);
    if(!empty($m[2])) {editable($role);if($method!=='GET')reply(405,'วิธีเรียกไม่ถูกต้อง');$cursor=max(0,(int)($_GET['before']??PHP_INT_MAX));reply(200,'ประวัติ',query('SELECT e.id,e.action,e.payload,e.created_at,p.label AS actor FROM task_events e JOIN principals p ON p.id=e.principal_id WHERE e.task_id=? AND e.id<? ORDER BY e.id DESC LIMIT 50',[$id,$cursor])->fetchAll());}
    if($method==='GET')reply(200,'รายละเอียด',taskDto($t,$role));
    if($method==='PATCH'||$method==='DELETE') {
       editable($role);$data=body();if(!isset($data['version'])||!is_int($data['version']))reply(422,'ต้องระบุ version');
       $target=notifyTarget($data);$d=$method==='PATCH'?taskData($data):null;
       // A task waiting for approval only moves on to release through POST /tasks/{id}/approve.
       if($d&&(int)$t['status']===STATUS_AWAITING_APPROVAL&&in_array($d['status'],[3,4],true))reply(403,'งานนี้รออนุมัติ ต้องให้ผู้อนุมัติกด "อนุมัติ" ก่อน');
       db()->beginTransaction();
       if($method==='DELETE')$stmt=query('UPDATE tasks SET archived=1,version=version+1,updated_at=UTC_TIMESTAMP() WHERE id=? AND version=? AND archived=0',[$id,$data['version']]);
       else $stmt=query('UPDATE tasks SET title=?,feature=?,public_summary=?,scope=?,criteria=?,evidence=?,assignee=?,blocked_reason=?,checklist=?,status=?,planned_go_live_on=?,actual_released_at=?,version=version+1,updated_at=UTC_TIMESTAMP() WHERE id=? AND version=? AND archived=0',[$d['title'],$d['feature'],$d['public_summary'],$d['scope'],$d['criteria'],$d['evidence'],$d['assignee'],$d['blocked_reason'],$d['checklist'],$d['status'],$d['planned_go_live_on'],$d['status']===4?($t['actual_released_at']?:gmdate('Y-m-d H:i:s')):null,$id,$data['version']]);
       if($stmt->rowCount()!==1){db()->rollBack();reply(409,'มีคนแก้งานนี้แล้ว กรุณาโหลดข้อมูลล่าสุดก่อนบันทึก');}
       if($d&&$d['status']===STATUS_AWAITING_APPROVAL&&(int)$t['status']!==STATUS_AWAITING_APPROVAL)query('UPDATE tasks SET approved_by=NULL,approved_at=NULL WHERE id=?',[$id]);
       $changes=[];if($d)foreach($d as $key=>$value)if((string)$t[$key]!== (string)$value)$changes[$key]=['from'=>$t[$key],'to'=>$value];
       event($id,$u,$method==='DELETE'?'archived':'updated',$changes);$saved=query('SELECT * FROM tasks WHERE id=?',[$id])->fetch();db()->commit();
       $warning=$d?notifyAfterCommit($target,$saved,$u,changeHeadline($changes,$data['notify_text']??'')):null;reply(200,$warning??'บันทึกแล้ว',withLarkWarning(taskDto($saved,$role),$warning));
    }
 }
 reply(404,'ไม่พบรายการที่ร้องขอ');
} catch(Throwable $e) {try {if(db()->inTransaction())db()->rollBack();} catch(Throwable $ignored) {} error_log('Workboard: '.$e->getMessage());reply(500,'ระบบไม่สามารถทำรายการได้ กรุณาลองใหม่');}
