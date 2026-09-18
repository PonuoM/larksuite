# Workboard

ระบบติดตามงานหลายโปรเจกต์สำหรับทีม พร้อมผู้ชมภายนอกและการตรวจหลักฐานโดย AI

## สถานะปัจจุบัน

ตั้ง repository และเอกสารแล้ว ยังไม่มีระบบจริง / ฐานข้อมูล / API / การ Deploy ในโฟลเดอร์นี้
แผนระบบใหม่รออนุมัติก่อนเริ่มเขียนโค้ดตามกติกาที่ผู้ใช้ให้มา

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

## ตำแหน่งโปรเจกต์

C:/AppServ/www/Workboard — Git แยกจาก CRM_ERP_V4 ยังไม่ได้เชื่อม remote
React + TypeScript + Vite + Tailwind / PHP + PDO / MySQL เป็นข้อเสนอสำหรับการพัฒนา ไม่ใช่รายการ dependency ที่ติดตั้งแล้ว
