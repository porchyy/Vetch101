# Vetch101

เครื่องมือบันทึกวิดีโอและเสียงจากลิงก์ ใช้ได้ผ่านเว็บหรือแอป Windows (Tauri)

## เริ่มใช้งานบน Windows

ต้องมี **Node.js 22.12+**, **yt-dlp**, และ **FFmpeg** (รวม ffprobe สำหรับแปลงเสียง)

ติดตั้งเครื่องมือดาวน์โหลดด้วย WinGet:

```powershell
winget install --id yt-dlp.yt-dlp -e
winget install --id Gyan.FFmpeg.Essentials -e
```

เปิด Terminal ใหม่หลังติดตั้ง เพื่อให้ PATH อัปเดต โปรแกรมค้นหาแพ็กเกจ WinGet ให้อัตโนมัติด้วย

- **เว็บ:** ดับเบิลคลิก `start.bat` แล้วเปิด http://127.0.0.1:3001 ไฟล์นี้ติดตั้ง dependencies ที่ขาดและ build หน้าเว็บก่อนรัน ปิดด้วย Ctrl+C
- **เดสก์ท็อป:** ดับเบิลคลิก `run.bat` ต้องมี Rust, Windows build tools และ WebView2 ด้วย หน้าแอปเรียก Rust โดยตรง ไม่ต้องเปิด Node server
- ในแอป วางลิงก์ → ดูตัวเลือกดาวน์โหลด → เลือกวิดีโอหรือ MP3 → บันทึก
- ฝั่งเว็บรอเตรียมไฟล์ก่อนเริ่มรับข้อมูล จึงไม่แสดงเปอร์เซ็นต์สมมติ สามารถกดยกเลิกได้
- TikTok บางรายการเปิดไฟล์ CDN ในแท็บใหม่ ให้บันทึกจากเมนูเบราว์เซอร์ เส้นทางนี้ไม่มีการรับรองว่าไฟล์ถูกบันทึกแล้วและไม่เพิ่มประวัติสำเร็จ

## พัฒนาและตรวจสอบ

```powershell
npm ci
npm ci --prefix server
# เปิดคนละ Terminal
node server/index.js
npm run dev
# เปิด http://localhost:1420
```

```powershell
npm run build
npm test --prefix server
cd src-tauri
cargo test --lib
```

ชุดทดสอบครอบคลุม URL/DNS/IP ภายใน, HTTP proxy, format selection, process errors/cancellation และ API ที่ไม่ส่งไฟล์ว่างเมื่อแปลงล้มเหลว

## การตั้งค่าเซิร์ฟเวอร์

| ตัวแปร | ค่าเริ่มต้น / ความหมาย |
|---|---|
| PORT | 3001 |
| HOST | 127.0.0.1; production ใช้ 0.0.0.0 |
| YTDLP_PATH | ตำแหน่ง executable ถ้าตรวจอัตโนมัติไม่พบ |
| FFMPEG_PATH | ตำแหน่ง ffmpeg executable; ffprobe ต้องอยู่โฟลเดอร์เดียวกัน |
| MAX_ACTIVE_DOWNLOADS | 2 งาน |
| MAX_FILESIZE | 500M (รองรับจำนวนเต็มตามด้วย K, M, G) |
| TRUST_PROXY | ตั้ง 1 เฉพาะเมื่ออยู่หลัง reverse proxy หนึ่งชั้น เช่น Render; อย่าเปิดเมื่อเข้าถึง Node โดยตรง |

คำขอ metadata จำกัด 10 ครั้ง/นาที/IP และพร้อมกัน 4 งาน; ดาวน์โหลดผ่านเซิร์ฟเวอร์จำกัด 5 ครั้ง/ชั่วโมง/IP และเวลาเตรียมไม่เกิน 10 นาที token หมดอายุใน 10 นาที

เซิร์ฟเวอร์ดาวน์โหลดลงโฟลเดอร์ชั่วคราว แปลง/ตรวจชนิดและขนาดไฟล์ แล้วจึงส่งให้เบราว์เซอร์ ล้างไฟล์เมื่อส่งจบ ล้มเหลว หรือยกเลิก การตรวจพื้นที่ระหว่างแปลงเป็นการสุ่มตรวจทุกวินาที ไม่ใช่ disk quota แบบเข้มงวด

URL รับเฉพาะ HTTP(S), พอร์ต 80/443 และ IP สาธารณะ yt-dlp ใช้ HTTP proxy ภายในซึ่งตรวจ DNS ใหม่และเชื่อมต่อไป IP ที่ตรวจแล้วทุกครั้ง รวม redirect เพื่อป้องกัน DNS rebinding ใช้เฉพาะ native HTTP downloaders ไม่ใช้ config ของ yt-dlp จากเครื่องเซิร์ฟเวอร์

ประวัติเก็บเฉพาะใน localStorage เครื่องนี้ ไม่มีฐานข้อมูลกลาง TikTok fallback ส่งลิงก์ไป TikWM และเปิด CDN ของผู้ให้บริการโดยตรง

## Docker / Render

```sh
docker build -t vetch101 .
docker run --rm -p 3001:3001 vetch101
```

Docker ใช้ Node 22, npm ci, yt-dlp และ FFmpeg และรันด้วยผู้ใช้ node ที่ไม่ใช่ root มี render.yaml สำหรับ Render

ก่อนเปิดบริการสาธารณะ ควรกำหนด disk quota/พื้นที่ชั่วคราวและ egress firewall ของโฮสต์เพิ่มเติม ขนาด 500 MiB เป็นเพดานไฟล์ฝั่งเซิร์ฟเวอร์; browser รับไฟล์เป็น Blob จึงต้องมีหน่วยความจำเพียงพอ

## ข้อจำกัดและเอกสารอ้างอิง

- ดาวน์โหลดเฉพาะสื่อที่มีสิทธิ์เข้าถึง ไม่รองรับ DRM, การข้ามล็อกอิน หรือไลฟ์ที่ยังไม่จบ
- ความพร้อมใช้งานขึ้นกับต้นทาง บางแพลตฟอร์มอาจต้องใช้ cookie หรือบล็อก IP ของ cloud; แอปจะแจ้งข้อผิดพลาด ไม่มีการรับประกันทุกลิงก์
- อัปเดต yt-dlp เมื่อแพลตฟอร์มเปลี่ยน API: `winget upgrade --id yt-dlp.yt-dlp -e`
- [yt-dlp: formats, FFmpeg และ output](https://github.com/yt-dlp/yt-dlp)
- [yt-dlp: JavaScript runtime สำหรับ YouTube](https://github.com/yt-dlp/yt-dlp/wiki/EJS) — เว็บใช้ Node ที่รันเซิร์ฟเวอร์อยู่ เดสก์ท็อปใช้ Node ใน PATH
- [Tauri: เรียก Rust จาก frontend](https://v2.tauri.app/develop/calling-rust/)

MIT License
