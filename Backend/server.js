// ============================================================
// server.js — Recall AI Backend Entry Point (v2)
// ============================================================

const express      = require("express");
const cors         = require("cors");
require("dotenv").config();

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

// ── PING ROUTE ────────────────────────────────────────────────
app.get("/api/ping", (req, res) => res.json({ pong: true, ts: Date.now() }));

// ── SHARED SEARCH PAGE ────────────────────────────────────────
// Serves the public shared-search HTML page
app.get("/shared/:token", (req, res) => {
  res.sendFile(__dirname + "/public/shared.html");
});
app.use(express.static(__dirname + "/public"));

// ── HOME ROUTE ────────────────────────────────────────────────
app.get("/", (req, res) => {
  res.json({
    project: "Recall AI",
    status:  "Server is running ✅",
    version: "3.0.0",
    ai:      "Google Gemini (free)",
    endpoints: {
      auth: {
        signup:  "POST /api/auth/signup",
        login:   "POST /api/auth/login",
        me:      "GET  /api/auth/me"
      },
      searches: {
        save:        "POST   /api/searches/save",
        getAll:      "GET    /api/searches/",
        stats:       "GET    /api/searches/stats",
        insight:     "GET    /api/searches/insight",
        delete:      "DELETE /api/searches/:id",
        share:       "PATCH  /api/searches/:id/share",
        unshare:     "PATCH  /api/searches/:id/unshare",
        viewShared:  "GET    /api/searches/shared/:token",
        retagAll:    "POST   /api/searches/retag-all"
      },
      user: {
        forgotPassword:      "POST   /api/user/forgot-password",
        resetPassword:       "POST   /api/user/reset-password",
        changePassword:      "POST   /api/user/password",
        resendVerification:  "POST   /api/user/resend-verification",
        verifyEmail:         "POST   /api/user/verify-email",
        getSettings:         "GET    /api/user/settings",
        saveSettings:        "POST   /api/user/settings",
        getSubscription:     "GET    /api/user/subscription",
        upgradeSubscription: "POST   /api/user/subscription/upgrade",
        cancelSubscription:  "POST   /api/user/subscription/cancel",
        exportData:          "GET    /api/user/export?format=json|csv",
        deleteAccount:       "DELETE /api/user/account"
      }
    }
  });
});

// ── 404 HANDLER ───────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: "Route not found." });
});

// ── START SERVER ──────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log("");
  console.log("╔════════════════════════════════════════════╗");
  console.log("║         RECALL AI — BACKEND v3             ║");
  console.log("╠════════════════════════════════════════════╣");
  console.log(`║  Server:  http://localhost:${PORT}           ║`);
  console.log("║  AI:      Google Gemini (free)             ║");
  console.log("║  DB:      Supabase                         ║");
  console.log("║  New:     Password Change (auth) ✅        ║");
  console.log("║  New:     Email Verification ✅            ║");
  console.log("║  New:     Settings Persistence ✅          ║");
  console.log("║  New:     Subscription Routes ✅           ║");
  console.log("║  New:     Account Deletion (GDPR) ✅       ║");
  console.log("║  New:     CSV/JSON Export ✅               ║");
  console.log("║  New:     Shared Search Page ✅            ║");
  console.log("║  Status:  Running ✅                       ║");
  console.log("╚════════════════════════════════════════════╝");
  console.log("");
});
