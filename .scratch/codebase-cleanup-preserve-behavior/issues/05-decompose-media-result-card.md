# 05: แยก Subviews ของ MediaResultCard & ซิงค์ Quality Presets ให้ตรงกับ Allowlist

**What to build:** คอมโพเนนต์แสดงผลผลการตรวจสอบสื่อแยกขอบเขตการแสดงผลระหว่าง Video และ Photo Album อย่างชัดเจน ทำให้อ่านและดูแลได้ง่ายขึ้น พร้อมทั้งปรับรายการ quality presets บน UI ให้ตรงกับ allowlist ของ backend Rust เพื่อป้องกันไม่ให้ผู้ใช้เลือกตัวเลือกที่ backend ปฏิเสธ

**Blocked by:** 02: แก้การส่งต่อ Browser Target & ลบการแจ้งเตือนดาวน์โหลดรูปซ้ำ

**Status:** completed

- [x] แยก subviews สำหรับ Video branch และ Photo branch ออกจาก `src/components/MediaResultCard.tsx` โดยรักษา Card Shell และ props contract เดิมไว้ทั้งหมด
- [x] คงฟังก์ชันการทำงานเดิมครบถ้วน: เลือก resolution, เลือก audio format (MP3/WAV), เลือกภาพ/อัลบั้มรูป, direct stream indicator, และปุ่มดาวน์โหลด
- [x] ตรวจสอบและซิงค์รายการ quality presets ที่ frontend เสนอกับ allowlist ใน `src-tauri/src/engine/` ให้สอดคล้องกัน โดยไม่ลดทอนการตรวจสอบความปลอดภัยของ input บน Rust boundary
- [x] Frontend tests และ UI component tests ทำงานผ่านอย่างถูกต้อง
