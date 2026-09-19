<?php
declare(strict_types=1);
// Developer names (migration 009). Everyone signed in may read the list (the board shows names); only admins
// add, rename or deactivate. There is no delete: a deactivated developer stays on the tasks that name them.
function developerRow(array $d): array {return ['id'=>(int)$d['id'],'name'=>$d['name'],'active'=>(bool)$d['active']];}
function developerRoutes(string $route,string $method,array $u): void {
    if($route==='/developers'&&$method==='GET')reply(200,'นักพัฒนา',array_map('developerRow',query('SELECT id,name,active FROM developers ORDER BY active DESC,name')->fetchAll()));
    if($route==='/developers'&&$method==='POST') {
        requireAdmin($u);$name=textField(body(),'name',120,true);
        if(query('SELECT id FROM developers WHERE name=?',[$name])->fetch())reply(409,'มีชื่อนักพัฒนานี้แล้ว');
        query('INSERT INTO developers(name) VALUES(?)',[$name]);
        reply(201,'เพิ่มนักพัฒนาแล้ว',developerRow(query('SELECT id,name,active FROM developers WHERE id=?',[(int)db()->lastInsertId()])->fetch()));
    }
    if(preg_match('~^/developers/(\d+)$~',$route,$m)&&$method==='PATCH') {
        requireAdmin($u);$id=(int)$m[1];$d=body();
        $row=query('SELECT id,name,active FROM developers WHERE id=?',[$id])->fetch();if(!$row)reply(404,'ไม่พบนักพัฒนา');
        $name=array_key_exists('name',$d)?textField($d,'name',120,true):$row['name'];
        if(array_key_exists('active',$d)&&!is_bool($d['active']))reply(422,'ต้องระบุ active เป็น true/false');
        $active=array_key_exists('active',$d)?($d['active']?1:0):(int)$row['active'];
        if($name!==$row['name']&&query('SELECT id FROM developers WHERE name=? AND id<>?',[$name,$id])->fetch())reply(409,'มีชื่อนักพัฒนานี้แล้ว');
        query('UPDATE developers SET name=?,active=? WHERE id=?',[$name,$active,$id]);
        reply(200,'บันทึกแล้ว',developerRow(query('SELECT id,name,active FROM developers WHERE id=?',[$id])->fetch()));
    }
}
// Task payload `developer_ids`: a list of existing developer ids (max 20). Missing on PATCH = keep the current list,
// so older clients (CLI `set`) never wipe it. A deactivated developer may stay on a task but cannot be newly added.
function developerIds(array $data,?string $current): string {
    if(!array_key_exists('developer_ids',$data))return $current??'[]';
    $ids=$data['developer_ids'];
    if(!is_array($ids)||count($ids)>20)reply(422,'ข้อมูลไม่ถูกต้อง: developer_ids');
    $kept=json_decode($current??'[]',true)?:[];$clean=[];
    foreach($ids as $id) {
        if(!is_int($id)||$id<1)reply(422,'ข้อมูลไม่ถูกต้อง: developer_ids');
        $row=query('SELECT active FROM developers WHERE id=?',[$id])->fetch();
        if(!$row||(!(int)$row['active']&&!in_array($id,$kept,true)))reply(422,'ไม่พบนักพัฒนา หรือถูกปิดใช้แล้ว: '.$id);
        $clean[$id]=$id;
    }
    sort($clean);
    return json_encode(array_values($clean));
}
