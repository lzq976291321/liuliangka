import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api/proxy": "http://localhost:3001",
    },
    host: "0.0.0.0",
  },
});
