# Vetch101

[![Release](https://img.shields.io/github/v/release/porchyy/Vetch101?color=blue&logo=github)](https://github.com/porchyy/Vetch101/releases/latest)
[![Platform](https://img.shields.io/badge/platform-Windows%2010%20%7C%2011%20(x64)-blue?logo=windows)](https://github.com/porchyy/Vetch101/releases)
[![Tauri](https://img.shields.io/badge/Tauri-v2-FFC131?logo=tauri&logoColor=white)](https://v2.tauri.app/)
[![Rust](https://img.shields.io/badge/Rust-2021-DEA584?logo=rust&logoColor=white)](https://www.rust-lang.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)

แอปพลิเคชัน Windows สำหรับดาวน์โหลดวิดีโอและเสียง (MP4 / MP3) สำหรับใช้งานส่วนตัว พัฒนาด้วย **Tauri v2 + React 19 + Rust** ทำงานแบบ **100% Standalone** โดยตรงบนคอมพิวเตอร์ของคุณ ไม่ต้องเปิด Command Prompt, Terminal หรือรัน Background Server ใดๆ

---

## 📦 ดาวน์โหลดเวอร์ชันล่าสุด (Downloads)

ดาวน์โหลดได้ที่หน้า [GitHub Releases v0.2.0](https://github.com/porchyy/Vetch101/releases/tag/v0.2.0):

| รูปแบบการติดตั้ง | ชนิดไฟล์ | ลิงก์ดาวน์โหลดโดยตรง | รายละเอียด |
| :--- | :---: | :---: | :--- |
| **All-in-One Portable (แนะนำ)** | `.zip` | [ดาวน์โหลด Portable ZIP](https://github.com/porchyy/Vetch101/releases/download/v0.2.0/Vetch101_0.2.0_x64-portable.zip) | แตกไฟล์แล้วเปิด `Vetch101.exe` ใช้งานได้ทันที มี `yt-dlp` และ `FFmpeg` ในตัว |
| **Setup Wizard** | `.exe` | [ดาวน์โหลด Setup Installer](https://github.com/porchyy/Vetch101/releases/download/v0.2.0/Vetch101_0.2.0_x64-setup.exe) | ตัวติดตั้งมาตรฐาน สร้างไอคอนบน Desktop และ Start Menu อัตโนมัติ |
| **Windows Installer** | `.msi` | [ดาวน์โหลด MSI Package](https://github.com/porchyy/Vetch101/releases/download/v0.2.0/Vetch101_0.2.0_x64_en-US.msi) | ตัวติดตั้งสำหรับระบบ Enterprise / Windows Installer |

---

## 🚀 การเปิดใช้งาน (สำหรับผู้พัฒนา / ผู้ใช้ในเครื่อง)

เปิดใช้งานได้ 3 วิธีตามความสะดวก:

1. **เปิดตรงจากไฟล์ .exe**: ดับเบิลคลิก `Vetch101.exe` ที่โฟลเดอร์หลักของโปรเจกต์ หรือใน `dist-desktop\Vetch101.exe`
2. **รันผ่าน Batch Script**: ดับเบิลคลิก `start.bat` หรือ `quick-run.bat`
3. **ติดตั้งลงในเครื่อง**: ดับเบิลคลิกไฟล์ติดตั้งในโฟลเดอร์ `dist-desktop\`:
   - `Vetch101_0.2.0_x64-setup.exe` (NSIS Setup Wizard)
   - `Vetch101_0.2.0_x64_en-US.msi` (Windows Installer MSI)

---

## 🌟 ทำงานสมบูรณ์ในแอปเดียว (All-in-One & 100% Standalone)

Vetch101 ออกแบบมาเพื่อความง่ายสูงสุด **เปิดแอปเดียวจบ ใช้งานได้ทันที ไม่ต้องลงโปรแกรมหรือเครื่องมืออื่นเพิ่มเติม**:

- **ไม่ต้องลงโปรแกรมเพิ่ม**: ไม่ต้องติดตั้ง WinGet, Python, Node.js หรือตั้งค่า Environment PATH ใดๆ ทั้งสิ้น
- **ไม่ต้องเปิด Terminal / Command Prompt**: ใช้งานผ่านหน้าต่างโปรแกรมโดยตรง วางลิงก์แล้วกดดาวน์โหลดได้ทันที
- **อัปเดตเครื่องมือได้ในคลิกเดียว**: มีปุ่มกด **"อัปเดต yt-dlp"** อยู่ที่มุมขวาบนในหน้าต่างแอป โปรแกรมจะจัดการอัปเดตให้เองอัตโนมัติ
- **ปลอดภัย ไร้ Process ตกค้าง**: มีระบบจัดการ Process เมื่อปิดหน้าต่างแอป การทำงานเบื้องหลังจะถูกปิดอย่างสมบูรณ์ ไม่กินแรมเครื่อง

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
