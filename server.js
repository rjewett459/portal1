import express from "express";
import fs from "fs";
import "dotenv/config";

const app = express();
const port = process.env.PORT || 3000;
const apiKey = process.env.OPENAI_API_KEY;

// Check if we're in development mode
const isDev = process.argv.includes("--dev");
let vite;

if (isDev) {
  // Only use Vite in development mode
  const { createServer: createViteServer } = await import("vite");
  vite = await createViteServer({
    server: { middlewareMode: true },
    appType: "custom",
  });
  app.use(vite.middlewares);
}

// API route for token generation
app.get("/token", async (req, res) => {
  try {
    const response = await fetch(
      "https://api.openai.com/v1/realtime/sessions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini-realtime-preview-2024-12-17",
          voice: "verse",
        }),
      },
    );

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error("Token generation error:", error);
    res.status(500).json({ error: "Failed to generate token" });
  }
});

// Render the React client
app.use("*", async (req, res, next) => {
  const url = req.originalUrl;

  try {
    if (isDev) {
      // Development mode - use Vite
      const template = await vite.transformIndexHtml(
        url,
        fs.readFileSync("./client/index.html", "utf-8"),
      );
      const { render } = await vite.ssrLoadModule("./client/entry-server.jsx");
      const appHtml = await render(url);
      const html = template.replace(`<!--ssr-outlet-->`, appHtml?.html);
      res.status(200).set({ "Content-Type": "text/html" }).end(html);
    } else {
      // Production mode - use built files
      const template = fs.readFileSync("./dist/client/index.html", "utf-8");
      const { render } = await import("./dist/server/entry-server.js");
      const appHtml = await render(url);
      const html = template.replace(`<!--ssr-outlet-->`, appHtml?.html);
      res.status(200).set({ "Content-Type": "text/html" }).end(html);
    }
  } catch (e) {
    if (isDev) {
      vite.ssrFixStacktrace(e);
    }
    console.error(e);
    next(e);
  }
});

// In production, serve static files from the dist directory
if (!isDev) {
  // Serve static assets with proper MIME types and caching
  app.use(express.static("./dist/client", { 
    index: false,
    etag: true,
    lastModified: true,
    maxAge: '1d'
  }));
  
  // Explicitly serve CSS files with proper content type
  app.get('*.css', (req, res, next) => {
    res.set('Content-Type', 'text/css');
    next();
  });
  
  // Explicitly serve JS files with proper content type
  app.get('*.js', (req, res, next) => {
    res.set('Content-Type', 'application/javascript');
    next();
  });
}

app.listen(port, "0.0.0.0", () => {
  console.log(`Express server running on *:${port} in ${isDev ? "development" : "production"} mode`);
});
