# สถานะงาน

อัปเดต: 2026-09-18

## เสร็จแล้ว

- [x] ตรวจว่า C:/AppServ/www/Workboard ยังไม่มีอยู่ก่อนสร้าง
- [x] สร้างโฟลเดอร์แยกจาก ERP และเอกสารต่อเนื่อง
- [x] รวบรวมข้อกำหนด UI จากต้นแบบและ feedback ทั้งหมด
- [x] จัดทำ implementation_plan.md พร้อมขอบเขตสิทธิ์/API/AI และเกณฑ์รับงาน
- [x] ตรวจ runtime: Node 22.16, PHP 7.3.10 และ MySQL 8.0.17
- [x] Scaffold React/TypeScript/Vite/Tailwind + PHP API และสร้าง production build
- [x] สร้างฐานข้อมูล Workboard แยกและ migration `api/migrations/001_core.sql`
- [x] ทำลิงก์เชิญ 256-bit แบบใช้ครั้งเดียว เก็บเฉพาะ hash และแลกเป็น HttpOnly session 7 วัน
- [x] ทำสิทธิ์ admin/editor/viewer รายโปรเจกต์และ viewer allowlist response
- [x] ทำ task CRUD, deadline บังคับ, optimistic version conflict และ event history
- [x] ทำ Kanban แบบลากแล้ว persist พร้อม rollback เมื่อ API ปฏิเสธ
- [x] ทำ compact UI, right drawer, checklist และหน้าจัดการโปรเจกต์/สิทธิ์
- [x] ทดสอบ API integration, PHP syntax, production build และ web-root protection

## กำลังรอ

- [x] ผู้ใช้อนุมัติแผนและเลือกเข้าด้วยลิงก์ลับแทน login

## ลำดับถัดไป

- [ ] เพิ่ม touch/keyboard status control สำหรับอุปกรณ์ที่ลากการ์ดไม่สะดวก
- [x] เพิ่มภาพรวมและรายงานสัปดาห์พร้อมตัวกรองโปรเจกต์/ช่วงเวลา
- [ ] เพิ่มตัวกรองผู้รับผิดชอบ
- [ ] แยก evidence เป็นรายการแนบที่มี source และ checked_at แทนข้อความก้อนเดียว
- [ ] ทำ AI service API + observation/proposal review พร้อม idempotency
- [ ] ต่อ Git/deployment readers หลังระบุ repository, branch, server และวิธีเก็บ credentials
- [ ] กำหนด hosting/HTTPS/โดเมนและคู่มือ backup/restore ก่อนเปิดให้คนนอกจริง

## ความหมายของสถานะ

Phase 1 vertical slice ทำงานบน local และผ่าน integration test แล้ว
Git local แยกจาก ERP; ไม่มี remote และยังไม่ได้ deploy ภายนอก
AI/Git/FTP เป็นงานระยะถัดไปและต้องใช้ข้อมูลเป้าหมายจริงก่อนเชื่อมต่อ

- [x] ยืนยัน Git root เป็น C:/AppServ/www/Workboard บน branch main แยกจาก ERP

- [x] ลิงก์เดียวเลือกหลายโปรเจกต์หรือทุกโปรเจกต์ที่มีตอนนี้ได้ โดยคงสิทธิ์ viewer/editor
- [x] ย่อหน้าจัดการสิทธิ์ รวมสมาชิกคนละแถว ซ่อนรายการยกเลิกแล้ว และพับฟอร์มสร้างโปรเจกต์

- [x] นำโครงรายงาน Variant C กลับมา พร้อมภาพรวมและรายงานสัปดาห์จากงานจริง
- [x] เพิ่มปฏิทินรายเดือนและรายงานประชุม ผูกกับวันที่/โปรเจกต์ บันทึกถาวร
- [x] จัดรูปแบบข้อความสรุป AI/Markdown เป็นหน้าอ่าน พร้อมเก็บต้นฉบับ
- [x] รายงานประชุมเฉพาะทีมเป็นค่าเริ่มต้น เผยแพร่ให้ viewer ได้ตามสิทธิ์โปรเจกต์
- [x] ทดสอบสิทธิ์รายงาน วันที่ การแก้ชนกัน ประวัติ และ safe rendering
- [x] ตรวจ UI ในเบราว์เซอร์จริงที่ 320/375/414/768/1440px เทียบต้นแบบ Variant C (Playwright, ข้อมูล QA ชั่วคราวถูก archive แล้ว)
- [x] แก้ toolbar บีบ select/ค้นหาจนใช้ไม่ได้บนมือถือ, scrollbar แนวตั้งใน toolbar, checkbox ขนาดผิด และปุ่มยกเลิกสิทธิ์เล็กเกินไป
- [x] แก้การนับความยาวข้อความเป็นไบต์ (strlen) ทำให้ชื่องานภาษาไทยถูกจำกัดราว 80 ตัวอักษร เปลี่ยนเป็น mb_strlen
- [x] หน้าอ่านประชุมแสดงรายการซ้อนและเช็กลิสต์ไม่มี bullet ซ้ำ; ไอคอนเมนูเป็น SVG ตามต้นแบบ

- [x] ลิงก์ถาวร: ใช้ซ้ำได้ ไม่มีวันหมดอายุ ปิดรายลิงก์ได้ (ปิดแล้ว session จากลิงก์นั้นหลุดทันที) และออกลิงก์ใหม่ให้สมาชิกเดิมได้ migration 003 รัน local แล้ว
- [x] ปฏิทินแบบ WorkAlljob/Lark: แถบซ้าย (ปฏิทินย่อ, วันที่เลือก, ตัวกรองประเภท/โปรเจกต์) + มุมมองเดือน/สัปดาห์ แสดงประชุมและงาน (วันเริ่มใช้, งานเปิดใช้แล้วตามวันที่ปล่อยจริง) +N เพิ่มเติมและกางสัปดาห์ได้
