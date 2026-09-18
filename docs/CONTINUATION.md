# ทำงานต่อจากตรงนี้

## เริ่ม session ใหม่

เปิด workspace ที่ C:/AppServ/www/Workboard แทน CRM_ERP_V4
อ่านข้อความใน AGENTS.md แล้วอ่าน CONTEXT.md → implementation_plan.md → TASKS.md

## จุดที่หยุด

Phase 1 vertical slice ทำงานบน local ที่ http://localhost/Workboard/ แล้ว
มี React production bundle, PHP API, MySQL migration/database, capability-link session, project authorization, task CRUD, persisted Kanban, right drawer, checklist, history และ access manager
ลิงก์ผู้ดูแลเริ่มต้นอยู่ใน `scratch/initial-admin-link.txt` (ignored) และยังไม่ถูกใช้ อย่าใส่ token ลง commit/log
ข้อมูล QA ถูก archive/revoke แล้ว ไม่มี remote หรือ public deployment

## งานถัดไป

เริ่ม Phase 2 จาก `TASKS.md`: touch/keyboard status control, weekly overview/report และ evidence records ที่มี source/freshness
จากนั้นทำ Phase 3 service-account/check-run/observation/proposal ด้วย fixtures ก่อนต่อระบบจริง
อย่าต่อ Git/FTP หรือ publish จนกว่าจะระบุ repository/branch/server/environment, secret storage และ deployment target
ก่อนแก้ schema ให้สร้าง migration ใหม่ ห้ามแก้ `001_core.sql` หลังจุดนี้

## ประโยคสำหรับเริ่มต่อ

“เปิด C:/AppServ/www/Workboard อ่าน AGENTS.md และ docs/CONTINUATION.md แล้วทำ Phase 2 ต่อจาก TASKS.md โดยรักษา capability-link และสิทธิ์รายโปรเจกต์เดิม”

## Suggested skills

- engineering:architecture เมื่อปรับข้อเสนอ architecture ให้เป็น ADR หลังตกลง
- engineering:testing-strategy สำหรับ role matrix, concurrency และ connector failure cases
- hallmark สำหรับหน้าจอใหม่ โดยใช้รูปแบบ compact ที่กำหนดแล้ว ไม่สุ่มโครงใหม่
- db เมื่อเริ่มสร้าง schema จริง อ่าน skill และตรวจ local connection ก่อน
- handoff เมื่อส่งต่อรอบถัดไป
