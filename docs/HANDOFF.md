# คู่มือส่งต่องาน Workboard

อัปเดต: 18 ก.ย. 2569 · สำหรับนักพัฒนาที่มารับดูแลระบบต่อ

## 1. ระบบนี้คืออะไร

Workboard คือระบบติดตามงานหลายโปรเจกต์ของทีม มีบอร์ด Kanban, ภาพรวม, รายงานสัปดาห์, ปฏิทินที่แสดงทั้งงานและรายงานประชุม, และหน้าจัดการสิทธิ์
ระบบไม่มีการ login ด้วยรหัสผ่าน ทุกคนเข้าผ่าน **ลิงก์เชิญ** ที่ผู้ดูแลออกให้ (ดูหัวข้อ 5)

| รายการ | ค่า |
|---|---|
| เว็บจริง | https://larksuite.prima49.com |
| Repository | https://github.com/PonuoM/larksuite (branch `main`) |
| Server | Hostinger VPS `srv1851858` IP `187.77.127.28` Ubuntu 24.04 เข้าด้วย `ssh root@187.77.127.28` (ใช้ SSH key ขอสิทธิ์จากเจ้าของระบบ) |
| โค้ดบน server | `/opt/workboard` |
| เครื่อง dev เดิม | `C:/AppServ/www/Workboard` → http://localhost/Workboard/ |

เทคโนโลยี: React 19 + TypeScript + Vite + Tailwind (หน้าเว็บ) · PHP + PDO (API) · MySQL 8 บนเครื่อง dev / MariaDB 10.11 บน server · Docker Compose + Caddy (HTTPS)

## 2. โครงสร้างโค้ด

```text
src/                 หน้าเว็บ React
  main.tsx           โครงหลัก, บอร์ด, drawer งาน, หน้าการเข้าถึง
  ProjectViews.tsx   ภาพรวม + รายงานสัปดาห์
  MeetingCalendar.tsx ปฏิทิน + drawer รายงานประชุม
  calendar-items.ts  ตรรกะว่าอะไรลงวันไหนในปฏิทิน (มีเทสต์)
  report-format.ts   แปลงข้อความ/Markdown ของรายงานประชุมเป็นหน้าอ่าน (มีเทสต์)
  api.ts             ตัวเรียก API (แนบ CSRF ให้อัตโนมัติ)
api/
  bootstrap.php      config, DB, session, สิทธิ์, validation
  meetings.php       API รายงานประชุม
  migrations/        001 → 004 (รันตามลำดับ ห้ามแก้ไฟล์ที่รันไปแล้ว)
public/
  api/index.php      router ของ API ทั้งหมด (/api/v1/...)
  index.html, assets ผลลัพธ์จาก build (commit ไว้สำหรับ AppServ)
.htaccess            เปิดให้เข้าได้แค่ /, /assets/*, /api/v1/* ที่เหลือ 403
deploy/              ไฟล์สำหรับ server (Dockerfile, compose, backup, Caddy)
scripts/             build.mjs, issue-admin-link.mjs
tests/               เทสต์ API และหน้าเว็บ
docs/                คู่มือนี้, WORKLOG (บันทึกการทำงาน), CONTINUATION
```

กติกาของ repo อยู่ใน [AGENTS.md](../AGENTS.md) (อ่านก่อนแก้โค้ด) ดีไซน์อยู่ใน [design.md](../design.md)

## 3. ตั้งเครื่อง dev (Windows + AppServ)

1. ต้องมี Node 22, PHP (AppServ ใช้ 7.3 แต่โค้ดต้องรันได้บน 8.3 ด้วย), MySQL และ Apache ที่เปิด `mod_rewrite`
2. clone repo ไว้ที่ `C:/AppServ/www/Workboard` (path นี้ผูกกับ URL `/Workboard/`)
3. `npm install`
4. สร้างฐานข้อมูล `workboard` แล้วรัน `api/migrations/001_core.sql` → `004_optional_go_live.sql` ตามลำดับ ด้วยบัญชีที่แก้โครงสร้างได้ (เช่น root)
5. สร้างบัญชีสำหรับแอปที่มีสิทธิ์แค่ `SELECT, INSERT, UPDATE, DELETE` บนฐาน `workboard`
   ถ้าใช้ PHP 7.3 กับ MySQL 8 ต้องตั้งบัญชีเป็น `mysql_native_password` ไม่งั้นต่อฐานไม่ได้
