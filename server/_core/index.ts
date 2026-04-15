import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerGhlWebhookRoutes } from "../ghlWebhook";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // Allow GHL booking widget (LeadConnector) and Stripe to load inside iframes
  // Stripe requires specific Permissions-Policy and CSP headers to work in iframes
  app.use((_req, res, next) => {
    // Remove X-Frame-Options so our own pages can embed GHL iframes
    res.removeHeader("X-Frame-Options");
    // Permissions-Policy: grant payment and other required features to all origins
    res.setHeader(
      "Permissions-Policy",
      "payment=*, camera=*, microphone=*, clipboard-read=*, clipboard-write=*, geolocation=*, fullscreen=*"
    );
    // Content-Security-Policy: allow Stripe and GHL/LeadConnector frame-src
    res.setHeader(
      "Content-Security-Policy",
      [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://api.leadconnectorhq.com https://widgets.leadconnectorhq.com https://cdn.jsdelivr.net https://fonts.googleapis.com",
        "frame-src 'self' https://js.stripe.com https://hooks.stripe.com https://api.leadconnectorhq.com https://widgets.leadconnectorhq.com https://*.stripe.com https://*.leadconnectorhq.com",
        "connect-src 'self' https://api.stripe.com https://api.leadconnectorhq.com wss://*.leadconnectorhq.com",
        "img-src 'self' data: blob: https: http:",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' data: https://fonts.gstatic.com",
        "worker-src blob:",
      ].join("; ")
    );
    next();
  });
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  // GHL webhook for course completion events
  registerGhlWebhookRoutes(app);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
