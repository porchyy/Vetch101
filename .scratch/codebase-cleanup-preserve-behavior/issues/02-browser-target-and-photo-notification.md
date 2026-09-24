# 02: แก้การส่งต่อ Browser Target & ลบการแจ้งเตือนดาวน์โหลดรูปซ้ำ

**What to build:** ผู้ใช้สามารถเปลี่ยน Browser Target ก่อนเริ่มดาวน์โหลดแล้วงานดาวน์โหลดใช้ cookies/session จากเบราว์เซอร์เป้าหมายล่าสุดเสมอ และเมื่อดาวน์โหลด Photo Album สำเร็จ ผู้ใช้จะได้รับการแจ้งเตือนระดับ OS เพียงครั้งเดียวจาก command boundary

**Blocked by:** 01: ปรับสภาพแวดล้อมการพัฒนาให้เป็นมาตรฐาน & ตรวจสอบ baseline การทดสอบ

**Status:** completed

- [x] เพิ่ม `browser` เข้าใน dependency array ของ `startDownload` callback ใน `src/useDownloadSession.ts`
- [x] มี automated regression test ที่ยืนยันว่าการเปลี่ยน `browser` ระหว่าง inspection กับ download จะส่งค่า browser ใหม่ไปยัง IPC `start_download`
- [x] ลบการเรียก OS notification ซ้ำซ้อนภายใน `src-tauri/src/engine/photo_downloader.rs` โดยคงการแจ้งเตือนระดับคำสั่งไว้ที่ `src-tauri/src/commands.rs` เช่นเดียวกับวิดีโอ
- [x] Unit tests ของ Rust และ frontend tests ทำงานผ่านอย่างสมบูรณ์
