# ทำงานต่อจากตรงนี้

## เริ่ม session ใหม่

เปิด workspace ที่ C:/AppServ/www/Workboard แทน CRM_ERP_V4
อ่านข้อความใน AGENTS.md แล้วอ่าน CONTEXT.md → implementation_plan.md → TASKS.md

## จุดที่หยุด

ตั้งโปรเจกต์ Git แยกและเอกสารแล้ว แผนระบบจริงยังรอผู้ใช้อนุมัติ
ยังไม่มี runtime app/database/API/authentication ในโปรเจกต์ใหม่นี้
UI ต้นแบบอยู่ที่ C:/AppServ/www/CRM_ERP_V4/docs/prototypes/workboard/ และยังเปิดได้ที่ URL เดิมใน README

## งานถัดไป

หากผู้ใช้อนุมัติแผน ให้บันทึกการอนุมัติและเริ่ม Phase 1 ตามแผน ไม่ต้องรอ Git/FTP integration secrets
ตรวจ runtime ก่อนเลือกเวอร์ชัน dependencies สร้าง vertical slice login → project membership → task CRUD → persisted drag พร้อม deadline/version/audit
อย่าทำการเชื่อม FTP จริงหรือ publish ก่อนระบุ target/environment

## ประโยคสำหรับเริ่มต่อ

“อ่าน AGENTS.md และ docs/CONTINUATION.md ของ Workboard แล้วทำต่อจาก TASKS.md โดยใช้ implementation_plan.md เป็นขอบเขต”

## Suggested skills

- engineering:architecture เมื่อปรับข้อเสนอ architecture ให้เป็น ADR หลังตกลง
- engineering:testing-strategy สำหรับ role matrix, concurrency และ connector failure cases
- hallmark สำหรับหน้าจอใหม่ โดยใช้รูปแบบ compact ที่กำหนดแล้ว ไม่สุ่มโครงใหม่
- db เมื่อเริ่มสร้าง schema จริง อ่าน skill และตรวจ local connection ก่อน
- handoff เมื่อส่งต่อรอบถัดไป
