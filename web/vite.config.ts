import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { mockApi } from "./dev/index.ts";

// `vite --mode mock` serves the API from fixtures; otherwise /api goes to a running server
// (`pnpm dev:fake --port 4999` or `pnpm dev:server`), on MEGAREVIEWER_DEV_PORT if set.
export default defineConfig(({ mode }) => ({
  root: fileURLToPath(new URL(".", import.meta.url)),
  plugins: [react(), ...(mode === "mock" ? [mockApi()] : [])],
  build: {
    outDir: fileURLToPath(new URL("../dist/web", import.meta.url)),
    emptyOutDir: true,
    assetsDir: "assets",
  },
  server:
    mode === "mock"
      ? {}
      : {
          proxy: {
            "/api": {
              target: `http://127.0.0.1:${process.env.MEGAREVIEWER_DEV_PORT ?? 4999}`,
              // The server's Host check allows only its own address.
              changeOrigin: true,
            },
          },
        },
}));
