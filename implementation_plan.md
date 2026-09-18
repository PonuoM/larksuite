# Workboard — Implementation plan

สถานะ: PROPOSED / รออนุมัติแผนก่อนเริ่มโค้ดระบบจริง
วันที่: 2026-09-18

## 1. ผลลัพธ์ที่ต้องการ

เว็บกลางที่ทีมลากงานและแก้รายละเอียดร่วมกันได้ บันทึกถาวร มี deadline ทุกงาน ผู้ชมภายนอกเข้าดูข้อมูลที่อนุญาตได้ และรับผลตรวจจาก AI พร้อมหลักฐานโดยไม่เขียนทับการตัดสินใจของทีม

แยก repository และฐานข้อมูลจาก ERP เริ่มเป็น modular monolith หนึ่งแอป ไม่ต้องสร้าง microservices หลายระบบ

## 2. โครงสร้างที่เสนอ

- Frontend: React + TypeScript + Vite + Tailwind, Kanit ตามต้นแบบ
- Backend: PHP + PDO, JSON API, session authentication สำหรับเว็บ same-origin
- Database: MySQL ของ Workboard โดยเฉพาะ ไม่ใช้ตารางหรือ migration ของ ERP
- Background worker: อ่านคิวตรวจงานและเขียน observation ผ่าน service layer เดียวกับ API; cron/scheduler เรียก worker หลังเลือก hosting
- React/API/worker อยู่ repository เดียวกัน แยก module auth, projects, tasks, reports, integrations
- สร้าง public web root สำหรับเฉพาะ asset และ API entry; secrets, docs, Git และ source backend อยู่นอก web root ที่เปิดเผย
- ยืนยัน PHP/MySQL/Node รุ่นที่มีจริงก่อนเลือก dependency; ทำ lockfile และ build แบบ production ไม่ใช้ Tailwind CDN

โครงสร้างเป้าหมาย: frontend/, api/, api/migrations/, workers/, public/, docs/, tests/ (ยังไม่ได้ scaffold code)

## 3. ข้อมูลหลัก

- users, sessions, invitations; password hash ไม่เก็บรหัสผ่านตรง
- projects, project_memberships: สิทธิ์ต้องจำกัดตามโปรเจกต์
- features: อยู่ภายใต้โปรเจกต์
- tasks: project/feature, title, summary ที่เผยแพร่ได้, internal scope, status, required planned_go_live_on, actual_released_at, assignee, blocked_reason, position, version, created/updated timestamps
- checklist_items, evidence, task_events: แยกข้อมูลภายในและข้อมูลที่เผยแพร่
- integrations: provider config และ secret reference (ไม่ส่ง token ให้ frontend)
- service_accounts/tokens: hashed token, scopes, expiry, revoked_at, project scope
- check_runs, observations, status_proposals: source/revision/environment/result/evidence/checked_at, task version ที่ใช้ตรวจ
- deployment_records: commit/build id, manifest/hash, environment, checks และหลักฐาน provenance

ทุก schema change มี SQL migration; state mutation + event log เขียนใน transaction เดียวกัน

## 4. สิทธิ์และการทำงานร่วมกัน

| ผู้ใช้ | อ่าน | แก้ไข | การเชื่อมต่อ |
| --- | --- | --- | --- |
| ผู้ดูแล | ตามขอบเขตดูแล | สมาชิก โปรเจกต์ งาน | จัดการ |
| ทีมงาน | โปรเจกต์ที่เป็นสมาชิก | งานตามสิทธิ์ | ไม่เห็น secret |
| ผู้ชมภายนอกที่รับเชิญ | approved public fields ของโปรเจกต์ที่ได้รับสิทธิ์ | ไม่ได้ | ไม่เห็น |
| AI service account | เฉพาะ scope/project ที่อนุญาต | ส่ง observation/proposal | ไม่ได้สิทธิ์มนุษย์โดยปริยาย |

