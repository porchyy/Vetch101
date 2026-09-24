# 07: ตรวจสอบ Regression รอบสุดท้าย & ปรับสถานะ Issue Notes ใน Scratch

**What to build:** ยืนยันความสมบูรณ์ของระบบหลังการจัดระเบียบโค้ดทั้งหมดว่าพฤติกรรมเดิมของผู้ใช้คงอยู่อย่างสมบูรณ์ 100% ผ่านชุดทดสอบครบวงจร และตรวจสอบโน้ตงานเก่าใน `.scratch/` เพื่อปรับปรุงสถานะให้ตรงตามความเป็นจริงของ codebase ปัจจุบัน

**Blocked by:** 03: ตรวจสอบ Engine Dependencies ในกระบวนการ Release & ตรวจความสมบูรณ์ของไฟล์แพ็ก, 04: แยก Orchestration ของ App & Engine Update ออกจากส่วนแสดงผล App.tsx, 06: ระบุบทบาท Backend Pipeline ให้ชัดเจน & ลบสัญลักษณ์ที่ไม่ได้ใช้งาน

**Status:** completed

- [x] รันการทดสอบและ build ทั้งหมด: TypeScript typecheck, frontend tests (`npm test`), Rust unit & integration tests (`cargo test`), และ build check
- [x] ทดสอบสคริปต์ smoke สำหรับ portable/native bundle เพื่อยืนยันว่าการแพ็กเกจทำงานได้สมบูรณ์
- [x] ตรวจสอบประวัติ acceptance criteria ของ issue notes ใน `.scratch/` ที่มีฟีเจอร์ลงโค้ดเรียบร้อยแล้ว และอัปเดตสถานะให้ถูกต้องตรงตามความเป็นจริงโดยไม่เหมาเปลี่ยนทั้งหมด
- [x] สรุปผลการปรับปรุงและการคงพฤติกรรมเดิมพร้อมทั้งจัดทำ commit
