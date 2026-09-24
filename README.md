# Vetch101

[![Release](https://img.shields.io/github/v/release/porchyy/Vetch101?color=blue&logo=github)](https://github.com/porchyy/Vetch101/releases/latest)
[![Platform](https://img.shields.io/badge/platform-Windows%2010%20%7C%2011%20(x64)-blue?logo=windows)](https://github.com/porchyy/Vetch101/releases)
[![Tauri](https://img.shields.io/badge/Tauri-v2-FFC131?logo=tauri&logoColor=white)](https://v2.tauri.app/)
[![Rust](https://img.shields.io/badge/Rust-2021-DEA584?logo=rust&logoColor=white)](https://www.rust-lang.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)

แอปพลิเคชัน Windows สำหรับดาวน์โหลดวิดีโอและเสียง (MP4 / MP3) สำหรับใช้งานส่วนตัว พัฒนาด้วย **Tauri v2 + React 19 + Rust** ทำงานแบบ **100% Standalone** โดยตรงบนคอมพิวเตอร์ของคุณ ไม่ต้องเปิด Command Prompt, Terminal หรือรัน Background Server ใดๆ

---

## 📦 ดาวน์โหลดเวอร์ชันล่าสุด (Downloads - v0.2.3)

สามารถดาวน์โหลดไฟล์พร้อมใช้งานได้จากหน้า [GitHub Releases v0.2.3](https://github.com/porchyy/Vetch101/releases/tag/v0.2.3):

| รูปแบบการใช้งาน | ชนิดไฟล์ | ลิงก์ดาวน์โหลดโดยตรง | คำแนะนำการใช้งาน |
| :--- | :---: | :---: | :--- |
| **All-in-One Portable (แนะนำ)** | `.zip` | [ดาวน์โหลด Portable ZIP](https://github.com/porchyy/Vetch101/releases/download/v0.2.3/Vetch101_0.2.3_x64-portable.zip) | แตกไฟล์แล้วเปิด `Vetch101.exe` ได้ทันที รวม `yt-dlp` และ `FFmpeg` พร้อมใช้ในตัว |
| **One-Click Installer** | `.exe` | [ดาวน์โหลด Setup Installer](https://github.com/porchyy/Vetch101/releases/download/v0.2.3/Vetch101_0.2.3_x64-setup.exe) | ตัวติดตั้งเดี่ยวอัตโนมัติ สร้างไอคอนบน Desktop พร้อมใช้งานทันทีในคลิกเดียว |

---

## ⚡ วิธีเริ่มต้นใช้งานแบบง่ายที่สุด (Quick Start)

### แบบที่ 1: Portable (ไม่ต้องติดตั้ง สะดวกที่สุด)
1. ดาวน์โหลดไฟล์ [Vetch101_0.2.3_x64-portable.zip](https://github.com/porchyy/Vetch101/releases/download/v0.2.3/Vetch101_0.2.3_x64-portable.zip)
2. แตกไฟล์ ZIP ออกมาไว้ในโฟลเดอร์ที่ต้องการ
3. ดับเบิลคลิกที่ไฟล์ **`Vetch101.exe`** เริ่มใช้งานได้ทันที (มีเครื่องมือครบในโฟลเดอร์ ไม่ต้องโหลดอะไรเพิ่ม)

### แบบที่ 2: ติดตั้งลงเครื่อง (มีไอคอนหน้าจอ Desktop)
1. ดาวน์โหลดไฟล์ [Vetch101_0.2.3_x64-setup.exe](https://github.com/porchyy/Vetch101/releases/download/v0.2.3/Vetch101_0.2.3_x64-setup.exe)
2. ดับเบิลคลิกไฟล์ตัวติดตั้ง กด "Next" จนเสร็จสิ้น
3. เปิดใช้งานผ่านไอคอน **Vetch101** บนหน้าจอ Desktop ของคุณได้ทันที

---

## 🌟 จุดเด่น: รวมทุกอย่างในที่เดียว (All-in-One & 100% Standalone)

Vetch101 ออกแบบมาเพื่อความง่ายสูงสุด **เปิดแอปเดียวจบ ใช้งานได้ทันที ไม่ต้องลงโปรแกรมหรือเครื่องมืออื่นเพิ่มเติม**:

- **ไม่ต้องลงโปรแกรมเพิ่ม**: ไม่ต้องติดตั้ง WinGet, Python, Node.js หรือตั้งค่า Environment PATH ใดๆ ทั้งสิ้น
- **ไม่ต้องเปิด Terminal / Command Prompt**: ใช้งานผ่านหน้าต่างโปรแกรมที่สวยงาม วางลิงก์แล้วกดดาวน์โหลดได้ทันที
- **อัปเดตเครื่องมือได้ในคลิกเดียว**: มีปุ่มกด **"อัปเดต yt-dlp"** อยู่ที่มุมขวาบน โปรแกรมจะจัดการอัปเดตให้เองอัตโนมัติ
- **ติดตั้งเครื่องมือจากในแอป**: ถ้า `yt-dlp`, `FFmpeg` หรือ `FFprobe` ขาด กด **"ติดตั้งเครื่องมือ"** ที่มุมขวาบน แอปจะดาวน์โหลดจากผู้เผยแพร่ ตรวจ SHA-256 แล้วติดตั้งไว้ในโฟลเดอร์ข้อมูลของแอป
- **ปลอดภัย ไร้ Process ตกค้าง**: มีระบบจัดการ Job Object บน Windows เมื่อปิดหน้าต่างแอป กระบวนการทำงานเบื้องหลังจะถูกปิดอย่างหมดจด ไม่กินแรมเครื่อง

---

## ✨ ฟังก์ชันเด่น

- **☀️/🌙 ระบบสลับธีม (Dual Theme System)**: สลับธีมมืด (Dark Slate) และธีมสว่าง (Terracotta Cream) ได้ทันทีที่มุมขวาบน สบายตา จดจำค่าอัตโนมัติ
- **🐾 น้องแมวพิกเซลเพื่อนร่วมทาง (Pixel Cat Mascot)**: แอนิเมชันแมว 16-bit มุมขวาล่าง ตอบสนองตามสถานะแอป 5 อารมณ์ (Idle, Inspecting, Downloading, Success, Error) พร้อมปุ่มเปิด/ปิดด้วยไอคอนอุ้งเท้า
- **🌐 ดึง Session จากเบราว์เซอร์จริง & หลบ Anti-Bot (Browser Session Handoff)**: เชื่อมต่อ Cookie จากเบราว์เซอร์ในเครื่อง (Chrome, Edge, Brave, Firefox) เพื่อดาวน์โหลดสื่อที่ติดการยืนยันตัวตนหรือจำกัดอายุ
- **⚡ Direct Stream Ingestion**: รองรับการวางลิงก์สตรีมตรงอย่าง `.m3u8` (HLS) หรือ `.mpd` (DASH) พร้อมระบบตั้งชื่อไฟล์ตามเวลาอัตโนมัติ
- **📸 ดาวน์โหลดอัลบั้มรูปภาพ (Photo Album Downloads)**: รองรับโพสต์รูปภาพหลายรูป (เช่น TikTok Photo Slides) พร้อมพรีวิวรูปภาพ เลือกเฉพาะรูปที่ต้องการ และเลือกแปลงเป็น **JPG** หรือ **PNG**
- **🎵 ดาวน์โหลดเฉพาะเสียง (MP3 & WAV)**: รองรับการสกัดเสียงคุณภาพสูงทั้งรูปแบบ MP3 (ทั่วไป) และ WAV (สำหรับงานตัดต่อเสียง)
- **⚡ ตรวจสอบลิงก์อัตโนมัติ (Auto-Inspect)**: เพียงวางลิงก์ หรือลากมาวาง (Drag & Drop) ระบบจะเริ่มตรวจสอบสื่อให้อัตโนมัติทันที
- **📊 สถานะจริง (Real-time True Progress)**: อ่าน stream output จาก yt-dlp แบบ non-blocking แสดงเปอร์เซ็นต์ ความเร็ว และเวลาที่เหลือจริง
- **📁 จัดการโฟลเดอร์ปลายทาง**: จดจำโฟลเดอร์ที่บันทึก รองรับชื่อไฟล์และโฟลเดอร์ภาษาไทย พร้อมปุ่มเปิดโฟลเดอร์ใน Windows Explorer ทันที
- **🕒 ประวัติการดาวน์โหลด**: จัดเก็บประวัติเฉพาะในเครื่อง (Local Storage) สามารถกดโหลดซ้ำหรือล้างประวัติได้
- **🔔 Windows Notification**: แจ้งเตือนเมื่อดาวน์โหลดเสร็จสมบูรณ์ สะอาด ไม่เด้งซ้ำซ้อน

## การพัฒนาและแพ็กแอป

`npm run tauri dev` เปิดแอป Desktop พร้อม Vite สำหรับพัฒนา UI เท่านั้น ตัวแอปที่บิลด์แล้วฝังไฟล์ UI และเรียก Rust ผ่าน IPC โดยไม่มี Express, API proxy หรือ localhost backend

`npm run release` เรียก `npm run tauri build`, ตรวจ artifacts, คัดลอก EXE + DLL ไปโฟลเดอร์หลัก/`dist-desktop`, คัดลอก NSIS และตรวจ SHA-256 ก่อนทดสอบเปิด/ปิดจากปลายทางทั้งสองแห่ง สคริปต์หยุดเมื่อ build/copy/check ล้มเหลวหรือมีแอป/Cargo ทำงานอยู่ ไม่ปิดงานดาวน์โหลดของผู้ใช้ ดู log ที่ `logs/release.log`

การตรวจ portable ยืนยัน main window และ graceful close ด้วย Windows process API; ไม่ใช่การตรวจหน้าจอทุกปุ่มหรือการทดสอบ installer ใช้ `scripts/test-portable.ps1 -Directories <โฟลเดอร์ที่ติดตั้ง>` เพื่อตรวจเปิดหลังติดตั้งแยกต่างหาก

`build.rs` ป้องกัน GCC 16 เพิ่ม manifest ซ้ำ โดยปรับ endfile specs เฉพาะ EXE นี้; manifest ของแอปคง Common Controls v6, longPathAware และ asInvoker ไว้ Release script จะไม่คัดลอกหากยังพบ `.rsrc merge failure`

สำหรับ Windows target (MSVC) ที่กำหนดใน `.cargo/config.toml` ต้องมี `WebView2Loader.dll` วางข้าง `Vetch101.exe` ทั้งในโฟลเดอร์หลักและ `dist-desktop/` ด้วย มิฉะนั้น EXE จะเปิดไม่ขึ้น ตัวติดตั้ง NSIS รวม DLL นี้ไว้แล้ว

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

# ทดสอบ automated tests ฝั่ง Frontend
npm test

# ทดสอบบิลด์แอปพลิเคชัน
npm run build
```

เมื่อปิดหน้าต่าง แอปปฏิเสธงานใหม่ ส่ง cancel และรอ cleanup สูงสุด 15 วินาที หากเกินเวลาจะรายงานใน stderr และออกด้วยรหัส 1; Windows Job Object ซึ่งติดตั้งก่อนเริ่ม Tauri จะเก็บกวาด process ลูกเมื่อออกหรือ crash รวมถึง metadata/probe ที่ยังค้าง การยกเลิกที่หยุด process tree ไม่สำเร็จจะรายงานข้อผิดพลาดและบล็อกงานใหม่จนเปิดแอปใหม่