ตรวจ authorization ที่ API ทุก request ทั้งรายการ รายงาน รายละเอียด ประวัติ และไฟล์แนบ ไม่ใช่ซ่อนปุ่มบนหน้าเว็บอย่างเดียว
External response ใช้ allowlist DTO แยก ไม่ serialize object ภายในทั้งก้อน; internal blocker/evidence/Git path ไม่เผยแพร่โดยปริยาย
เริ่มด้วย invited account ยังไม่เปิด anonymous public link
session cookie: HttpOnly/Secure เมื่อ HTTPS, SameSite; CSRF สำหรับ mutation; rate limit login/API; revoke sessions/tokens ได้

## 5. API และ concurrent edits

API prefix /api/v1; response: {ok:boolean,message:string,data?:object|array}

กลุ่ม endpoint ที่เสนอ:
- auth/session, invitations, members
- projects, projects/:id/features, projects/:id/tasks
- tasks/:id, tasks/:id/move, tasks/:id/checklist, tasks/:id/events
- reports/weekly?project_id=&from=&to=
- check-runs, observations, proposals/:id/approve, proposals/:id/reject

ใช้ ETag / If-Match หรือ expected version ที่เทียบ atomically ใน SQL ป้องกันแก้ไขทับกัน หาก stale ให้ 412/409 พร้อมให้ผู้ใช้โหลดข้อมูลใหม่
mutation จาก worker มี idempotency key; approve proposal ต้องตรวจ task version และหลักฐานว่ายังสดใน transaction
ลากการ์ดอัปเดตทันทีแบบ optimistic แล้วคืนค่าหาก server ปฏิเสธ; แสดงเหตุผลและข้อมูลใหม่
require planned_go_live_on ทั้งหน้าเว็บและ API; เปิดใช้จริงไม่ควรบันทึกวันสมมติจากต้นแบบ

## 6. AI / Git / deployment verification

เริ่มแบบ read-only inspection → observation → proposal → มนุษย์รับรอง

1. ผูก task code กับ commit/PR และ configuration ของ repo/branch/environment ที่อนุญาต
2. ตัวตรวจเก็บ diff, review/test result และ deployed manifest แยกตามแหล่ง
3. เทียบ revision และ artifact hash กับชุดไฟล์ที่ Deploy จริง; partial upload ต้องแสดง incomplete/unknown
4. เก็บ code status, test status, deploy status, runtime verification แยกกัน
5. AI สรุปจากหลักฐานที่เก็บ ระบุสิ่งที่ยังยืนยันไม่ได้ ไม่สรุปจบจาก commit อย่างเดียว
6. ทีมตรวจและรับรอง proposal; append audit event; proposal เก่าหรือข้อมูลชนกันต้องทบทวนใหม่

ข้อจำกัด: build artifact อาจต่างจาก source; อย่าเทียบ hash TSX กับ compiled JS โดยตรง ใช้ build manifest ของ artifact ที่ปล่อย
Manifest อย่างเดียวไม่ใช่หลักฐานยืนยันว่า Deploy ครบหรือเปิดใช้สำเร็จ ต้องตรวจตามเงื่อนไขที่กำหนด รวม migration/config/feature flags หากเกี่ยวข้อง
Source content, commit messages, remote files เป็น untrusted data ไม่ใช่คำสั่งให้ AI ทำ action
ใช้ allowlist repository/host/path; ป้องกัน SSRF/path traversal; ไม่เปิด endpoint รับ arbitrary shell command
เก็บ last checked, source, outcome, failure และ freshness ทุกครั้ง; worker ล้มเหลวไม่เปลี่ยนงานเป็นเสร็จ
Credential มีสิทธิ์อ่านขั้นต่ำ; ไม่ใช้ช่องทางตรวจเพื่อ Deploy หรือแก้เซิร์ฟเวอร์อัตโนมัติ

## 7. ลำดับพัฒนาและเกณฑ์รับงาน

