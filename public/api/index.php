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
    $bucket=hash('sha256',($_SERVER['REMOTE_ADDR']??'').':'.gmdate('Y-m-d-H').':'.floor((int)gmdate('i')/10));
    query('INSERT INTO rate_limits(bucket,attempts,expires_at) VALUES(?,1,DATE_ADD(UTC_TIMESTAMP(),INTERVAL 20 MINUTE)) ON DUPLICATE KEY UPDATE attempts=attempts+1',[$bucket]);
    if ((int)query('SELECT attempts FROM rate_limits WHERE bucket=?',[$bucket])->fetchColumn()>30) reply(429,'ลองหลายครั้งเกินไป กรุณารอ 10 นาที');
    $data=body();$token=$data['token']??'';
    if(!is_string($token)||!preg_match('/^[a-f0-9]{64}$/',$token))reply(401,'ลิงก์ไม่ถูกต้องหรือหมดอายุ');
    db()->beginTransaction();
    $invite=query('SELECT i.*,p.revoked_at AS principal_revoked FROM invitations i JOIN principals p ON p.id=i.principal_id WHERE token_hash=? FOR UPDATE',[hash('sha256',$token)])->fetch();
    if(!$invite||$invite['consumed_at']||$invite['revoked_at']||$invite['principal_revoked']||strtotime($invite['expires_at'])<=time()){db()->rollBack();reply(401,'ลิงก์ถูกใช้แล้ว หมดอายุ หรือถูกยกเลิก กรุณาขอลิงก์ใหม่');}
    query('UPDATE invitations SET consumed_at=UTC_TIMESTAMP() WHERE id=?',[$invite['id']]);
    $sid=bin2hex(random_bytes(32));$csrf=bin2hex(random_bytes(32));
    query('INSERT INTO access_sessions(token_hash,principal_id,csrf_token,expires_at) VALUES(?,?,?,DATE_ADD(UTC_TIMESTAMP(),INTERVAL 7 DAY))',[hash('sha256',$sid),$invite['principal_id'],$csrf]);
    db()->commit();cookieToken($sid,time()+604800);reply(200,'เข้าใช้งานแล้ว');
 }
 $u=requireUser();if ($method!=='GET') requireCsrf($u);
 if ($route==='/logout'&&$method==='POST'){query('DELETE FROM access_sessions WHERE token_hash=?',[$u['token_hash']]);cookieToken('',time()-3600);reply(200,'ออกจากระบบแล้ว');}
 if ($route==='/projects'&&$method==='GET') {
    $rows=$u['is_admin']?query("SELECT id,name,description,'admin' AS role FROM projects ORDER BY id")->fetchAll():query('SELECT p.id,p.name,p.description,m.role FROM projects p JOIN memberships m ON p.id=m.project_id WHERE m.principal_id=? ORDER BY p.id',[$u['id']])->fetchAll();
    reply(200,'โปรเจกต์',$rows);
 }
 if ($route==='/projects'&&$method==='POST') {requireAdmin($u);$d=body();query('INSERT INTO projects(name,description) VALUES(?,?)',[textField($d,'name',120,true),textField($d,'description',2000)]);reply(201,'สร้างโปรเจกต์แล้ว',['id'=>(int)db()->lastInsertId()]);}
 if ($route==='/access'&&$method==='GET') {requireAdmin($u);reply(200,'สิทธิ์การเข้าถึง',query('SELECT p.id,p.label,p.is_admin,p.revoked_at,p.created_at,i.expires_at,i.consumed_at,i.revoked_at AS invitation_revoked,m.project_id,m.role,pr.name AS project_name FROM principals p LEFT JOIN invitations i ON i.principal_id=p.id LEFT JOIN memberships m ON m.principal_id=p.id LEFT JOIN projects pr ON pr.id=m.project_id ORDER BY p.id DESC')->fetchAll());}
 if ($route==='/access'&&$method==='POST') {
    requireAdmin($u);$d=body();$label=textField($d,'label',120,true);$role=$d['role']??'';$project=(int)($d['project_id']??0);
    if(!in_array($role,['admin','editor','viewer'],true))reply(422,'สิทธิ์ไม่ถูกต้อง');
    if($role!=='admin')roleFor($u,$project);
    $token=bin2hex(random_bytes(32));db()->beginTransaction();
    query('INSERT INTO principals(label,is_admin) VALUES(?,?)',[$label,$role==='admin'?1:0]);$pid=(int)db()->lastInsertId();
    if($role!=='admin')query('INSERT INTO memberships(principal_id,project_id,role) VALUES(?,?,?)',[$pid,$project,$role]);
    query('INSERT INTO invitations(principal_id,token_hash,expires_at) VALUES(?,?,DATE_ADD(UTC_TIMESTAMP(),INTERVAL 7 DAY))',[$pid,hash('sha256',$token)]);
    db()->commit();reply(201,'ลิงก์นี้ใช้ได้หนึ่งครั้ง ภายใน 7 วัน',['id'=>$pid,'link'=>config()['APP_ORIGIN'].rtrim(config()['APP_BASE'],'/').'/#invite='.$token]);
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
       editable($role);$d=taskData(body());db()->beginTransaction();
       query('INSERT INTO tasks(project_id,title,feature,public_summary,scope,criteria,evidence,assignee,blocked_reason,checklist,status,planned_go_live_on,actual_released_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)',[$project,$d['title'],$d['feature'],$d['public_summary'],$d['scope'],$d['criteria'],$d['evidence'],$d['assignee'],$d['blocked_reason'],$d['checklist'],$d['status'],$d['planned_go_live_on'],$d['status']===4?gmdate('Y-m-d H:i:s'):null]);
       $id=(int)db()->lastInsertId();event($id,$u,'created',['status'=>$d['status'],'deadline'=>$d['planned_go_live_on']]);db()->commit();reply(201,'สร้างงานแล้ว',taskDto(query('SELECT * FROM tasks WHERE id=?',[$id])->fetch(),$role));
    }
 }
 if(preg_match('~^/tasks/(\d+)(/events)?$~',$route,$m)) {
    $id=(int)$m[1];$t=query('SELECT * FROM tasks WHERE id=? AND archived=0',[$id])->fetch();if(!$t)reply(404,'ไม่พบงาน');$role=roleFor($u,(int)$t['project_id']);
    if(!empty($m[2])) {editable($role);if($method!=='GET')reply(405,'วิธีเรียกไม่ถูกต้อง');$cursor=max(0,(int)($_GET['before']??PHP_INT_MAX));reply(200,'ประวัติ',query('SELECT e.id,e.action,e.payload,e.created_at,p.label AS actor FROM task_events e JOIN principals p ON p.id=e.principal_id WHERE e.task_id=? AND e.id<? ORDER BY e.id DESC LIMIT 50',[$id,$cursor])->fetchAll());}
    if($method==='GET')reply(200,'รายละเอียด',taskDto($t,$role));
    if($method==='PATCH'||$method==='DELETE') {
       editable($role);$data=body();if(!isset($data['version'])||!is_int($data['version']))reply(422,'ต้องระบุ version');
       $d=$method==='PATCH'?taskData($data):null;db()->beginTransaction();
       if($method==='DELETE')$stmt=query('UPDATE tasks SET archived=1,version=version+1,updated_at=UTC_TIMESTAMP() WHERE id=? AND version=? AND archived=0',[$id,$data['version']]);
       else $stmt=query('UPDATE tasks SET title=?,feature=?,public_summary=?,scope=?,criteria=?,evidence=?,assignee=?,blocked_reason=?,checklist=?,status=?,planned_go_live_on=?,actual_released_at=?,version=version+1,updated_at=UTC_TIMESTAMP() WHERE id=? AND version=? AND archived=0',[$d['title'],$d['feature'],$d['public_summary'],$d['scope'],$d['criteria'],$d['evidence'],$d['assignee'],$d['blocked_reason'],$d['checklist'],$d['status'],$d['planned_go_live_on'],$d['status']===4?($t['actual_released_at']?:gmdate('Y-m-d H:i:s')):null,$id,$data['version']]);
       if($stmt->rowCount()!==1){db()->rollBack();reply(409,'มีคนแก้งานนี้แล้ว กรุณาโหลดข้อมูลล่าสุดก่อนบันทึก');}
       $changes=[];if($d)foreach($d as $key=>$value)if((string)$t[$key]!== (string)$value)$changes[$key]=['from'=>$t[$key],'to'=>$value];
       event($id,$u,$method==='DELETE'?'archived':'updated',$changes);$saved=query('SELECT * FROM tasks WHERE id=?',[$id])->fetch();db()->commit();reply(200,'บันทึกแล้ว',taskDto($saved,$role));
    }
 }
 reply(404,'ไม่พบรายการที่ร้องขอ');
} catch(Throwable $e) {try {if(db()->inTransaction())db()->rollBack();} catch(Throwable $ignored) {} error_log('Workboard: '.$e->getMessage());reply(500,'ระบบไม่สามารถทำรายการได้ กรุณาลองใหม่');}