6. คัดลอก `.env.example` เป็น `.env` แล้วใส่รหัสผ่าน (`.env` ไม่เข้า Git)
7. `npm run build` แล้วเปิด http://localhost/Workboard/
8. ออกลิงก์ผู้ดูแลสำหรับเครื่องตัวเอง: สร้างแถวใน `principals` (`is_admin=1`) แล้วรัน `node scripts/issue-admin-link.mjs --principal <id>`

### ทางเลือก: Laragon / ไม่ใช้ Apache (Vite + PHP built-in)

```text
php -S 127.0.0.1:8095 scripts/dev-router.php     (API อย่างเดียว)
npm run dev                                       (หน้าเว็บ http://127.0.0.1:5173/Workboard/ ส่ง /Workboard/api ต่อให้ PHP)
```
ใน `.env` ตั้ง `APP_ORIGIN=http://127.0.0.1:5173` · ถ้า mysql.exe ไม่อยู่ที่ AppServ ให้ตั้ง `MYSQL_BIN` ตอนรัน `tests/api.mjs` และ `issue-admin-link.mjs`

### นำเข้างานจาก Lark Base (ครั้งเดียว)

`php scripts/import-lark-base.php <โฟลเดอร์ backup ของ /lark-base-update> [--apply]` — ไม่ใส่ `--apply` = ดูก่อน รันซ้ำได้ ไม่สร้างงานซ้ำ

## 4. เทสต์

```text
node tests/api.mjs             เทสต์ API ครบวงจร (ต้องมีฐาน local + โปรเจกต์อย่างน้อย 3 อัน)
node tests/report-format.mjs   ตัวจัดรูปแบบรายงานประชุม
node tests/presentation.mjs    render หน้ารายงาน/ปฏิทินฝั่ง server
node tests/calendar-items.mjs  ตรรกะปฏิทิน
npm run build                  type check + build
```

- `tests/api.mjs` สร้างบัญชีทดสอบแล้วเพิกถอนเองตอนจบ
- ระบบจำกัดการเปิดลิงก์ไว้ 30 ครั้งต่อ 10 นาทีต่อ IP และเทสต์ API หนึ่งรอบใช้ประมาณ 15 ครั้ง ถ้ารันติดกันหลายรอบจะเจอ 429 ให้รอ 10 นาที หรือบนเครื่อง dev ล้างตาราง `rate_limits`
- เทสต์กับ server จริงได้ผ่าน SSH tunnel (ดูใน [README](../README.md) หัวข้อ Production) แต่จะมีข้อมูลทดสอบที่ archive แล้วค้างอยู่ในฐานจริง ใช้เฉพาะตอนจำเป็น

## 5. การเข้าใช้งานและลิงก์

- ผู้ดูแลออกลิงก์จากหน้า **การเข้าถึง** ได้ 2 แบบ:
  - **ลิงก์ถาวร** (ค่าเริ่มต้น): ใช้ซ้ำได้ ไม่หมดอายุ จนกว่าจะกด "ปิดลิงก์"
  - **ลิงก์ใช้ครั้งเดียว:** ใช้ได้ภายใน 7 วัน
- สิทธิ์มี 3 ระดับ:
  - **ผู้ดูแล:** จัดการได้ทุกโปรเจกต์
  - **แก้ไข:** แก้งานในโปรเจกต์ที่ได้รับ
  - **ดูอย่างเดียว:** เห็นเฉพาะข้อมูลสาธารณะของงาน และรายงานประชุมที่ติ๊ก "เผยแพร่"
