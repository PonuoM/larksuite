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
ติดตั้งฐานข้อมูลใหม่ต้องรัน 001_core.sql แล้ว 002_meetings.sql ตามลำดับ
ทดสอบเพิ่ม: node tests/report-format.mjs และ node tests/presentation.mjs
