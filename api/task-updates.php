<?php
declare(strict_types=1);
// Incremental task updates for people and AI agents: sub-task operations, progress notes and Lark group notices.
// Sub-task operations merge on the server under a row lock, so they need no version and never overwrite each other.
const LARK_TARGETS = ['main'=>'กลุ่มจริง','test'=>'กลุ่มทดสอบ'];

function larkTargets(): array {
    $out=[];
    foreach(LARK_TARGETS as $key=>$label) if((config()['LARK_'.strtoupper($key).'_WEBHOOK']??'')!=='') $out[]=['key'=>$key,'label'=>$label];
    return $out;
}
// Custom-bot webhook with signature check: sign = base64(HMAC-SHA256(key = timestamp."\n".secret, message = "")).
// Returns null when Lark accepted the message, otherwise a message for the user.
function larkSend(string $target,string $text): ?string {
    if(!isset(LARK_TARGETS[$target]))reply(422,'ไม่รู้จักกลุ่ม Lark นี้');
    $url=config()['LARK_'.strtoupper($target).'_WEBHOOK']??'';$secret=config()['LARK_'.strtoupper($target).'_SECRET']??'';
    if($url==='')reply(422,'ยังไม่ได้ตั้งค่าบอท Lark สำหรับ'.LARK_TARGETS[$target]);
    $payload=['msg_type'=>'text','content'=>['text'=>$text]];
    if($secret!==''){$ts=(string)time();$payload=['timestamp'=>$ts,'sign'=>base64_encode(hash_hmac('sha256','',$ts."\n".$secret,true))]+$payload;}
    $context=stream_context_create(['http'=>['method'=>'POST','header'=>"Content-Type: application/json\r\n",'content'=>json_encode($payload,JSON_UNESCAPED_UNICODE),'timeout'=>8,'ignore_errors'=>true]]);
    $response=@file_get_contents($url,false,$context);
    $json=is_string($response)?json_decode($response,true):null;
    $code=is_array($json)?($json['code']??$json['StatusCode']??null):null;
    if($code===0)return null;
    error_log('Workboard Lark '.$target.': '.substr((string)$response,0,300));
    return is_array($json)&&isset($json['msg'])?': '.$json['msg']:' (ไม่มีการตอบกลับ)';
}
function taskLink(int $id): string {return config()['APP_ORIGIN'].rtrim(config()['APP_BASE'],'/').'/?view=board&task='.$id;}
function larkTaskText(array $t,array $u,string $headline): string {
    $project=(string)query('SELECT name FROM projects WHERE id=?',[$t['project_id']])->fetchColumn();
    $list=checklistItems($t['checklist']);$done=count(array_filter($list,function($c){return $c['done'];}));
    $lines=['['.$project.'] #'.str_pad((string)$t['id'],3,'0',STR_PAD_LEFT).' '.$t['title'],'สถานะ: '.TASK_STATUSES[(int)$t['status']].($list?' · งานย่อย '.$done.'/'.count($list):'')];
    if($headline!=='')$lines[]=$headline;
    $lines[]='โดย '.$u['label'].' · '.taskLink((int)$t['id']);
    return implode("\n",$lines);
}
// Headline for "save + notify": the author's own message when given, otherwise what changed.
function changeHeadline(array $changes,$custom): string {
    if(is_string($custom)&&trim($custom)!=='')return mb_substr(trim($custom),0,2000,'UTF-8');
    $names=['title'=>'ชื่องาน','feature'=>'ฟังก์ชัน','public_summary'=>'สรุป','scope'=>'รายละเอียด','criteria'=>'เกณฑ์ตรวจรับ','evidence'=>'หลักฐาน','assignee'=>'ผู้รับผิดชอบ','blocked_reason'=>'สาเหตุที่ติดขัด','checklist'=>'งานย่อย','planned_go_live_on'=>'กำหนดเริ่มใช้'];
    $parts=[];
    if(isset($changes['status']))$parts[]='ย้ายสถานะ '.TASK_STATUSES[(int)$changes['status']['from']].' → '.TASK_STATUSES[(int)$changes['status']['to']];
    $fields=array_values(array_intersect_key($names,$changes));
    if($fields)$parts[]='แก้ไข '.implode(', ',$fields);
    if(isset($changes['blocked_reason'])&&$changes['blocked_reason']['to']!=='')$parts[]='ติดขัด: '.$changes['blocked_reason']['to'];
    return $parts?implode("\n",$parts):'อัปเดตงาน';
}
function notifyTarget(array $d): ?string {
    $target=$d['notify']??null;
    if($target===null||$target==='')return null;
    if(!is_string($target)||!isset(LARK_TARGETS[$target]))reply(422,'กลุ่ม Lark ไม่ถูกต้อง');
    return $target;
}
// Called after commit. The change is already saved, so a Lark failure must not look like a failed save
// (the client would retry and create duplicates): it returns a warning that goes out with a 2xx response.
function notifyAfterCommit(?string $target,array $t,array $u,string $headline): ?string {
    if(!$target)return null;
    $failed=larkSend($target,larkTaskText($t,$u,$headline));
    if($failed!==null)return 'บันทึกแล้ว แต่ส่งเข้า Lark ไม่สำเร็จ'.$failed;
    event((int)$t['id'],$u,'lark_notified',['target'=>$target,'headline'=>$headline]);
    return null;
}
function withLarkWarning(array $dto,?string $warning): array {return $warning===null?$dto:$dto+['lark_warning'=>$warning];}