- เปิดลิงก์แล้วเบราว์เซอร์จะอยู่ในระบบได้ 7 วัน เมื่อหมดให้เปิดลิงก์เดิมอีกครั้ง
- ระบบเก็บเฉพาะ hash ของลิงก์ จึงดูลิงก์ย้อนหลังไม่ได้ ถ้าหายต้องออกใหม่แล้วปิดตัวเก่า
- **ลิงก์ผู้ดูแลหาย/เข้าไม่ได้เลย:** `node scripts/issue-admin-link.mjs --remote root@187.77.127.28` ได้ลิงก์ถาวรใหม่ของผู้ดูแล (principal 1) แสดงบนจอครั้งเดียว
- ห้ามส่งลิงก์ผู้ดูแลในแชทกลุ่มหรือเก็บไว้ในไฟล์ที่ commit

## 6. อัปเดตเวอร์ชันบน server

ทำจากเครื่อง dev ที่มี SSH key โดยรันใน **Git Bash** ห้ามใช้ PowerShell เพราะ PowerShell 5.1 ทำให้ข้อมูล tar ที่ส่งผ่าน pipe เสีย

```text
# 1) ทุกอย่างต้อง commit และ push แล้ว และเทสต์ผ่าน
git push

# 2) ส่งโค้ดจาก commit ล่าสุดไปทับ /opt/workboard (ไฟล์ลับใน deploy/ ไม่อยู่ใน Git จึงไม่ถูกทับ)
git archive --format=tar HEAD | ssh root@187.77.127.28 "tar -x -C /opt/workboard && echo $(git rev-parse --short HEAD) > /opt/workboard/DEPLOYED_COMMIT"

# 3) build และสลับ container ของแอป (ฐานข้อมูลไม่ถูกแตะ)
ssh root@187.77.127.28 "cd /opt/workboard/deploy && docker compose build app && docker compose up -d app"

# 4) เช็ก
curl https://larksuite.prima49.com/api/v1/session
```

- `/opt/workboard/DEPLOYED_COMMIT` บอกว่าบน server เป็นโค้ดจาก commit ไหน
- ไฟล์ที่ถูกลบออกจาก repo จะยังค้างอยู่บน server เพราะ `tar` ไม่ลบไฟล์เก่า ถ้าเป็นไฟล์สำคัญให้ลบบน server เอง
- ถ้า commit นั้นแก้ `deploy/docker-compose.yml` ในส่วน `db` (เช่นเพิ่ม mount ของ migration) คำสั่ง `up -d app` จะสร้าง container ฐานข้อมูลใหม่ด้วย ข้อมูลไม่หายเพราะอยู่ใน volume แต่ฐานข้อมูลจะหยุดไม่กี่วินาที ควรทำตอนคนใช้น้อย
- **ห้าม** `docker compose down -v` และห้ามลบ volume `workboard_db_data` เพราะเป็นข้อมูลจริงทั้งหมด

## 7. ฐานข้อมูลบน server

- container `workboard-db` (MariaDB 10.11) ไม่เปิดพอร์ตออกนอกเครื่อง ข้อมูลอยู่ใน volume `workboard_db_data`
- รหัสผ่านอยู่ใน `/opt/workboard/deploy/.env` และ `app.env` บน server เท่านั้น
- เข้า SQL แบบ root (ระวัง นี่คือข้อมูลจริง):
  `ssh root@187.77.127.28` แล้ว `docker exec -it workboard-db sh -c 'mariadb -uroot -p"$MARIADB_ROOT_PASSWORD" workboard'`
- **migration ใหม่:**
  1. เพิ่มไฟล์ `api/migrations/004_xxx.sql`
  2. deploy โค้ด
  3. สำรองข้อมูลก่อน: รัน `/bin/sh /opt/workboard/deploy/backup.sh`
  4. รันไฟล์ด้วย root: `docker exec -i workboard-db sh -c 'mariadb -uroot -p"$MARIADB_ROOT_PASSWORD" workboard' < /opt/workboard/api/migrations/004_xxx.sql`
  5. เพิ่ม mount บรรทัดใหม่ใน `deploy/docker-compose.yml` เพื่อให้ติดตั้งใหม่ได้ครบ
