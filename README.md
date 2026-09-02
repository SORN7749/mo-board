# MB Solver

เครื่องคำนวณ Maneuvering Board ภาษาไทยสำหรับงานเดินเรือ สร้างด้วย React, Vite และ Tailwind CSS

## ความสามารถ

- คำนวณเข็มและความเร็วเป้า พร้อม CPA/TCPA
- คำนวณลมจริงและลมสัมพัทธ์
- คำนวณการเข้าสถานี
- คำนวณ Time–Speed–Distance
- ใช้ภาพ Maneuvering Board ต้นฉบับเป็นพื้นหลังที่คาลิเบรตแล้ว
- แสดงเวกเตอร์บนกระดานด้วย SVG
- รองรับหน้าจอมือถือและการซูม/เลื่อนกระดาน

## ความต้องการ

- Node.js 20 ขึ้นไป (แนะนำ Node.js 22)
- npm 10 ขึ้นไป

## เริ่มใช้งาน

```bash
npm install
npm run dev
```

เปิด URL ที่แสดงใน Terminal

## ตรวจสอบและสร้าง Production Build

```bash
npm run lint
npm run build
npm run preview
```

ไฟล์สำหรับเผยแพร่จะอยู่ใน `dist/`

## อัปโหลดขึ้น GitHub

1. สร้าง repository ใหม่บน GitHub โดยไม่ต้องเพิ่ม README หรือ `.gitignore`
2. แตกไฟล์ ZIP นี้
3. เปิด Terminal ในโฟลเดอร์โปรเจกต์แล้วรัน:

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git
git push -u origin main
```

เปลี่ยน `YOUR_USERNAME` และ `YOUR_REPOSITORY` ให้ตรงกับ repository ของคุณ

## เปิดใช้งาน GitHub Pages

โปรเจกต์มี GitHub Actions สำหรับ build และ deploy ให้อัตโนมัติแล้ว

1. ไปที่ `Settings → Pages`
2. เลือก Source เป็น `GitHub Actions`
3. Push โค้ดเข้า branch `main`
4. ตรวจสถานะที่แท็บ `Actions`

เมื่อ workflow สำเร็จ เว็บไซต์จะเปิดผ่าน GitHub Pages ได้ทันที

## โครงสร้างหลัก

```text
src/
  assets/maneuvering-board.jpg
  App.jsx
  index.css
  main.jsx
.github/workflows/deploy-pages.yml
index.html
package.json
vite.config.js
```

## หมายเหตุ

แอปนี้เป็นเครื่องมือช่วยคำนวณเพื่อการฝึกและตรวจสอบ ควรยืนยันผลด้วยหลักการเดินเรือและเอกสารทางการก่อนใช้งานจริง
