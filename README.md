# Vetch101 - Universal Video & Audio Downloader 🚀

**Vetch101** เป็นระบบดาวน์โหลดวิดีโอและเสียงประสิทธิภาพสูง รองรับกว่า 1,000 แพลตฟอร์ม ทั้ง TikTok (ไม่มีลายน้ำ), YouTube, Facebook, Instagram, Twitter/X และอื่นๆ ใช้งานได้ทั้งในรูปแบบเว็บแอปพลิเคชัน (Web App) และโปรแกรมติดตั้งบนคอมพิวเตอร์ (Desktop App ด้วย Tauri)

---

## ✨ คุณสมบัติเด่น (Features)

- ⚡ **ดาวน์โหลดรวดเร็ว:** รองรับสตรีมตรงผ่าน CDN และ yt-dlp
- 🎵 **แยกไฟล์เสียง MP3:** แปลงและดาวน์โหลดเฉพาะเพลงหรือเสียงบรรยายในคลิกเดียว
- 🎬 **TikTok ไร้ลายน้ำ:** ดึงวิดีโอ TikTok คุณภาพสูงแบบไม่มีลายน้ำ
- 🖥️ **สถาปัตยกรรมแบบไฮบริด:**
  - **Web Mode:** รันผ่าน Node.js / Express + Vite React
  - **Desktop Mode:** รันผ่าน Tauri 2.0 (Rust) ขนาดกะทัดรัด กินแรมน้อย
  - **Cloud Ready:** มี `Dockerfile` และ `render.yaml` พร้อม Deploy ทันที
- 🎨 **Modern UI:** สวยงาม ใช้งานง่าย ออกแบบด้วย React 19, Tailwind CSS v4 และ Lucide Icons
- 📜 **ประวัติดาวน์โหลดล่าสุด:** บันทึกประวัติในเครื่อง ไม่เก็บข้อมูลส่วนตัว

---

## 📁 โครงสร้างโปรเจกต์ (Project Structure)

```text
Vetch101/
├── src/                # Frontend (React 19 + Vite + Tailwind CSS v4)
├── server/             # Backend API (Express.js + yt-dlp engine)
├── src-tauri/          # Desktop App Core (Rust + Tauri 2.0)
├── public/             # Static Assets & Icons
├── Dockerfile          # Multi-stage Docker build สำหรับ production
├── render.yaml         # Render Blueprint สำหรับ deploy ขึ้นคลาวด์
├── start.bat           # รันระบบ Web App (Backend + Frontend)
├── run.bat             # รัน Desktop App (Tauri dev mode)
└── package.json        # Frontend dependencies & scripts
```

---

## 🛠️ วิธีติดตั้งและเริ่มต้นใช้งาน (Getting Started)

### 1. ความต้องการของระบบ (Prerequisites)
- [Node.js](https://nodejs.org/) v18 ขึ้นไป
- [yt-dlp](https://github.com/yt-dlp/yt-dlp) ติดตั้งในระบบ (หรือใน PATH)
- [FFmpeg](https://ffmpeg.org/) (แนะนำสำหรับการรวมภาพและเสียงความละเอียดสูง)
- *(ทางเลือกสำหรับการพัฒนา Desktop)*: [Rust & Cargo](https://rustup.rs/)

### 2. ติดตั้ง Dependencies
```bash
# ติดตั้ง dependencies ฝั่ง Frontend
npm install

# ติดตั้ง dependencies ฝั่ง Backend
cd server
npm install
cd ..
```

### 3. รันโปรเจกต์

#### 🌐 วิธีที่ 1: รัน Web Mode (แนะนำ)
เปิดไฟล์ `start.bat` หรือรันคำสั่ง:
```bash
# Terminal 1: เริ่มต้น Backend (Port 3001)
cd server
node index.js

# Terminal 2: เริ่มต้น Frontend (Port 1420)
npm run dev
```
เปิดเบราว์เซอร์ที่ `http://localhost:1420`

#### 💻 วิธีที่ 2: รัน Desktop Mode (Tauri)
เปิดไฟล์ `run.bat` หรือรันคำสั่ง:
```bash
npm run tauri dev
```

---

## 🐳 การรันด้วย Docker

```bash
# Build image
docker build -t vetch101 .

# Run container
docker run -d -p 3001:3001 --name vetch101-app vetch101
```
เข้าใช้งานได้ทันทีที่ `http://localhost:3001`

---

## 🔒 ความปลอดภัยและความเป็นส่วนตัว

- ป้องกัน SSRF (Server-Side Request Forgery) ในระดับเน็ตเวิร์ก
- กรองชื่อไฟล์ป้องกัน Path Traversal และอักขระต้องห้ามของระบบปฏิบัติการ
- ไม่มีการเก็บข้อมูลประวัติการดาวน์โหลดของผู้ใช้ลงฐานข้อมูลกลาง

---

## 📄 ใบอนุญาต (License)
MIT License