- **backup:** อัตโนมัติทุกวัน 03:15 ที่ `/opt/backups/workboard` เก็บ 14 วัน (cron: `/etc/cron.d/workboard-backup`, log: `/var/log/workboard-backup.log`)
- ติดตั้ง cron จาก `deploy/workboard-backup.cron` ด้วย `install -o root -g root -m 0644 /opt/workboard/deploy/workboard-backup.cron /etc/cron.d/workboard-backup` หลังสำรอง cron เดิมไว้ (เวลาอิง timezone ของ server) ต้องเรียกผ่าน `/bin/sh` เพราะ `git archive` ส่ง `backup.sh` ด้วย mode 0644 จึงเรียกตรงไม่ได้
- ชื่อไฟล์ backup ใช้วันที่: รันซ้ำวันเดียวกันจะอัปเดตไฟล์เดิม ให้ตรวจเวลาแก้ไขและ `gzip -t` แทนการนับไฟล์
- **restore** (ทับข้อมูลปัจจุบันทั้งหมด ต้องแน่ใจก่อน):
  `gunzip -c /opt/backups/workboard/workboard-YYYY-MM-DD.sql.gz | docker exec -i workboard-db sh -c 'mariadb -uroot -p"$MARIADB_ROOT_PASSWORD" workboard'`
- ควรคัดลอกไฟล์ backup ออกไปเก็บนอก VPS เป็นระยะ ตอนนี้ยังไม่มีระบบอัตโนมัติสำหรับเรื่องนี้

## 8. ข้อควรระวัง: VPS นี้ใช้ร่วมกับระบบอื่น

บน VPS นี้มีระบบ production อื่นรันอยู่ด้วย: ERP (`/opt/CRM_ERP_V4`), WorkAlljob/workspec (`/opt/workspec`), Jitsi, ASR และ listen-relay

- **อย่า** restart, stop หรือแก้ compose ของระบบอื่น
- HTTPS ของทุกเว็บมาจาก **Caddy ของ workspec** (`/opt/workspec/Caddyfile`) Workboard เป็น block `larksuite.prima49.com` ท้ายไฟล์
- **ถ้าต้องแก้ Caddyfile:**
  1. สำรองก่อน: `cp -p Caddyfile Caddyfile.bak.$(date +%Y%m%d%H%M%S)`
  2. แก้แบบไม่สร้างไฟล์ใหม่ เช่นต่อท้ายด้วย `>>` เพราะไฟล์ถูก mount แบบไฟล์เดี่ยว ถ้าใช้ `sed -i` หรือ editor ที่เขียนไฟล์ใหม่ Caddy จะไม่เห็นการเปลี่ยนแปลง
  3. ตรวจ config: `docker exec workspec-caddy-1 caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile`
  4. โหลด config ใหม่: `docker exec workspec-caddy-1 caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile` ถ้า config ผิด Caddy จะไม่ยอมเปลี่ยนและใช้ของเดิมต่อ
- ไฟล์ `app.env` ก็ถูก mount แบบไฟล์เดี่ยวเหมือนกัน แก้แล้วต้อง `docker compose restart app`
- `app.env` ใช้รูปแบบ INI: comment ต้องขึ้นต้นด้วย `;` ห้ามใช้ `#` ไม่งั้น API จะตอบ 500
- DNS ของ prima49.com อยู่ที่ผู้ให้บริการ nameserver `aco1.vps-sun.com` / `aco2.vps-moon.com` ไม่ใช่ Hostinger

## 9. ให้ AI เชื่อมต่อข้อมูล (เพิ่ม/อัปเดตงาน, ดูข้อมูล, เพิ่มสรุป)

### กติกาที่ตกลงไว้ก่อนหน้า

ตามแผนเดิม ([implementation_plan.md](../implementation_plan.md) และ [AGENTS.md](../AGENTS.md)) AI ควร **บันทึกข้อสังเกต/เสนอการเปลี่ยนสถานะ ให้คนเป็นผู้อนุมัติ** ไม่ปิดงานเอง ถ้าจะให้ AI แก้สถานะงานได้โดยตรง ควรให้เจ้าของระบบตัดสินใจและบันทึกไว้ใน AGENTS.md ก่อน

### ทางเลือก

