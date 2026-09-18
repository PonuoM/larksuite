# Workboard

ระบบติดตามงานหลายโปรเจกต์สำหรับทีม พร้อมผู้ชมภายนอกและการตรวจหลักฐานโดย AI

## สถานะปัจจุบัน

Phase 1 ใช้งานบนเครื่อง local แล้ว: ฐานข้อมูลแยก, ลิงก์เชิญแบบใช้ครั้งเดียว, session, สิทธิ์รายโปรเจกต์, task CRUD, Kanban ลากแล้วบันทึกถาวร, deadline บังคับ, right drawer, checklist, history และหน้าจัดการสิทธิ์

ยังไม่ได้ Deploy สู่ภายนอกและยังไม่ได้ต่อ Git/FTP/AI จริง ข้อมูลจากระบบเหล่านั้นจะเข้ามาเป็นหลักฐานและข้อเสนอให้ทีมตรวจ ไม่เปลี่ยนสถานะงานอัตโนมัติ

## อ่านต่อในลำดับนี้

1. [CONTEXT.md](CONTEXT.md) — เป้าหมาย คำศัพท์ และข้อสรุปจากผู้ใช้
2. [implementation_plan.md](implementation_plan.md) — แผนที่เสนอและเกณฑ์รับงาน
3. [TASKS.md](TASKS.md) — งานที่ทำแล้วและลำดับถัดไป
4. [docs/CONTINUATION.md](docs/CONTINUATION.md) — จุดเริ่มสำหรับรอบถัดไป
5. [AGENTS.md](AGENTS.md) — กติกาการทำงานใน repository นี้

## ต้นแบบอ้างอิง

ไฟล์: C:/AppServ/www/CRM_ERP_V4/docs/prototypes/workboard/
เปิด: http://localhost/CRM_ERP_V4/docs/prototypes/workboard/index.html

ต้นแบบอยู่ใน ERP เดิม ใช้ข้อมูลสาธิต 18 งาน เก็บสถานะในหน่วยความจำ และรีเฟรชแล้วหาย ไม่ใช่ข้อมูลจริงจาก Lark/Git/FTP อย่าย้าย bundle ต้นแบบไปใช้เป็นระบบจริงโดยตรง

## เปิดระบบ Local

- URL: http://localhost/Workboard/
- ลิงก์ผู้ดูแลเริ่มต้นอยู่ในไฟล์ `scratch/initial-admin-link.txt` ซึ่งถูก ignore จาก Git
- ลิงก์เชิญใช้ได้ครั้งเดียวภายใน 7 วัน เมื่อเปิดแล้วระบบสร้าง session 7 วันในเบราว์เซอร์นั้น
- หากต้องการให้คนอื่นเข้าจากอินเทอร์เน็ต ต้องกำหนด hosting, HTTPS และโดเมนก่อน ลิงก์ `localhost` ใช้ได้เฉพาะเครื่องนี้

## คำสั่งพัฒนา

```text
npm install
npm run build
npm test
```

ไฟล์ `.env` ใช้ค่าจริงเฉพาะเครื่องและไม่เข้า Git ให้เริ่มจาก `.env.example` ฐานข้อมูลสร้างจาก `api/migrations/001_core.sql`

## ตำแหน่งโปรเจกต์

C:/AppServ/www/Workboard — Git แยกจาก CRM_ERP_V4 และยังไม่ได้เชื่อม remote
ระบบใช้ React + TypeScript + Vite + Tailwind / PHP + PDO / MySQL ตาม lockfile และ migration ใน repository นี้

## รายงานและปฏิทินประชุม

เข้า http://localhost/Workboard/?view=report เพื่ออ่านรายงานตามดีไซน์ Variant C หรือเลือก ปฏิทิน / ประชุม จากเมนู

