import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware para JSON
  app.use(express.json());

  // Rota de Segurança para api.php
  // Se for acessado diretamente via GET sem parâmetros, retorna 404
  app.get("/api.php", (req, res, next) => {
    if (!req.query.action) {
      res.status(404).send(`
        <html>
          <head><title>404 Not Found</title></head>
          <body>
            <h1>Not Found</h1>
            <p>The requested URL was not found on this server.</p>
          </body>
        </html>
      `);
      return;
    }
    next(); // Permite o acesso se houver parâmetros (embora o Vite vá servir o arquivo estático)
  });

  // Rota para download seguro do api.php (pode ser usado pelo Admin Panel)
  app.get("/api/download-api-bridge", (req, res) => {
    const filePath = path.join(__dirname, "public", "api.php");
    if (fs.existsSync(filePath)) {
      res.download(filePath, "api.php");
    } else {
      res.status(404).send("Arquivo não encontrado.");
    }
  });

  // Vite middleware para desenvolvimento
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Servir arquivos estáticos em produção
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
