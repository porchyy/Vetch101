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
- กดปุ่ม **"อัปเดต yt-dlp"** ที่มุมขวาบนเมื่อไม่มีงานตรวจสอบ/ดาวน์โหลด
- ใช้คำสั่ง `yt-dlp -U` ของเครื่องมือเอง; Rust ล็อกอัปเดตและดาวน์โหลดด้วย mutex เดียวกันตั้งแต่เตรียมงานจน cleanup เสร็จ ไม่มี custom atomic updater

---

## ✨ ฟังก์ชันเด่น

- **ตรวจจับลิงก์ซ้อน (Double URL Prevention)**: เมื่อวาง URL ใหม่จะแทนที่ URL เดิมอัตโนมัติ และตรวจจับกรณีมีลิงก์ซ้อนกันทั้งใน Frontend และ Rust
- **ตัวเลือกความละเอียด**: มี preset จำกัดความสูงสูงสุด และตัวเลือก MP3; ยังต้องปรับรายการให้ตรงกับ formats ต้นทางจริง
- **สถานะจริง (Real-time True Progress)**: อ่าน stream output จาก yt-dlp แบบ non-blocking แสดงเปอร์เซ็นต์ ความเร็ว และเวลาที่เหลือจริง ไม่ใช้ตัวนับเวลาสมมุติ
- **จัดการโฟลเดอร์ปลายทาง**: จดจำโฟลเดอร์ที่บันทึก รองรับชื่อไฟล์และโฟลเดอร์ภาษาไทย พร้อมปุ่มเปิดโฟลเดอร์ใน Windows Explorer ทันที
- **ความปลอดภัยของ Process**: สั่งยกเลิกงานได้ทันทีโดยหยุด Subprocess Tree ทั้ง yt-dlp และ FFmpeg ไม่ทิ้ง process ค้าง
- **ประวัติการดาวน์โหลด**: จัดเก็บประวัติเฉพาะในเครื่อง (Local Storage) สามารถกดโหลดซ้ำหรือล้างประวัติได้
- **ลากลิงก์มาวาง**: ลากลิงก์จากเบราว์เซอร์หรือข้อความ URL เดียวมาวางที่ใดก็ได้ในหน้าต่าง แล้วกดตรวจสอบลิงก์ ไม่รับไฟล์ ลิงก์หลายอัน หรือการลากวางระหว่างตรวจสอบ/ดาวน์โหลด
- **Windows Notification**: แจ้งเตือนหลังดาวน์โหลดและตรวจสอบไฟล์สำเร็จ ผ่าน Tauri Notification Plugin; บน Windows ต้องติดตั้งผ่าน Setup/MSI และเปิดการแจ้งเตือนของแอปใน Windows (ดู [เอกสาร Tauri](https://v2.tauri.app/plugin/notification/))
- **หน้าต่าง Desktop**: ย่อหน้าต่างลง taskbar ได้ตามปกติและดาวน์โหลดต่อได้ ไม่มีระบบซ่อนไป tray; ใช้ไอคอนเดียวกับแอปและฟอนต์ใน Windows โดยไม่โหลด Google Fonts

## การพัฒนาและแพ็กแอป

`npm run tauri dev` เปิดแอป Desktop พร้อม Vite สำหรับพัฒนา UI เท่านั้น ตัวแอปที่บิลด์แล้วฝังไฟล์ UI และเรียก Rust ผ่าน IPC โดยไม่มี Express, API proxy หรือ localhost backend

`npm run release` เรียก `npm run tauri build`, ตรวจ artifacts, คัดลอก EXE + DLL ไปโฟลเดอร์หลัก/`dist-desktop`, คัดลอก NSIS/MSI และตรวจ SHA-256 ก่อนทดสอบเปิด/ปิดจากปลายทางทั้งสองแห่ง สคริปต์หยุดเมื่อ build/copy/check ล้มเหลวหรือมีแอป/Cargo ทำงานอยู่ ไม่ปิดงานดาวน์โหลดของผู้ใช้ ดู log ที่ `logs/release.log`

การตรวจ portable ยืนยัน main window และ graceful close ด้วย Windows process API; ไม่ใช่การตรวจหน้าจอทุกปุ่มหรือการทดสอบ installer ใช้ `scripts/test-portable.ps1 -Directories <โฟลเดอร์ที่ติดตั้ง>` เพื่อตรวจเปิดหลังติดตั้งแยกต่างหาก

`build.rs` ป้องกัน GCC 16 เพิ่ม manifest ซ้ำ โดยปรับ endfile specs เฉพาะ EXE นี้; manifest ของแอปคง Common Controls v6, longPathAware และ asInvoker ไว้ Release script จะไม่คัดลอกหากยังพบ `.rsrc merge failure`

สำหรับ GNU target ที่ใช้อยู่ ต้องคัดลอก `WebView2Loader.dll` จากโฟลเดอร์ release ไปวางข้าง `Vetch101.exe` ทั้งในโฟลเดอร์หลักและ `dist-desktop/` ด้วย มิฉะนั้น EXE จะเปิดไม่ขึ้น ตัวติดตั้ง NSIS/MSI รวม DLL นี้ไว้แล้ว

ซากเว็บเดิม (`server/`, Docker และ Render config) ถูกย้ายไป `temp/web-archive/` ซึ่งถูกละเว้นจาก Git และการบิลด์ สำรองโค้ดเดิมยังอยู่ที่ branch `backup-pre-refactor`

---

## 🧪 การทดสอบระบบ (Automated Tests)

```powershell
# Offline regressions: URL, parser, output verification, shared lock และ Windows process tree
cd src-tauri
cargo test --lib

# Network integration เดิมยังอยู่ ต้องใช้ yt-dlp, FFmpeg และ YouTube ที่เข้าถึงได้
cargo test --test metadata_network
cd ..

# ทดสอบฟังก์ชันตรวจสอบ URL ฝั่ง Frontend
node --experimental-strip-types --test tests/video-url.test.mjs tests/video-input.test.mjs

# ทดสอบบิลด์แอปพลิเคชัน
npm run build
```

เมื่อปิดหน้าต่าง แอปปฏิเสธงานใหม่ ส่ง cancel และรอ cleanup สูงสุด 15 วินาที หากเกินเวลาจะรายงานใน stderr และออกด้วยรหัส 1; Windows Job Object ซึ่งติดตั้งก่อนเริ่ม Tauri จะเก็บกวาด process ลูกเมื่อออกหรือ crash รวมถึง metadata/probe ที่ยังค้าง การยกเลิกที่หยุด process tree ไม่สำเร็จจะรายงานข้อผิดพลาดและบล็อกงานใหม่จนเปิดแอปใหม่
