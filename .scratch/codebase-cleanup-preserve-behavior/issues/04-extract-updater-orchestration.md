# 04: แยก Orchestration ของ App & Engine Update ออกจากส่วนแสดงผล App.tsx

**What to build:** หน้าต่างแอปหลักมีโครงสร้างที่กระชับและดูแลรักษาง่าย โดยแยกวงจรการตรวจสอบ engine dependency, การอัปเดตแอป, และการอัปเดต engine ออกจากส่วนแสดงผล `App.tsx` ไปไว้ใน controller/hook เฉพาะ โดยที่แบนเนอร์แจ้งเตือน, modal อัปเดต, การจำกัดไม่อัปเดตระหว่างดาวน์โหลด, และการจัดเก็บค่า preferences ในเครื่องยังคงทำงานได้อย่างเดิม 100%

**Blocked by:** 02: แก้การส่งต่อ Browser Target & ลบการแจ้งเตือนดาวน์โหลดรูปซ้ำ

**Status:** completed

- [x] แยก state, effects, และ logic การประสานงานของ engine dependency detector และ app/engine updater ออกจาก `src/App.tsx` ไปเป็น hook หรือ module แยกที่ชัดเจน (เช่น `useAppUpdates.ts` หรือ `useEngineUpdater.ts`)
- [x] คงพฤติกรรมการกั้นไม่ให้เริ่มอัปเดตหากมีงานตรวจสื่อหรือดาวน์โหลดกำลังทำงานอยู่ (concurrency guard)
- [x] คง UI แบนเนอร์, ไดอะล็อกยืนยัน, และข้อความสถานะการอัปเดตทั้งหมดโดยไม่มีการเปลี่ยนแปลงด้าน UX
- [x] ลดขนาดและความซับซ้อนของ `App.tsx` โดยการทำงานของแอปและ tests ฝั่ง frontend ทั้งหมดยังผ่านปกติ
