# Vetch101

แอปพลิเคชัน Windows สำหรับดาวน์โหลดวิดีโอและเสียง (MP3/MP4) สำหรับใช้งานส่วนตัว พัฒนาด้วย Tauri v2 + React 19 + Rust โดยทำงานแบบ Standalone ไม่ต้องเปิด Node server, Terminal หรือเบราว์เซอร์

---

## 🚀 การเปิดใช้งาน

เปิดใช้งานได้ 3 วิธีตามความสะดวก:

1. **เปิดตรงจากไฟล์ .exe**: ดับเบิลคลิก `Vetch101.exe` ที่โฟลเดอร์หลักของโปรเจกต์ หรือใน `dist-desktop\Vetch101.exe`
2. **รันผ่าน Batch Script**: ดับเบิลคลิก `start.bat` หรือ `quick-run.bat`
3. **ติดตั้งลงในเครื่อง (ตัวเลือกเสริม)**: ดับเบิลคลิกไฟล์ติดตั้งในโฟลเดอร์ `dist-desktop\`:
   - `Vetch101_0.1.0_x64-setup.exe` (NSIS Setup Wizard)
   - `Vetch101_0.1.0_x64_en-US.msi` (Windows Installer MSI)

---

## 🛠️ เครื่องมือหลักที่แอปใช้ (yt-dlp และ FFmpeg)

แอปจะตรวจหา `yt-dlp`, `ffmpeg`, และ `ffprobe` อัตโนมัติจาก:
1. โฟลเดอร์ประจำแอป: `%LOCALAPPDATA%\Vetch101\bin\`
2. ตำแหน่งที่ติดตั้งผ่าน WinGet
3. System PATH ของ Windows

### การติดตั้งเครื่องมือผ่าน WinGet (หากยังไม่มีในเครื่อง):
```powershell
winget install --id yt-dlp.yt-dlp -e
winget install --id Gyan.FFmpeg.Essentials -e
```

### การอัปเดต yt-dlp:
- สามารถกดปุ่ม **"อัปเดต yt-dlp"** ที่มุมขวาบนของแอปได้ตลอดเวลา
- แอปจะตรวจสอบความถูกต้องของไฟล์ใหม่ก่อนนำมาใช้งาน และป้องกันการกดอัปเดตระหว่างดาวน์โหลด

---

## ✨ ฟังก์ชันเด่น

- **ตรวจจับลิงก์ซ้อน (Double URL Prevention)**: เมื่อวาง URL ใหม่จะแทนที่ URL เดิมอัตโนมัติ และตรวจจับกรณีมีลิงก์ซ้อนกันทั้งใน Frontend และ Rust
- **ความละเอียดที่ตรงตามจริง**: แสดงเฉพาะความละเอียดที่วิดีโอนั้นมีจริง (เช่น 4K, 2K, 1080p, 720p, 480p) และมีตัวเลือกแปลงเป็น MP3
- **สถานะจริง (Real-time True Progress)**: อ่าน stream output จาก yt-dlp แบบ non-blocking แสดงเปอร์เซ็นต์ ความเร็ว และเวลาที่เหลือจริง ไม่ใช้ตัวนับเวลาสมมุติ
- **จัดการโฟลเดอร์ปลายทาง**: จดจำโฟลเดอร์ที่บันทึก รองรับชื่อไฟล์และโฟลเดอร์ภาษาไทย พร้อมปุ่มเปิดโฟลเดอร์ใน Windows Explorer ทันที
- **ความปลอดภัยของ Process**: สั่งยกเลิกงานได้ทันทีโดยหยุด Subprocess Tree ทั้ง yt-dlp และ FFmpeg ไม่ทิ้ง process ค้าง
- **ประวัติการดาวน์โหลด**: จัดเก็บประวัติเฉพาะในเครื่อง (Local Storage) สามารถกดโหลดซ้ำหรือล้างประวัติได้

---

## 🧪 การทดสอบระบบ (Automated Tests)

```powershell
# ทดสอบโมดูล Rust ทั้งหมด (URL validator, output parser, format detector)
cd src-tauri
cargo test --lib

# ทดสอบฟังก์ชันตรวจสอบ URL ฝั่ง Frontend
node --experimental-strip-types --test tests/video-url.test.mjs

# ทดสอบบิลด์แอปพลิเคชัน
npm run build
```