1. เลือกวันที่และกด + บันทึกประชุม
2. เลือกโปรเจกต์ ใส่หัวข้อ และวางข้อความสรุปจาก AI หรือบันทึกของคุณ
3. ดูแท็บหน้าอ่าน ระบบจัดหัวข้อ รายการ เช็กลิสต์และตารางให้โดยไม่เปลี่ยนเนื้อหา
4. บันทึกเพื่อเก็บในฐานข้อมูล รายงานใหม่เห็นเฉพาะทีม; ติ๊กเผยแพร่หากต้องการให้ผู้ชมโปรเจกต์อ่านได้

การจัดรูปแบบทำในระบบ ไม่ต้องใช้ AI API key การให้ AI ตรวจ Git/FTP ยังอยู่ในแผนระยะถัดไป
ติดตั้งฐานข้อมูลใหม่ต้องรัน 001_core.sql, 002_meetings.sql แล้ว 003_permanent_links.sql ตามลำดับ (ALTER ต้องใช้บัญชีที่มีสิทธิ์ schema ไม่ใช่ workboard_app)
ทดสอบเพิ่ม: node tests/report-format.mjs, node tests/presentation.mjs และ node tests/calendar-items.mjs

## ลิงก์ถาวร

หน้าการเข้าถึงสร้างลิงก์ได้สองแบบ: ลิงก์ถาวร (ค่าเริ่มต้น ใช้ซ้ำได้ ไม่มีวันหมดอายุ) และลิงก์ใช้ครั้งเดียว 7 วัน ระบบเก็บเฉพาะ hash จึงแสดงลิงก์เต็มได้ครั้งเดียวตอนสร้าง ต้องคัดลอกเก็บไว้เอง
กด ปิดลิงก์ เพื่อปิดเฉพาะลิงก์นั้น ทุกเครื่องที่เข้าผ่านลิงก์นั้นจะออกจากระบบทันที กด + ลิงก์ถาวรใหม่ เพื่อออกลิงก์ใหม่ให้สมาชิกเดิมโดยสิทธิ์เท่าเดิม ลิงก์ที่ใช้เข้าอยู่ตอนนี้ปิดเองไม่ได้ Session หนึ่งครั้งอยู่ได้ 7 วัน เมื่อหมดให้เปิดลิงก์ถาวรเดิมอีกครั้ง
การเปิดลิงก์ถูกจำกัด 30 ครั้งต่อ 10 นาทีต่อ IP (รวมการรัน tests/api.mjs)

## Production (VPS)

URL: https://larksuite.prima49.com (ต้องมี DNS A record `larksuite` → 187.77.127.28 ที่ผู้ให้บริการ DNS ของ prima49.com)
โค้ดบน server: /opt/workboard (ส่งด้วย `git archive` จาก commit ที่ push แล้ว ไม่มี credentials GitHub บน server)
รันด้วย `docker compose` ใน /opt/workboard/deploy: `workboard-app` (PHP 8.3 + Apache) และ `workboard-db` (MariaDB 10.11 ไม่มีพอร์ตสาธารณะ) ค่าลับอยู่ใน deploy/.env และ deploy/app.env บน server เท่านั้น
Caddy ของ workspec ส่งต่อ larksuite.prima49.com → workboard-app:80 ผ่าน network edge (block อยู่ใน deploy/Caddyfile.snippet)
สำรองข้อมูล: /etc/cron.d/workboard-backup รัน deploy/backup.sh ทุกวัน 03:15 เก็บ 14 วันที่ /opt/backups/workboard
Migration ใหม่หลังจากนี้: รันด้วย root ใน workboard-db (initdb ทำงานเฉพาะตอน volume ว่าง)
ทดสอบ API กับ server: เปิด tunnel `ssh -L 8095:127.0.0.1:8095 root@187.77.127.28` แล้ว `WORKBOARD_API=http://127.0.0.1:8095/api/v1 WORKBOARD_ORIGIN=https://larksuite.prima49.com WORKBOARD_SQL_SSH=root@187.77.127.28 node tests/api.mjs` (สร้างข้อมูลทดสอบที่ถูก archive/revoke ในฐานจริง)
