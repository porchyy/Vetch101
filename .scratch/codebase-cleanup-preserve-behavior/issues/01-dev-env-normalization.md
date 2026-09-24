# 01: ปรับสภาพแวดล้อมการพัฒนาให้เป็นมาตรฐาน & ตรวจสอบ baseline การทดสอบ

**What to build:** ปรับสภาพแวดล้อมและเอกสารของนักพัฒนาให้ clone โปรเจ็กต์ไปเครื่องใดก็สามารถทดสอบและบิลด์ได้ทันทีโดยไม่ติดขัดเรื่องพาธเฉพาะเครื่อง สคริปต์เริ่มทำงานซ้ำซ้อน หรือคำสั่งทดสอบไม่ตรงกับความจริง พร้อมทั้งยืนยันผลการรัน automated test suites เดิมเพื่อใช้เป็น baseline

**Blocked by:** None (can start immediately)

**Status:** completed

- [x] ลบพาธ `target-dir` เฉพาะเครื่องออกจาก `src-tauri/.cargo/config.toml` เพื่อให้ใช้ default cargo target หรือ environment variable
- [x] ปรับ `run.bat` ให้เรียกใช้งาน `start.bat` สั้น ๆ เพื่อให้ implementation สคริปต์เริ่มทำงานอยู่ที่ `start.bat` เพียงแห่งเดียว
- [x] ปรับปรุง `README.md` ให้คำสั่งทดสอบอ้างอิง `npm test` และแยกการระบุเวอร์ชันซอร์สโค้ดปัจจุบัน (`0.2.2`) กับเวอร์ชัน release ที่เผยแพร่แล้ว (`0.2.0`) ให้ชัดเจน
- [x] รันการทดสอบ baseline ทั้งฝั่ง frontend (`npm test`) และ backend Rust (`cargo test`) และบันทึกผลว่าผ่านครบถ้วน
