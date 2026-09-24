# 06: ระบุบทบาท Backend Pipeline ให้ชัดเจน & ลบสัญลักษณ์ที่ไม่ได้ใช้งาน

**What to build:** ปรับโค้ด backend ฝั่ง Rust ให้กระชับ สื่อความหมายตรงกับความเป็นจริง และไม่มีโค้ดที่ตายแล้ว (dead code) โดยระบุบทบาทของ `pipeline.rs` เป็น coordinator สำหรับ validate/lock/dispatch อย่างตรงไปตรงมา และลบ public functions/models ที่ไม่มีการเรียกใช้งานจริงในโปรเจ็กต์

**Blocked by:** 05: แยก Subviews ของ MediaResultCard & ซิงค์ Quality Presets ให้ตรงกับ Allowlist

**Status:** completed

- [x] ปรับบทบาทและ doc comments ของ `src-tauri/src/engine/pipeline.rs` ให้ตรงกับหน้าที่จริง (validate, hold download lock, dispatch to downloaders) โดยไม่เพิ่ม abstraction ที่ไม่จำเป็น
- [x] ตรวจสอบและลบ public wrappers ที่ไม่มี caller ใน codebase เช่น `run_photo_download`, `fetch_image_to_path`, `process_and_save_image` ใน `photo_downloader.rs`, `run_download` ใน `downloader.rs`, และ `PhotoDownloadResult` ใน `models.rs`
- [x] แก้ไข doc comments ที่ซ้ำซ้อนหรือไม่ตรงกับประเภทข้อมูลใน `src-tauri/src/engine/photo_extractor.rs`
- [x] ยืนยันว่า Rust unit tests, integration tests, และการทำงานของ IPC commands ทั้งหมดยังคอมไพล์ผ่านและทำงานได้ถูกต้องสมบูรณ์
