# Maneuvering Board Solver

โปรแกรมหาเข็ม/ความเร็วจริงของเรือเป้า พร้อม CPA/TCPA บนกระดานหนจริง (ภาพสแกนจริง ไม่ใช่ภาพวาด)
เวกเตอร์คำนวณ ณ พิกัดที่ปรับเทียบ (calibrate) กับศูนย์กลางและวงนอกสุดของภาพจริงแล้ว

## รันเครื่องตัวเอง

```bash
npm install
npm run dev
```
เปิด http://localhost:5173

## Build สำหรับ deploy

```bash
npm run build
npm run preview   # ทดสอบไฟล์ build ก่อนขึ้นจริง
```
ไฟล์ build อยู่ที่ `dist/` เอาไป host ที่ไหนก็ได้ (GitHub Pages, Vercel, Netlify)

## Push ขึ้น GitHub (repo ใหม่)

```bash
git init
git add .
git commit -m "Initial commit: maneuvering board solver"
git branch -M main
git remote add origin https://github.com/SORN7749/<ชื่อ-repo>.git
git push -u origin main
```

## Deploy อัตโนมัติด้วย GitHub Actions (ไม่ต้องมีคอมพ์เลย)

โปรเจกต์นี้ตั้งค่าให้พร้อมสำหรับ repo **https://github.com/SORN7749/mo-board** แล้ว (`vite.config.js` ตั้ง `base: "/mo-board/"` ไว้ให้)

1. **Push โค้ดทั้งหมด** (รวมโฟลเดอร์ `.github`) ขึ้น repo `SORN7749/mo-board` บน branch `main`

2. **เปิดใช้งาน Pages ให้ build จาก Actions**
   ไปที่ repo บนเว็บ → **Settings → Pages** → "Build and deployment" → **Source** เลือก **"GitHub Actions"**

3. **เสร็จแล้ว** — ทุกครั้งที่ push เข้า `main`, GitHub build+deploy ให้อัตโนมัติ
   ดูสถานะที่แท็บ **Actions** (รอบแรก ~1-2 นาที)
   เว็บจะอยู่ที่ **https://SORN7749.github.io/mo-board/**

## หมายเหตุการ Calibrate

ภาพกระดาน (`src/assets/maneuvering-board.jpg`) สแกนจาก PDF จริง แล้วตรวจจับศูนย์กลาง + รัศมีวงนอกสุด
ด้วยโค้ด (radial darkness profile) เพื่อความแม่นยำ ค่าที่ได้ (ปรับใน `src/App.jsx`):
- CENTER = { x: 850.9, y: 550.7 }
- MAX_R_PX = 478 (พิกัดในภาพขนาด 1650×1275)
- RING_COUNT = 20 วง (ยืนยันจากสเกล 2:1 ที่วงนอกสุด = 40 → 40/2 = 20)

ถ้าเปลี่ยนภาพกระดานเป็นไฟล์อื่น ต้องปรับ 3 ค่านี้ใหม่ให้ตรงกับภาพนั้น
