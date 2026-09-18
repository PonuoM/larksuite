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

## ล่าสุด: ปรับหน้าสิทธิ์ตาม feedback
API POST /access รองรับ project_ids หลายรายการและ project_id แบบเดิม; UI เลือกทุกโปรเจกต์ปัจจุบันหรือหลายรายการได้ ไม่มีสิทธิ์อัตโนมัติสำหรับโปรเจกต์ในอนาคต ไม่เปลี่ยน schema และไม่ขยายสิทธิ์ของลิงก์เดิม
สมาชิกแสดงคนละแถวและซ่อนผู้ถูกยกเลิกเป็นค่าเริ่มต้น ฟอร์มสร้างโปรเจกต์เปิดจากปุ่ม + โปรเจกต์
Build/PHP syntax/API integration ผ่านแล้ว ยังไม่ได้ตรวจภาพหน้าจอของ UI รุ่นนี้

## ล่าสุด: Variant C + ปฏิทินประชุม
Default view เป็นรายงานสัปดาห์ (?view=report); views: overview, board, report, calendar, access. ใช้ design.md เป็นหลัก หน้าการเข้าถึงยังสร้างลิงก์พนักงานในระบบเดียวกัน
Migration 002_meetings.sql รันบน local แล้ว ห้ามรันซ้ำ มี api/meetings.php และ src/MeetingCalendar.tsx, ProjectViews.tsx, FormattedReport.tsx, report-format.ts
ปฏิทินคลิกวันเพื่อเพิ่ม/อ่านประชุม; วาง AI summary เป็นข้อความ/Markdown และดูหน้าอ่านก่อนบันทึก ไม่ได้เรียกโมเดล AI จริง รายงานใหม่เป็น internal จนกว่าจะ published; participants ไม่ส่งให้ viewer
Validation: node tests/api.mjs, node tests/report-format.mjs, node tests/presentation.mjs, node scripts/build.mjs, PHP syntax ผ่าน; ยังไม่มี visual browser check เพราะไม่มี browser surface

## ล่าสุด: Visual QA ผ่านแล้ว
ตรวจในเบราว์เซอร์จริง (Playwright) ทุกหน้าและ drawer ที่ 320/375/414/768/1440px แล้ว แก้ toolbar มือถือ, การนับความยาวข้อความภาษาไทย (mb_strlen), รายการซ้อน/เช็กลิสต์ในหน้าอ่าน และไอคอน SVG รายละเอียดใน docs/WORKLOG.md
งานถัดไป: ปุ่มเปลี่ยนสถานะบนการ์ดสำหรับ touch/keyboard, ตัวกรองผู้รับผิดชอบ, evidence แยกรายการพร้อม source/checked_at

## ล่าสุด: ลิงก์ถาวร
Migration 003_permanent_links.sql รันบน local แล้ว ห้ามรันซ้ำ (invitations.reusable/last_used_at, expires_at nullable, access_sessions.invitation_id) API: POST /access รับ permanent, POST /access/{id}/links, POST /access/links/{id}/close; GET /access คืนสมาชิกพร้อม projects/links

## ล่าสุด: ปฏิทินแบบ WorkAlljob
src/MeetingCalendar.tsx (โครงหน้าใหม่ + MeetingDrawer เดิม) และ src/calendar-items.ts (ตรรกะวางรายการลงวัน ทดสอบด้วย tests/calendar-items.mjs) ผู้ใช้เลือก: งานเป็นจุดเดียววันเริ่มใช้ ไม่ลากแถบ; ประชุมไม่มีเวลา ไม่มี schema change

## ล่าสุด: เตรียม deploy
ไฟล์ deploy/ พร้อม (Dockerfile, compose, grants, backup, Caddy snippet) base path ตั้งค่าได้ด้วย WORKBOARD_BASE และ clientIp รองรับ TRUST_PROXY ดู README ส่วน Production

## ล่าสุด: ออนไลน์แล้ว
https://larksuite.prima49.com ใช้งานได้ (HTTPS ผ่าน Caddy ของ workspec) อัปเดตโค้ด: commit + push แล้วส่ง git archive ไป /opt/workboard, docker compose build app && up -d ใน deploy/ (ห้ามลบ volume workboard_db_data) migration ใหม่รันด้วย root ใน workboard-db

## ล่าสุด: คู่มือส่งต่องาน
docs/HANDOFF.md คือคู่มือหลักสำหรับคนรับงานต่อ (dev, deploy, DB, VPS, การเชื่อม AI) และ scripts/issue-admin-link.mjs ใช้ออกลิงก์ผู้ดูแลเมื่อลิงก์หาย
