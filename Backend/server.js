// ============================================================
// server.js — Recall AI Backend Entry Point (v3.1 — Resend)
// ============================================================

const express = require("express");
const cors    = require("cors");
require("dotenv").config();

// ── STARTUP ENV CHECK ─────────────────────────────────────────
const REQUIRED_VARS = [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_KEY",
  "JWT_SECRET",
  "RESEND_API_KEY",
];
const missing = REQUIRED_VARS.filter(v => !process.env[v]);
if (missing.length > 0) {
  console.error("\n╔════════════════════════════════════════════╗");
  console.error("║   ❌ MISSING ENVIRONMENT VARIABLES         ║");
  console.error("╠════════════════════════════════════════════╣");
  missing.forEach(v => console.error(`║  ❌ ${v.padEnd(38)} ║`));
  console.error("╠════════════════════════════════════════════╣");
  console.error("║  Set these in Render → Environment tab.   ║");
  console.error("╚════════════════════════════════════════════╝\n");
} else {
  console.log("[Recall AI] ✅ All required env vars present");
}

const authRoutes   = require("./routes/authRoutes");
const searchRoutes = require("./routes/searchRoutes");
const userRoutes   = require("./routes/userRoutes");

const app = express();

// ── MIDDLEWARE ────────────────────────────────────────────────
app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PATCH", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));
app.use(express.json());

// ── ROUTES ────────────────────────────────────────────────────
app.use("/api/auth",     authRoutes);
app.use("/api/searches", searchRoutes);
app.use("/api/user",     userRoutes);

// ── PING ──────────────────────────────────────────────────────
app.get("/api/ping", (req, res) => res.json({ pong: true, ts: Date.now() }));

// ── HEALTH / DIAGNOSTIC ───────────────────────────────────────
app.get("/api/health", (req, res) => {
  const checks = {
    SUPABASE_URL:         !!process.env.SUPABASE_URL,
    SUPABASE_SERVICE_KEY: !!process.env.SUPABASE_SERVICE_KEY,
    JWT_SECRET:           !!process.env.JWT_SECRET,
    RESEND_API_KEY:       !!process.env.RESEND_API_KEY,
    GROQ_API_KEY:         !!process.env.GROQ_API_KEY,
  };
  const allOk = Object.values(checks).every(Boolean);
  res.status(allOk ? 200 : 500).json({
    status:   allOk ? "ok" : "missing_env_vars",
    env:      checks,
    node_env: process.env.NODE_ENV || "not set",
  });
});

// ── SHARED SEARCH PAGE ────────────────────────────────────────
app.get("/shared/:token", (req, res) => {
  res.sendFile(__dirname + "/public/shared.html");
});
app.use(express.static(__dirname + "/public"));

// ── HOME ──────────────────────────────────────────────────────
app.get("/", (req, res) => {
  res.json({
    project: "Recall AI",
    status:  "Server is running ✅",
    version: "3.1.0",
    email:   "Resend (HTTP API)",
    endpoints: {
      health: "GET  /api/health",
      auth: {
        signupSendOtp:  "POST /api/auth/signup-send-otp",
        signupVerify:   "POST /api/auth/signup-verify",
        signupResend:   "POST /api/auth/signup-resend-otp",
        login:          "POST /api/auth/login",
        me:             "GET  /api/auth/me",
      },
    }
  });
});

// ── 404 ───────────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ error: "Route not found." }));

// ── START ─────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log("\n╔════════════════════════════════════════════╗");
  console.log("║       RECALL AI — BACKEND v3.1            ║");
  console.log("╠════════════════════════════════════════════╣");
  console.log(`║  Server: http://localhost:${PORT}              ║`);
  console.log("║  Email:  Resend (SMTP-free) ✅            ║");
  console.log("║  Health: /api/health                      ║");
  console.log("╚════════════════════════════════════════════╝\n");
});