| ทาง | ทำอะไรได้ | พร้อมใช้ | ความเสี่ยง |
|---|---|---|---|
| **A. ผ่าน API ด้วยบัญชีของ AI** (แนะนำ) | อ่าน/เพิ่ม/แก้งาน, เพิ่มรายงานประชุม | ใช้ได้เลยวันนี้ | ต่ำ: ผ่านการตรวจสิทธิ์ ตรวจข้อมูล กันแก้ชน และมีประวัติว่า AI เป็นคนแก้ |
| **B. MCP server ครอบ API** | เหมือน A แต่ Claude Code / Claude Desktop เรียกเป็นเครื่องมือได้ตรง ๆ | ต้องเขียนเพิ่ม (งานเล็ก ~1–2 วัน) | ต่ำ: ใช้สิทธิ์ของทาง A |
| **C. อ่านฐานข้อมูลตรง (read-only)** | ดึงข้อมูลไปวิเคราะห์/ทำสรุป | ต้องสร้างบัญชีอ่านอย่างเดียว | กลาง: เห็นข้อมูลภายในทุกโปรเจกต์ |
| D. เขียนฐานข้อมูลตรง | — | **ไม่แนะนำ** | สูง: ข้ามการตรวจข้อมูล ไม่มี history และทับงานที่คนกำลังแก้ได้ |
| E. ระบบ proposal ตามแผน Phase 3 | AI ส่งข้อเสนอ แล้วคนกดอนุมัติในเว็บ | ต้องพัฒนา (ตารางและหน้าจอใหม่) | ต่ำสุด: ตรงกับกติกาเดิม |

> ตั้งแต่ 18 ก.ย. 2026 ทาง A มีเครื่องมือพร้อมใช้: `scripts/wb.mjs` (อ่านงาน, งานย่อย, บันทึกความคืบหน้า, แจ้ง Lark) และแม่แบบการเขียนงานใน [docs/TASK-GUIDE.md](TASK-GUIDE.md) เจ้าของตกลงให้ agent ย้ายสถานะได้ถึง "รอทดสอบ" ห้ามปิดงานเอง

### ทาง A ทำอย่างไร (ใช้ได้ตอนนี้)

1. ผู้ดูแลสร้างลิงก์ถาวรในหน้า **การเข้าถึง** ชื่อผู้รับ เช่น `AI ผู้ช่วย` สิทธิ์ **แก้ไขงาน** (หรือ **ดูอย่างเดียว** ถ้าให้อ่านอย่างเดียว) และเลือกเฉพาะโปรเจกต์ที่อนุญาต
2. เก็บลิงก์ไว้ในที่เก็บความลับของตัว AI เช่นตัวแปร environment ห้ามเขียนลงไฟล์ใน repo
3. ตัว AI/สคริปต์ทำตามลำดับนี้ (API ตอบรูปแบบ `{ok, message, data}` เสมอ):

```text
# เข้าระบบด้วย token ส่วนหลัง #invite= แล้วเก็บ cookie
curl -c jar.txt -H "Content-Type: application/json" \
     -d '{"token":"<token จากลิงก์>"}' https://larksuite.prima49.com/api/v1/redeem

# ขอ csrf (ต้องแนบเป็น X-CSRF-Token ในทุกคำสั่งที่ไม่ใช่ GET)
curl -b jar.txt https://larksuite.prima49.com/api/v1/session

# อ่านข้อมูล
GET  /api/v1/projects
GET  /api/v1/projects/{id}/tasks            (ครั้งละ 100 งาน มี next_cursor ให้ ?cursor=)
GET  /api/v1/tasks/{id}   /api/v1/tasks/{id}/events
GET  /api/v1/projects/{id}/meetings?month=2026-09
GET  /api/v1/meetings/{id}

# เพิ่ม/แก้
POST  /api/v1/projects/{id}/tasks     สร้างงาน
PATCH /api/v1/tasks/{id}              แก้งาน: ส่งข้อมูลครบทุกช่อง + version ล่าสุด
POST  /api/v1/projects/{id}/meetings  เพิ่มรายงานประชุม/สรุป
PATCH /api/v1/meetings/{id}           แก้รายงาน (ต้องส่ง version)
```

