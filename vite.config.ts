import path from "path";
import fs from "fs";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      // Stamps dist/sw.js with the current build timestamp so the browser
      // detects a byte change on every deploy and installs the new SW.
      name: "stamp-sw",
      apply: "build",
      closeBundle() {
        const swPath = path.resolve(__dirname, "dist/sw.js");
        if (fs.existsSync(swPath)) {
          const content = fs.readFileSync(swPath, "utf-8");
          fs.writeFileSync(swPath, content.replaceAll("__BUILD_TIMESTAMP__", Date.now().toString()));
        }
      },
    },
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
  },
});
