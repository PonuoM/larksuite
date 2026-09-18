# ทำงานต่อจากตรงนี้

## Deploy ล่าสุด — 18 ก.ย. 2026
Production 7f88763 (mobile workspace refinement) ตามคำสั่งเจ้าของ "deploy เลย". Build และ up --no-deps เฉพาะ app; DB container เดิม healthy. HTTPS root/session ผ่าน และ browser ตรวจ production bundle ด้วย API fixtures ที่ 320/375/414/768/1440 ผ่าน. ไม่มี migration. Rollback image: workboard-app:rollback-6f876b9. คำขอ "ขอใหม่หมด" ก่อนหน้านี้ยังไม่ได้เริ่มออกแบบใหม่ — ที่ deploy คือชุดปรับมือถือที่เสร็จแล้ว.

## ล่าสุด — ปรับดีไซน์มือถือ (local, ยังไม่ deploy)
ปรับ src/MobileBoard.tsx, src/main.tsx และเพิ่ม src/mobile-workspace.css โดยต่อจาก mobile list ของรอบก่อน: persistent controls, list/board toggle, scroll-snap columns, bottom navigation clearance, full-width drawers, larger inputs, visible archived-release filter. Build แล้วใน public/. ไม่มี API/schema change.
ตรวจ Chromium ด้วย API fixtures (ไม่มีข้อมูล production) ที่ 320/375/414/768/1440 ผ่าน; script และภาพอยู่ scratch/ui-qa/. รูป mobile-375.png, board-414.png, drawer-375.png สำหรับเจ้าของตรวจดีไซน์. ยังไม่ commit/deploy และยังไม่ตรวจ keyboard/safe-area บนมือถือจริง.

## จุดต่อปัจจุบัน — 18 ก.ย. 2026 เวลา 19:44

แก้ backup ด่วนจาก scratch/codex-handoff.md แล้ว: cron เรียก `/bin/sh /opt/workboard/deploy/backup.sh` เพราะไฟล์ใน Git เป็น 100644 และ execute โดยตรงไม่ได้ สำรอง cron เดิมไว้ `/opt/backups/workboard/cron-before-shell-fix-20260918` และติดตั้งจาก `deploy/workboard-backup.cron` แล้ว
รันด้วย environment แบบ cron สำเร็จ; backup `workboard-2026-09-18.sql.gz` ขนาด 37,330 ไบต์ mode 600, gzip integrity ผ่านและมี dump completion marker เวลา 19:44:29 +07. ยังไม่ได้รอ cron รอบ 03:15 หรือทดสอบ restore. Production app revision ยังเป็น 7a77bbf; ไม่ได้ deploy แอปหรือ restart container.
ถัดไป: ตรวจ backup หลัง 19 ก.ย. 03:15 แล้วคุยตรวจรายการงาน Mini ERP กับเจ้าของตาม handoff ห้ามเดาสถานะหรือแก้รายละเอียดก่อนตกลง และยังไม่ส่ง Lark. ใช้ editor link สำหรับ AI ตาม TASK-GUIDE. การแก้ cron และเอกสารรอบนี้ยังไม่ได้ commit/push.

## เริ่ม session ใหม่

เปิด workspace ที่ C:/AppServ/www/Workboard แทน CRM_ERP_V4
อ่านข้อความใน AGENTS.md แล้วอ่าน CONTEXT.md → implementation_plan.md → TASKS.md

## จุดที่หยุด

Phase 1 vertical slice ทำงานบน local ที่ http://localhost/Workboard/ แล้ว
มี React production bundle, PHP API, MySQL migration/database, capability-link session, project authorization, task CRUD, persisted Kanban, right drawer, checklist, history และ access manager
ลิงก์ผู้ดูแลเริ่มต้นอยู่ใน `scratch/initial-admin-link.txt` (ignored) และยังไม่ถูกใช้ อย่าใส่ token ลง commit/log
ข้อมูล QA ถูก archive/revoke แล้ว; ปัจจุบันมี remote https://github.com/PonuoM/larksuite และ production https://larksuite.prima49.com แล้ว

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


## 2026-09-18 — production status inspection
Read-only SSH inspection: DEPLOYED_COMMIT=494acf2; workboard-app Up; workboard-db healthy; HTTPS root HTTP 200; session API ok with user=null (unauthenticated). Backup files present including pre-004-20260918164501.sql.gz. Production admin link file exists at scratch/production-admin-link.txt (token not logged or redeemed). No viewer link file found among scratch filenames containing link; active viewer memberships were not inspected. No integration suite or database recount run; 99 imported tasks remains a prior-session result. Next: use TASKS.md for remaining features; issue viewer links from Access when requested.

## ล่าสุด: งานย่อย / ความคืบหน้า / Lark (local, ยังไม่ deploy)
ดู TASKS.md หัวข้อ "18 ก.ย. รอบ 2" และ docs/TASK-GUIDE.md. Deploy ต้องทำ: push, git archive → /opt/workboard, รัน 005_viewable_links.sql ใน workboard-db, เพิ่ม LINK_KEY (ใหม่ ห้ามใช้ของ local) + LARK_MAIN_*/LARK_TEST_* ใน deploy/app.env, docker compose build app && up -d, แล้ว seal ลิงก์ผู้ชมเดิมด้วย scripts/seal-link.php (อ่านลิงก์จาก STDIN)

## ล่าสุด: แก้ "ต้องกด F5" (deploy แล้ว 445c096)
ดู TASKS.md "18 ก.ย. รอบ 3" และ WORKLOG ส่วนท้าย. ไฟล์: src/MeetingCalendar.tsx, src/meeting-state.ts (ใหม่), src/main.tsx, src/TaskDrawer.tsx, src/types.ts, api/task-updates.php, public/api/index.php, scripts/wb.mjs, tests/api.mjs, tests/meeting-state.mjs (ใหม่). ใน working tree ยังมีงาน backup ของรอบอื่น (deploy/backup.sh, deploy/workboard-backup.cron, HANDOFF) ที่ยังไม่ commit — แยก commit

## ล่าสุด: คอลัมน์รอตัดสินใจ / รออนุมัติ (deploy แล้ว 9be01a2)
สถานะ 5 = รอตัดสินใจ, 6 = รออนุมัติ (migration 006) · ผู้อนุมัติ = principals.can_approve ตั้งในหน้าการเข้าถึง · สมาชิก "CEO" ดูอย่างเดียว + อนุมัติ · บัญชี "Claude (AI) ร่างงาน" (editor) ใช้เขียนงานผ่าน API ลิงก์อยู่ scratch/claude-editor-link.txt · ถ้าประชุมขัดกันให้ยึดครั้งล่าสุด