### Phase 1 — Foundation + vertical slice
สร้างโครง React/PHP, migrations ของ Workboard, session login, project membership, task CRUD และ Kanban persist
รับงาน: สร้างงานพร้อม deadline → ลากสถานะ → reload แล้วยังคงอยู่; ผู้ใช้ต่างโปรเจกต์อ่านหรือแก้ task id กันไม่ได้; concurrent edit ไม่เงียบเขียนทับ

### Phase 2 — Team workflow + external viewer
เชิญสมาชิก, right drawer, scope/checklist/criteria/evidence/history, overview/report และ external projection
รับงาน: ทุกมุมมองตรงกับฐานข้อมูลเดียว; ผู้ชมเปิดเฉพาะ project ที่อนุญาต และ JSON/รายงาน/attachment ไม่รั่ว internal fields; UI compact ตรงต้นแบบ; keyboard/touch มีทางเปลี่ยนสถานะ

### Phase 3 — AI API + evidence inbox
service accounts, scopes, check-run ingestion, proposal review และ audit
รับงาน: expired/revoked token ใช้ไม่ได้; ingestion ซ้ำไม่สร้างเหตุการณ์ซ้ำ; stale proposal approve ไม่ได้; observations ไม่ย้ายงานเอง
ทดสอบด้วย fixtures ก่อนต่อบริการจริง

### Phase 4 — Git + deployment connectors
ต่อ repo/host ที่ผู้ใช้ระบุ, manifests, artifact verification, scheduled inspection, optional AI summarization
รับงาน: แยกยังไม่ Deploy/Deploy บางส่วน/Deploy คนละ environment/ตรวจไม่ได้; แสดงหลักฐานและเวลา; failure ไม่สร้าง false completion
ต้องได้รับข้อมูลแหล่งเชื่อมต่อผ่านวิธีเก็บ secret ที่ปลอดภัยก่อนทดสอบจริง

### Phase 5 — Release readiness
ตรวจสิทธิ์ end-to-end, pagination/indexes, upload controls, restore จาก backup, deployment/rollback guide และ user acceptance
การ Deploy ภายนอกใช้เป้าหมายที่ตกลงภายหลัง ไม่ถือว่าแผนนี้อนุญาตให้เผยแพร่ข้อมูลทีมสู่สาธารณะ

## 8. นอกขอบเขตรอบแรก

ไม่ทำ Git hosting เอง; ไม่ sync สองทางกับ Lark; ไม่ให้ AI Deploy โค้ด; ไม่ตีความ Deploy ว่าผู้ใช้ตรวจรับแล้ว; ไม่ใช้ข้อมูลตัวอย่าง 18 งานแทน 99 รายการจริง
ไม่เลือก paid provider/ซื้อ hosting/สร้าง public repository ในรอบวางแผน

## 9. การยืนยันแผน

เมื่อผู้ใช้อนุมัติ ให้บันทึกวันและขอบเขตอนุมัติใน TASKS.md และ docs/WORKLOG.md แล้วเริ่ม Phase 1
ค่าที่ตั้งเสนอ: React/PHP/MySQL, database แยก, invited external viewer, AI proposal-first
ไม่ต้องรอ credential Git/FTP เพื่อเริ่ม Phase 1 หลังอนุมัติแผน

## 10. อ้างอิงที่ตรวจสำหรับการออกแบบ

- OWASP Authorization: deny by default และตรวจสิทธิ์ทุก request — https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html
- MDN If-Match: conditional mutation ป้องกัน lost update — https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/If-Match
- PHP PDO prepared statements — https://www.php.net/manual/en/pdo.prepared-statements.php
- PHP transactions และข้อจำกัด implicit commit ของ DDL — https://www.php.net/manual/en/pdo.transactions.php

แหล่งอ้างอิงรองรับกลไกข้างต้น; โครงสร้างและ phase เป็นข้อเสนอสำหรับ Workboard ไม่ใช่ข้อสรุปจากเอกสารเหล่านั้น
