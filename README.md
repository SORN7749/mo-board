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
git remote add origin https://github.com/stayhide69/<ชื่อ-repo>.git
git push -u origin main
```

## Deploy อัตโนมัติด้วย GitHub Actions (ไม่ต้องมีคอมพ์เลย)

โปรเจกต์นี้มีไฟล์ `.github/workflows/deploy.yml` ตั้งไว้ให้แล้ว — แค่ทำตามนี้:

1. **แก้ `vite.config.js`** เปลี่ยน `"/REPO_NAME/"` ให้ตรงกับชื่อ repo จริงบน GitHub
   เช่น repo ชื่อ `moboard-solver` → ใส่ `base: "/moboard-solver/"`

2. **สร้าง repo บน GitHub** (repo เปล่า ไม่ต้องติ๊ก README) แล้ว push โค้ดทั้งหมดขึ้นไป
   (ทำจาก iPhone ผ่านแอป Working Copy หรือหน้าเว็บ github.com ก็ได้ — ไม่ต้องมี Node.js บนเครื่องที่ push)

3. **เปิดใช้งาน Pages ให้ build จาก Actions**
   ไปที่หน้า repo บนเว็บ → **Settings → Pages** → ในช่อง "Build and deployment" → **Source** เลือก **"GitHub Actions"** (ไม่ใช่ "Deploy from a branch")

4. **เสร็จแล้ว** — ทุกครั้งที่ push โค้ดเข้า branch `main`, GitHub จะ build และขึ้นเว็บให้อัตโนมัติ
   เข้าดูความคืบหน้าได้ที่แท็บ **Actions** ของ repo (รอบแรกใช้เวลาประมาณ 1-2 นาที)
   เว็บจะอยู่ที่ `https://<username>.github.io/<repo-name>/`

จากนั้นใครก็เปิดลิงก์นี้ใช้แอปได้เลย ไม่ต้องติดตั้งอะไร ไม่ต้องมีคอมพ์ฝั่งคุณอีกเลย

## หมายเหตุการ Calibrate

ภาพกระดาน (`src/assets/maneuvering-board.jpg`) สแกนจาก PDF จริง แล้วตรวจจับศูนย์กลาง + รัศมีวงนอกสุด
ด้วยโค้ด (radial darkness profile) เพื่อความแม่นยำ ค่าที่ได้ (ปรับใน `src/App.jsx`):
- CENTER = { x: 850.9, y: 550.7 }
- MAX_R_PX = 478 (พิกัดในภาพขนาด 1650×1275)
- RING_COUNT = 20 วง (ยืนยันจากสเกล 2:1 ที่วงนอกสุด = 40 → 40/2 = 20)

ถ้าเปลี่ยนภาพกระดานเป็นไฟล์อื่น ต้องปรับ 3 ค่านี้ใหม่ให้ตรงกับภาพนั้น
