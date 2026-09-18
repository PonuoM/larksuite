# Workboard

ระบบติดตามงานหลายโปรเจกต์ของทีม: บอร์ด Kanban, ภาพรวม, รายงานสัปดาห์, ปฏิทินงานและรายงานประชุม และการให้สิทธิ์ด้วยลิงก์เชิญ

- เว็บจริง: https://larksuite.prima49.com
- Repository: https://github.com/PonuoM/larksuite

## เริ่มอ่านที่นี่

1. **[docs/HANDOFF.md](docs/HANDOFF.md)** — คู่มือส่งต่องาน: ตั้งเครื่อง dev, เทสต์, deploy, ฐานข้อมูล, backup/restore, ข้อควรระวังบน VPS และการให้ AI เชื่อมต่อข้อมูล
2. [AGENTS.md](AGENTS.md) — กติกาการทำงานใน repository นี้ (ทั้งคนและ AI)
3. [CONTEXT.md](CONTEXT.md) — เป้าหมาย คำศัพท์ และข้อสรุปจากเจ้าของระบบ
4. [implementation_plan.md](implementation_plan.md) — แผนระยะยาวและเกณฑ์รับงาน
5. [TASKS.md](TASKS.md) — งานที่ทำแล้วและงานถัดไป
6. [docs/WORKLOG.md](docs/WORKLOG.md) — บันทึกการทำงานและเหตุผลของการตัดสินใจ
7. [design.md](design.md) — แนวทางดีไซน์

## คำสั่งที่ใช้บ่อย

```text
npm install
npm run build                          build หน้าเว็บ (สำหรับ http://localhost/Workboard/)
node tests/api.mjs                     เทสต์ API
node tests/calendar-items.mjs          เทสต์ปฏิทิน
node scripts/issue-admin-link.mjs      ออกลิงก์ถาวรผู้ดูแล (เพิ่ม --remote root@187.77.127.28 สำหรับเว็บจริง)
```

## ใช้งานรายงานประชุม

1. เปิดเมนู **ปฏิทิน / ประชุม** เลือกวัน แล้วกด **+ บันทึกประชุม**
2. เลือกโปรเจกต์ ใส่หัวข้อ แล้ววางสรุปจาก AI หรือบันทึกของตัวเอง (รองรับ Markdown)
3. ดูแท็บ **หน้าอ่าน** ระบบจัดหัวข้อ รายการ เช็กลิสต์ และตารางให้โดยไม่เปลี่ยนเนื้อหา
4. บันทึก รายงานใหม่เห็นเฉพาะทีม ถ้าติ๊กเผยแพร่ ผู้ชมของโปรเจกต์นั้นจะอ่านได้

## Production

รายละเอียดการ deploy, อัปเดตเวอร์ชัน และดูแลฐานข้อมูลอยู่ใน [docs/HANDOFF.md](docs/HANDOFF.md) หัวข้อ 6–8
การเทสต์ API กับ server จริงผ่าน tunnel:

```text
ssh -L 18095:127.0.0.1:8095 root@187.77.127.28        (เปิดทิ้งไว้อีกหน้าต่าง)
WORKBOARD_API=http://127.0.0.1:18095/api/v1 WORKBOARD_ORIGIN=https://larksuite.prima49.com WORKBOARD_SQL_SSH=root@187.77.127.28 node tests/api.mjs
```

การเทสต์แบบนี้จะมีข้อมูลทดสอบที่ archive แล้วค้างอยู่ในฐานจริง ใช้เฉพาะตอนจำเป็น

## ต้นแบบดีไซน์

ต้นแบบอยู่ใน ERP เดิมที่ `C:/AppServ/www/CRM_ERP_V4/docs/prototypes/workboard/` ใช้อ้างอิงอย่างเดียว เป็นข้อมูลสาธิต ห้ามนำไปใช้เป็นข้อมูลจริง
