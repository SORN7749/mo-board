import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// repo: https://github.com/stayhide69/MO-BOARD
export default defineConfig({
  plugins: [react()],
  base: "/MO-BOARD/",
});
