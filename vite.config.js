import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// สำคัญ: เปลี่ยน "REPO_NAME" ให้ตรงกับชื่อ repo บน GitHub ของคุณ
// เช่น ถ้า repo คือ stayhide69/moboard-solver ให้ใส่ base: "/moboard-solver/"
export default defineConfig({
  plugins: [react()],
  base: "/REPO_NAME/",
});
