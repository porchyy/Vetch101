# 03: ตรวจสอบ Engine Dependencies ในกระบวนการ Release & ตรวจความสมบูรณ์ของไฟล์แพ็ก

**What to build:** กระบวนการ Release สร้างไฟล์แจกจ่ายแบบ Portable และ Installer สำหรับ Windows ที่รับประกันว่ามี engine dependencies (`yt-dlp.exe`, `ffmpeg.exe`, `ffprobe.exe`) และ `WebView2Loader.dll` บรรจุอยู่ครบถ้วน โดยไม่พึ่งพาเครื่องมือที่บังเอิญติดตั้งอยู่บน PATH ของเครื่องผู้สร้างแพ็กเกจ

**Blocked by:** 01: ปรับสภาพแวดล้อมการพัฒนาให้เป็นมาตรฐาน & ตรวจสอบ baseline การทดสอบ

**Status:** completed

- [x] ปรับปรุง `scripts/release.ps1` ให้ตรวจสอบความพร้อมและตรวจนับไฟล์ engine dependencies ทั้ง 3 ตัวใน `dist-desktop/bin` ก่อนเริ่ม cargo/tauri build และก่อนแพ็ก ZIP
- [x] ตรวจสอบ exit code ของการสร้าง ZIP (เช่น คำสั่ง `tar`) ใน `scripts/release.ps1` ก่อนรายงานผลสำเร็จ
- [x] เพิ่มขั้นตอนการตรวจไฟล์ภายใน Portable ZIP ที่สร้างขึ้นจริง ว่ามี `bin/` ครบและมี executable ที่จำเป็น
- [x] สคริปต์ release และ smoke สามารถรันเพื่อตรวจสอบ artifact ได้อย่างถูกต้อง
