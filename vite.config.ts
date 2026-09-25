import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Served from GitHub Pages at /Rainbow-6-Siege-App/ — override with BASE_PATH for other hosts.
export default defineConfig({
  base: process.env.BASE_PATH ?? "/Rainbow-6-Siege-App/",
  plugins: [react()],
});
