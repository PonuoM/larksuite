# สถานะงาน

อัปเดต: 2026-09-18

## เสร็จแล้ว

- [x] ตรวจว่า C:/AppServ/www/Workboard ยังไม่มีอยู่ก่อนสร้าง
- [x] สร้างโฟลเดอร์แยกจาก ERP และเอกสารต่อเนื่อง
- [x] รวบรวมข้อกำหนด UI จากต้นแบบและ feedback ทั้งหมด
- [x] จัดทำ implementation_plan.md พร้อมขอบเขตสิทธิ์/API/AI และเกณฑ์รับงาน

## กำลังรอ

- [ ] ผู้ใช้ตรวจและอนุมัติ implementation_plan.md สำหรับระบบจริง

## ลำดับถัดไปหลังอนุมัติ

- [ ] ตรวจ runtime ของเครื่องและกำหนด dependency versions
- [ ] Scaffold frontend/backend และ environment example ที่ไม่มี secret จริง
- [ ] SQL migration สำหรับ Workboard database แยก
- [ ] Login + project membership + server-side authorization
- [ ] Task CRUD + required deadline + draggable persisted Kanban
- [ ] Concurrency control + audit events
- [ ] Team invitation + external viewer projection
- [ ] Drawer/checklist/evidence + overview/weekly report
- [ ] AI service API + observation/proposal review
- [ ] ต่อ Git/deployment readers หลังระบุเป้าหมายและ credentials

## ความหมายของสถานะ

Prototype UI ใน ERP มีแล้ว แต่ระบบ Workboard จริงยังไม่ได้ implement
Git local แยกแล้วเมื่อ bootstrap สำเร็จ; ไม่มี remote และไม่ได้ deploy
ห้ามติ๊ก Phase 1 ว่าเสร็จเพียงเพราะมีต้นแบบหรือแผน

- [x] ยืนยัน Git root เป็น C:/AppServ/www/Workboard บน branch main แยกจาก ERP
