<?php
declare(strict_types=1);
function meetingData(array $d): array {
 $date=textField($d,'meeting_on',10,true);$parsed=DateTime::createFromFormat('!Y-m-d',$date);
 if(!$parsed||$parsed->format('Y-m-d')!==$date)reply(422,'วันที่ประชุมไม่ถูกต้อง');
 if(!is_bool($d['published']??null))reply(422,'กรุณาระบุการเผยแพร่');
 return ['title'=>textField($d,'title',240,true),'meeting_on'=>$date,'participants'=>textField($d,'participants',6000),'content'=>textField($d,'content',70000,true),'published'=>$d['published']?1:0];
}
function meetingDto(array $m,string $role,bool $detail=false): array {
 $out=['id'=>(int)$m['id'],'project_id'=>(int)$m['project_id'],'title'=>$m['title'],'meeting_on'=>$m['meeting_on'],'published'=>(bool)$m['published'],'version'=>(int)$m['version'],'updated_at'=>$m['updated_at']];
 if($detail){$out['content']=$m['content'];if($role!=='viewer')$out['participants']=$m['participants'];}
 return $out;
}
function meetingRoutes(string $route,string $method,array $u): void {
 if(preg_match('~^/projects/(\d+)/meetings$~',$route,$match)) {
  $project=(int)$match[1];$role=roleFor($u,$project);
  if($method==='GET') {
   $month=$_GET['month']??gmdate('Y-m');$date=is_string($month)?DateTime::createFromFormat('!Y-m',$month):false;
   if(!$date||$date->format('Y-m')!==$month)reply(422,'เดือนไม่ถูกต้อง');
   $end=(clone $date)->modify('+1 month')->format('Y-m-d');$cursor=max(0,(int)($_GET['cursor']??0));
   $rows=query('SELECT id,project_id,title,meeting_on,published,version,updated_at FROM meetings WHERE project_id=? AND archived=0 AND meeting_on>=? AND meeting_on<? AND id>? AND (?=1 OR published=1) ORDER BY id LIMIT 101',[$project,$date->format('Y-m-d'),$end,$cursor,$role==='viewer'?0:1])->fetchAll();
   $more=count($rows)>100;if($more)array_pop($rows);
   reply(200,'รายงานประชุม',['items'=>array_map(function($m)use($role){return meetingDto($m,$role);},$rows),'next_cursor'=>$more?(int)end($rows)['id']:null]);
  }
  if($method==='POST') {
   editable($role);$d=meetingData(body());db()->beginTransaction();
   query('INSERT INTO meetings(project_id,title,meeting_on,participants,content,published,created_by,updated_by) VALUES(?,?,?,?,?,?,?,?)',[$project,$d['title'],$d['meeting_on'],$d['participants'],$d['content'],$d['published'],$u['id'],$u['id']]);$id=(int)db()->lastInsertId();
   query('INSERT INTO meeting_events(meeting_id,principal_id,action,payload) VALUES(?,?,?,?)',[$id,$u['id'],'created',json_encode($d,JSON_UNESCAPED_UNICODE)]);
   $m=query('SELECT * FROM meetings WHERE id=?',[$id])->fetch();db()->commit();reply(201,'บันทึกประชุมแล้ว',meetingDto($m,$role,true));
  }
 }
 if(preg_match('~^/meetings/(\d+)$~',$route,$match)) {
  $id=(int)$match[1];$m=query('SELECT * FROM meetings WHERE id=? AND archived=0',[$id])->fetch();if(!$m)reply(404,'ไม่พบรายงานประชุม');$role=roleFor($u,(int)$m['project_id']);
  if($role==='viewer'&&!$m['published'])reply(404,'ไม่พบรายงานประชุม');
  if($method==='GET')reply(200,'รายงานประชุม',meetingDto($m,$role,true));
  if($method==='PATCH'||$method==='DELETE') {
   editable($role);$body=body();if(!is_int($body['version']??null))reply(422,'ต้องระบุ version');$d=$method==='PATCH'?meetingData($body):null;db()->beginTransaction();
   if($d)$stmt=query('UPDATE meetings SET title=?,meeting_on=?,participants=?,content=?,published=?,updated_by=?,version=version+1,updated_at=UTC_TIMESTAMP() WHERE id=? AND version=? AND archived=0',[$d['title'],$d['meeting_on'],$d['participants'],$d['content'],$d['published'],$u['id'],$id,$body['version']]);
   else $stmt=query('UPDATE meetings SET archived=1,updated_by=?,version=version+1,updated_at=UTC_TIMESTAMP() WHERE id=? AND version=? AND archived=0',[$u['id'],$id,$body['version']]);
   if($stmt->rowCount()!==1){db()->rollBack();reply(409,'มีคนแก้รายงานนี้แล้ว กรุณาเปิดข้อมูลล่าสุดก่อนบันทึก');}
   query('INSERT INTO meeting_events(meeting_id,principal_id,action,payload) VALUES(?,?,?,?)',[$id,$u['id'],$d?'updated':'archived',json_encode(['before'=>meetingDto($m,$role,true),'after'=>$d],JSON_UNESCAPED_UNICODE)]);
   $saved=query('SELECT * FROM meetings WHERE id=?',[$id])->fetch();db()->commit();reply(200,'บันทึกแล้ว',meetingDto($saved,$role,true));
  }
 }
}