function taskUpdateRoutes(string $route,string $method,array $u): void {
    if($route==='/lark/targets'&&$method==='GET')reply(200,'กลุ่ม Lark',larkTargets());
    if(!preg_match('~^/tasks/(\d+)/(subtasks|notes|notify|approve)$~',$route,$m))return;
    if($method!=='POST')reply(405,'วิธีเรียกไม่ถูกต้อง');
    $id=(int)$m[1];$kind=$m[2];
    $t=query('SELECT * FROM tasks WHERE id=? AND archived=0',[$id])->fetch();if(!$t)reply(404,'ไม่พบงาน');
    $role=roleFor($u,(int)$t['project_id']);
    $d=body();
    // Approval is a per-person right (can_approve), so it works from any project role, including a view-only link.
    // approve: รออนุมัติ → รอดำเนินการ · reject (reason required): stays in รออนุมัติ with the reason in blocked_reason,
    // so the team revises it and the approver decides again; a later approval clears that reason.
    if($kind==='approve') {
        if(!(int)$u['can_approve'])reply(403,'ต้องมีสิทธิ์ผู้อนุมัติ');
        $decision=$d['decision']??'';
        if(!in_array($decision,['approve','reject'],true))reply(422,'decision ต้องเป็น approve หรือ reject');
        $note=textField($d,'note',2000,$decision==='reject');
        db()->beginTransaction();
        $t=query('SELECT * FROM tasks WHERE id=? AND archived=0 FOR UPDATE',[$id])->fetch();
        $from=$t?(int)$t['status']:-1;
        if($from!==STATUS_AWAITING_APPROVAL){db()->rollBack();reply(409,'งานนี้ไม่ได้อยู่ในคอลัมน์รออนุมัติแล้ว กรุณาโหลดใหม่');}
        if($decision==='approve') {
            $blocked=strpos((string)$t['blocked_reason'],REJECTED_PREFIX)===0?'':$t['blocked_reason'];
            query('UPDATE tasks SET status=0,blocked_reason=?,approved_by=?,approved_at=UTC_TIMESTAMP(),version=version+1,updated_at=UTC_TIMESTAMP() WHERE id=?',[$blocked,$u['id'],$id]);
        }
        else query('UPDATE tasks SET blocked_reason=?,approved_by=NULL,approved_at=NULL,version=version+1,updated_at=UTC_TIMESTAMP() WHERE id=?',[REJECTED_PREFIX.$note,$id]);
        $to=$decision==='approve'?0:STATUS_AWAITING_APPROVAL;
        event($id,$u,$decision==='approve'?'approved':'rejected',['note'=>$note,'status'=>['from'=>$from,'to'=>$to]]);
        $saved=query('SELECT * FROM tasks WHERE id=?',[$id])->fetch();db()->commit();
        reply(200,$decision==='approve'?'อนุมัติแล้ว ย้ายไป "รอดำเนินการ"':'บันทึกเหตุผลที่ไม่อนุมัติแล้ว งานยังอยู่ใน "รออนุมัติ"',taskDto($saved,$role));
    }
    // Approvers may comment (progress notes) even from a view-only link; they cannot notify Lark or edit.
    if($kind==='notes'&&$role==='reviewer') {
        if(notifyTarget($d))reply(403,'ผู้อนุมัติส่งเข้า Lark จากหน้านี้ไม่ได้');
        $text=textField($d,'text',4000,true);
        event($id,$u,'note',['text'=>$text]);
        reply(201,'บันทึกความเห็นแล้ว',['task'=>taskDto($t,$role)]);
    }
    editable($role);$target=notifyTarget($d);

    if($kind==='notify') {
        if(!$target)reply(422,'กรุณาเลือกกลุ่ม Lark');
        $headline=textField($d,'text',2000);
        $failed=larkSend($target,larkTaskText($t,$u,$headline));
        if($failed!==null)reply(502,'ส่งเข้า Lark ไม่สำเร็จ'.$failed);
        event($id,$u,'lark_notified',['target'=>$target,'headline'=>$headline]);
        reply(200,'ส่งเข้า '.LARK_TARGETS[$target].' แล้ว',['notified'=>$target]);
    }

    if($kind==='notes') {
        $text=textField($d,'text',4000,true);
        event($id,$u,'note',['text'=>$text]);
        $warning=notifyAfterCommit($target,$t,$u,'อัปเดต: '.$text);
        reply(201,$warning??($target?'บันทึกและส่งเข้า Lark แล้ว':'บันทึกความคืบหน้าแล้ว'),withLarkWarning(['task'=>taskDto($t,$role)],$warning));
    }

    // subtasks: {op:add,label,note?} · {op:set,id,done?,label?,note?} · {op:remove,id}
    $op=$d['op']??'';
    if(!in_array($op,['add','set','remove'],true))reply(422,'op ต้องเป็น add, set หรือ remove');
    db()->beginTransaction();
    $t=query('SELECT * FROM tasks WHERE id=? AND archived=0 FOR UPDATE',[$id])->fetch();
    if(!$t){db()->rollBack();reply(404,'ไม่พบงาน');}
    $list=checklistItems($t['checklist']);
    if($op==='add') {
        if(count($list)>=100){db()->rollBack();reply(422,'งานย่อยครบ 100 ข้อแล้ว');}
        $item=checklistItem(['label'=>$d['label']??'','note'=>$d['note']??'','done'=>($d['done']??false)===true],newChecklistId());
        $list[]=$item;$payload=['op'=>'add','label'=>$item['label']];$headline='เพิ่มงานย่อย: '.$item['label'];
    } else {
        $key=$d['id']??'';$index=null;
        foreach($list as $i=>$c)if($c['id']===$key)$index=$i;
        if($index===null){db()->rollBack();reply(404,'ไม่พบงานย่อยนี้ อาจถูกลบไปแล้ว กรุณาโหลดงานใหม่');}
        $before=$list[$index];
        if($op==='remove') {array_splice($list,$index,1);$payload=['op'=>'remove','label'=>$before['label']];$headline='ลบงานย่อย: '.$before['label'];}
        else {
            $next=$before;
            if(array_key_exists('done',$d)){if(!is_bool($d['done'])){db()->rollBack();reply(422,'done ต้องเป็น true/false');}$next['done']=$d['done'];$next['done_at']=$d['done']?($before['done']?$before['done_at']:gmdate('Y-m-d H:i:s')):null;}
            if(array_key_exists('label',$d))$next['label']=textField($d,'label',500,true);
            if(array_key_exists('note',$d))$next['note']=textField($d,'note',2000);
            $list[$index]=$next;
            $payload=['op'=>'set','label'=>$next['label']];
            foreach(['done','label','note'] as $f)if($before[$f]!==$next[$f])$payload[$f]=['from'=>$before[$f],'to'=>$next[$f]];
            $headline=($next['done']&&!$before['done']?'✅ เสร็จ: ':(!$next['done']&&$before['done']?'↩ เปิดใหม่: ':'แก้งานย่อย: ')).$next['label'].($next['note']!==''&&$next['note']!==$before['note']?' — '.$next['note']:'');
        }
    }
    query('UPDATE tasks SET checklist=?,version=version+1,updated_at=UTC_TIMESTAMP() WHERE id=?',[json_encode($list,JSON_UNESCAPED_UNICODE),$id]);
    event($id,$u,'subtask',$payload);
    $saved=query('SELECT * FROM tasks WHERE id=?',[$id])->fetch();db()->commit();
    $warning=notifyAfterCommit($target,$saved,$u,$headline);
    reply(200,$warning??'บันทึกงานย่อยแล้ว',withLarkWarning(taskDto($saved,$role),$warning));
}