**ช่องข้อมูลของงาน:**
- **ต้องมี:** `title` และ `status` · `planned_go_live_on` (YYYY-MM-DD) ไม่บังคับ ส่ง `null` หรือไม่ส่ง = ยังไม่กำหนด (migration 004)
  - `0` = รอทำ, `1` = กำลังทำ, `2` = รอทดสอบ, `3` = รอเปิดใช้, `4` = เปิดใช้งานแล้ว
- **ไม่บังคับ:** `feature`, `public_summary` (ข้อความที่ผู้ชมภายนอกเห็น), `scope`, `criteria`, `evidence`, `assignee`, `blocked_reason` และ `checklist` (`[{label, done}]`)

**การแก้งาน:**
- ต้องส่ง `version` ล่าสุดไปด้วยทุกครั้ง ถ้ามีคนแก้ไปก่อนจะได้ 409 ให้ AI อ่านข้อมูลใหม่แล้วค่อยแก้อีกรอบ
- ทุกการแก้ถูกบันทึกใน history ของงานพร้อมชื่อ `AI ผู้ช่วย`

**รายงานประชุม:**
- ต้องมี `title`, `meeting_on` และ `content` (Markdown ได้)
- `published: false` = เห็นเฉพาะทีม

**ความปลอดภัย:**
- ลิงก์ของ AI มีสิทธิ์เท่ากับคนที่ได้สิทธิ์แก้ไขในโปรเจกต์นั้น
- จะตัดสิทธิ์ ให้กด **ปิดลิงก์** หรือ **ยกเลิกสมาชิก** มีผลทันที

### ทาง C ทำอย่างไร (ถ้าต้องการอ่านด้วย SQL)

1. สร้างบัญชีอ่านอย่างเดียวบน server: `CREATE USER 'workboard_read'@'%' IDENTIFIED BY '<สุ่มยาว ๆ>'; GRANT SELECT ON workboard.* TO 'workboard_read'@'%';`
2. ให้ AI เชื่อมผ่าน SSH เท่านั้น เช่น `ssh root@187.77.127.28 docker exec -i workboard-db mariadb -uworkboard_read -p... workboard -e "SELECT ..."` ห้ามเปิดพอร์ตฐานข้อมูลออกอินเทอร์เน็ต
3. คำเตือน: บัญชีนี้เห็นข้อมูลภายในทุกโปรเจกต์ รวมถึงผู้เข้าร่วมประชุม และไม่ผ่านการกรองของ API

### ถ้าจะทำต่อให้ดีขึ้น

- **ระยะสั้น:** เขียน MCP server ครอบทาง A (เครื่องมือ `list_projects`, `list_tasks`, `create_task`, `update_task`, `add_meeting_summary`) แล้วตั้งใน `.mcp.json` ของผู้ใช้ Claude Code
- **ระยะยาว:** ทำ Phase 3 ตามแผน ได้แก่บัญชี service ที่ใช้ token แทน cookie, ตาราง observations/proposals, หน้าตรวจอนุมัติ และ idempotency key กันส่งซ้ำ

## 10. งานค้างและข้อจำกัดที่ควรรู้

- **หน้าจอไม่อัปเดตเอง (ยังไม่ realtime):** ต้อง reload หรือเปลี่ยนหน้าถึงจะเห็นสิ่งที่คนอื่นแก้
- **ยังไม่มี deploy อัตโนมัติ:** ต้องทำตามหัวข้อ 6 เอง
- **backup:** ยังอยู่บน VPS เครื่องเดียว
- **ประชุมมีแต่วันที่ ไม่มีเวลา:** เป็นการตัดสินใจของเจ้าของระบบ จึงยังไม่มีมุมมองรายชั่วโมง
- **รายการงานถัดไป:** อยู่ใน [TASKS.md](../TASKS.md) เช่น ปุ่มเปลี่ยนสถานะบนการ์ดสำหรับมือถือ/คีย์บอร์ด, ตัวกรองผู้รับผิดชอบ และหลักฐานแยกรายการ
- **ประวัติการทำงานทั้งหมด (เหตุผลของการตัดสินใจแต่ละครั้ง):** [docs/WORKLOG.md](WORKLOG.md)
