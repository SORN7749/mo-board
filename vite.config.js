import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// repo: https://github.com/stayhide69/mo-board
export default defineConfig({
  plugins: [react()],
  base: "/mo-board/",
});
