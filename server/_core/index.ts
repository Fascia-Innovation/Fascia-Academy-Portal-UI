import "dotenv/config";
import express from "express";
import rateLimit from "express-rate-limit";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { registerGhlWebhookRoutes } from "../ghlWebhook";
import { startSnapshotJob } from "../snapshotJob";
import { startBookedSeatsSync } from "../bookedSeatsSync";
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
  // Body parser: small default limit, larger for specific upload routes
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ limit: "1mb", extended: true }));
  // Override with larger limit for storage/upload routes
  app.use("/api/storage", express.json({ limit: "50mb" }));
  app.use("/manus-storage", express.json({ limit: "50mb" }));

  // ─── Security headers ────────────────────────────────────────────────────────
  app.use((_req, res, next) => {
    const path = _req.path;
    // X-Frame-Options: allow embedding only for public/widget routes
    if (path.startsWith("/courses") || path.startsWith("/api/webhooks") || path === "/") {
      res.removeHeader("X-Frame-Options");
    } else {
      res.setHeader("X-Frame-Options", "SAMEORIGIN");
    }
    // Standard security headers (helmet-equivalent)
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("X-DNS-Prefetch-Control", "off");
    res.setHeader("X-Download-Options", "noopen");
    res.setHeader("X-Permitted-Cross-Domain-Policies", "none");
    if (process.env.NODE_ENV === "production") {
      res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    }
    // Permissions-Policy: scoped to specific origins (Stripe + GHL)
    res.setHeader(
      "Permissions-Policy",
      "payment=(self \"https://js.stripe.com\"), camera=(), microphone=(), geolocation=(), fullscreen=(self)"
    );
    // Content-Security-Policy
    const scriptSrc = process.env.NODE_ENV === "production"
      ? "script-src 'self' 'unsafe-inline' https://js.stripe.com https://api.leadconnectorhq.com https://widgets.leadconnectorhq.com https://cdn.jsdelivr.net https://fonts.googleapis.com"
      : "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://api.leadconnectorhq.com https://widgets.leadconnectorhq.com https://cdn.jsdelivr.net https://fonts.googleapis.com";
    res.setHeader(
      "Content-Security-Policy",
      [
        "default-src 'self'",
        scriptSrc,
        "frame-src 'self' https://js.stripe.com https://hooks.stripe.com https://api.leadconnectorhq.com https://widgets.leadconnectorhq.com https://*.stripe.com https://*.leadconnectorhq.com",
        "frame-ancestors 'self'",
        "connect-src 'self' https://api.stripe.com https://api.leadconnectorhq.com wss://*.leadconnectorhq.com https://*.manus.im",
        "img-src 'self' data: blob: https: http:",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' data: https://fonts.gstatic.com",
        "worker-src blob:",
      ].join("; ")
    );
    next();
  });
  // Storage proxy for uploaded assets
  registerStorageProxy(app);
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  // GHL webhook for course completion events
  registerGhlWebhookRoutes(app);
  // Rate limiting on auth endpoints (brute-force protection)
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // max 10 attempts per IP per window
    message: { error: "Too many attempts, please try again later" },
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use("/api/trpc/dashboard.login", authLimiter);
  app.use("/api/trpc/dashboard.requestPasswordReset", authLimiter);
  app.use("/api/trpc/dashboard.resetPassword", authLimiter);

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
    // Start background jobs after server is listening
    startSnapshotJob();
    startBookedSeatsSync();
  });
}

startServer().catch(console.error);
