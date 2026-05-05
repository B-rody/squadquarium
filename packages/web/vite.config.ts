import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { viteStaticCopy } from "vite-plugin-static-copy";
import path from "path";
import fs from "fs";

function skinsDevMiddleware(): Plugin {
  return {
    name: "skins-dev-middleware",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith("/skins/")) return next();
        const relPath = req.url.slice("/skins/".length);
        const filePath = path.resolve(__dirname, "../../skins", relPath);
        if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
          const ext = path.extname(filePath);
          const mimeMap: Record<string, string> = {
            ".json": "application/json",
            ".css": "text/css",
            ".woff2": "font/woff2",
            ".png": "image/png",
          };
          res.setHeader("Content-Type", mimeMap[ext] ?? "application/octet-stream");
          fs.createReadStream(filePath).pipe(res);
        } else {
          res.statusCode = 404;
          res.end("Not found");
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    skinsDevMiddleware(),
    viteStaticCopy({
      targets: [
        {
          src: path.resolve(__dirname, "../../skins").replace(/\\/g, "/") + "/*",
          dest: "skins",
        },
      ],
    }),
  ],
  base: "./",
  build: {
    outDir: "dist",
  },
});
