// ============================================================
// routes/searchRoutes.js
// Handles all search operations with Gemini AI integration:
//   POST   /api/searches/save          — Save + AI tag + AI summary
//   GET    /api/searches/              — Get all searches (filter/search)
//   GET    /api/searches/stats         — Get dashboard stats
//   GET    /api/searches/insight       — Get AI weekly insight
//   DELETE /api/searches/:id           — Delete a search
//   PATCH  /api/searches/:id/share     — Share a search
//   PATCH  /api/searches/:id/unshare   — Unshare a search
//   GET    /api/searches/shared/:token — View shared search (public)
//   POST   /api/searches/retag-all     — Re-tag all searches with AI
// ============================================================

const express  = require("express");
const router   = express.Router();
const crypto   = require("crypto");
const supabase = require("../supabaseClient");
const protect  = require("../middleware/authMiddleware");

// Import Gemini AI functions
const {
  getAutoTag,
  getAutoSummary,
  getWeeklyInsight
} = require("../geminiClient");


// ── SAVE A SEARCH ─────────────────────────────────────────────
// POST /api/searches/save
// Protected: YES
// Body: { query, source }
// AI automatically assigns tag and summary
// Returns: { message, search }

router.post("/save", protect, async (req, res) => {
  try {
    const { query, source } = req.body;
    const userId = req.user.id;

    // Query is required
    if (!query || query.trim().length === 0) {
      return res.status(400).json({ error: "Search query cannot be empty." });
    }

    // Trim the query
    const cleanQuery = query.trim();

    console.log(`🤖 Gemini AI processing: "${cleanQuery.substring(0, 60)}..."`);

    // Call both Gemini AI functions at the same time (parallel = faster)
    const [autoTag, autoSummary] = await Promise.all([
      getAutoTag(cleanQuery),
      getAutoSummary(cleanQuery)
    ]);

    console.log(`✅ Tag: ${autoTag} | Summary: ${autoSummary}`);

    // Save to Supabase
    const { data: savedSearch, error } = await supabase
      .from("searches")
      .insert({
        user_id:   userId,
        query:     cleanQuery,
        source:    source || "ChatGPT",
        tag:       autoTag,
        summary:   autoSummary,
        timestamp: new Date(),
        is_shared: false
      })
      .select()
      .single();
