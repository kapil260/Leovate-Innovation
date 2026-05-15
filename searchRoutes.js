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

    if (error) {
      console.error("Save search DB error:", error.message);
      return res.status(500).json({ error: "Could not save search. Please try again." });
    }

    res.status(201).json({
      message: "Search saved with AI tag and summary!",
      search:  savedSearch
    });

  } catch (error) {
    console.error("Save search error:", error.message);
    res.status(500).json({ error: "Server error while saving search." });
  }
});


// ── GET ALL SEARCHES ──────────────────────────────────────────
// GET /api/searches/
// Protected: YES
// Query params:
//   ?q=keyword     — filter by keyword in query or summary
//   ?tag=Science   — filter by tag
//   ?source=ChatGPT — filter by source
//   ?limit=20      — limit number of results (default: all)
// Returns: { message, count, searches }

router.get("/", protect, async (req, res) => {
  try {
    const userId    = req.user.id;
    const keyword   = req.query.q;
    const tagFilter = req.query.tag;
    const source    = req.query.source;
    const limit     = req.query.limit ? parseInt(req.query.limit) : null;

    // Start building query
    let query = supabase
      .from("searches")
      .select("*")
      .eq("user_id", userId)
      .order("timestamp", { ascending: false });

    // Filter by keyword in query text or summary
    if (keyword) {
      query = query.or(
        `query.ilike.%${keyword}%,summary.ilike.%${keyword}%`
      );
    }

    // Filter by tag
    if (tagFilter && tagFilter !== "All") {
      query = query.eq("tag", tagFilter);
    }

    // Filter by source
    if (source) {
      query = query.eq("source", source);
    }

    // Limit results if specified
    if (limit) {
      query = query.limit(limit);
    }

    const { data: searches, error } = await query;

    if (error) {
      console.error("Get searches DB error:", error.message);
      return res.status(500).json({ error: "Could not fetch searches." });
    }

    res.status(200).json({
      message:  "Searches fetched successfully!",
      count:    searches.length,
      searches: searches
    });

  } catch (error) {
    console.error("Get searches error:", error.message);
    res.status(500).json({ error: "Server error while fetching searches." });
  }
});


// ── GET DASHBOARD STATS ───────────────────────────────────────
// GET /api/searches/stats
// Protected: YES
// Returns stats for the dashboard header cards:
//   totalSearches, thisWeek, sharedCount, topTag

router.get("/stats", protect, async (req, res) => {
  try {
    const userId = req.user.id;

    // Get all searches for this user
    const { data: searches, error } = await supabase
      .from("searches")
      .select("id, tag, timestamp, is_shared")
      .eq("user_id", userId);

    if (error) {
      return res.status(500).json({ error: "Could not fetch stats." });
    }

    // Calculate stats
    const total = searches.length;

    // Count searches from the last 7 days
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const thisWeek = searches.filter(s =>
      new Date(s.timestamp) >= weekAgo
    ).length;

    // Count shared searches
    const sharedCount = searches.filter(s => s.is_shared).length;

    // Find the most used tag
    const tagCounts = {};
    searches.forEach(s => {
      tagCounts[s.tag] = (tagCounts[s.tag] || 0) + 1;
    });
    const topTag = Object.keys(tagCounts).sort(
      (a, b) => tagCounts[b] - tagCounts[a]
    )[0] || "None";

    res.status(200).json({
      stats: {
        totalSearches: total,
        thisWeek:      thisWeek,
        sharedCount:   sharedCount,
        topTag:        topTag,
        tagBreakdown:  tagCounts
      }
    });

  } catch (error) {
    console.error("Stats error:", error.message);
    res.status(500).json({ error: "Server error while fetching stats." });
  }
});


// ── GET AI WEEKLY INSIGHT ─────────────────────────────────────
// GET /api/searches/insight
// Protected: YES
// Returns: { insight } — an AI-generated sentence about this week's searches
// Powers the "Weekly Insights" banner on the dashboard

router.get("/insight", protect, async (req, res) => {
  try {
    const userId = req.user.id;

    // Get searches from the last 7 days
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const { data: weekSearches, error } = await supabase
      .from("searches")
      .select("query, tag, summary")
      .eq("user_id", userId)
      .gte("timestamp", weekAgo.toISOString())
      .order("timestamp", { ascending: false });

    if (error) {
      return res.status(500).json({ error: "Could not fetch weekly searches." });
    }

    // Ask Gemini to generate a personalized insight
    const insight = await getWeeklyInsight(weekSearches);

    res.status(200).json({
      insight:      insight,
      searchCount:  weekSearches.length
    });

  } catch (error) {
    console.error("Insight error:", error.message);
    res.status(500).json({ error: "Server error while generating insight." });
  }
});


// ── DELETE A SEARCH ───────────────────────────────────────────
// DELETE /api/searches/:id
// Protected: YES
// Returns: { message }

router.delete("/:id", protect, async (req, res) => {
  try {
    const searchId = req.params.id;
    const userId   = req.user.id;

    // Delete only if it belongs to this user (security check)
    const { error } = await supabase
      .from("searches")
      .delete()
      .eq("id", searchId)
      .eq("user_id", userId);

    if (error) {
      console.error("Delete search DB error:", error.message);
      return res.status(500).json({ error: "Could not delete search." });
    }

    res.status(200).json({ message: "Search deleted successfully!" });

  } catch (error) {
    console.error("Delete search error:", error.message);
    res.status(500).json({ error: "Server error while deleting search." });
  }
});


// ── SHARE A SEARCH ────────────────────────────────────────────
// PATCH /api/searches/:id/share
// Protected: YES
// Generates a unique public link for this search
// Returns: { message, shareLink, search }

router.patch("/:id/share", protect, async (req, res) => {
  try {
    const searchId = req.params.id;
    const userId   = req.user.id;

    // Find the search and make sure it belongs to this user
    const { data: existingSearch, error: findError } = await supabase
      .from("searches")
      .select("*")
      .eq("id", searchId)
      .eq("user_id", userId)
      .single();

    if (findError || !existingSearch) {
      return res.status(404).json({
        error: "Search not found or you do not have permission."
      });
    }

    // If already shared, return existing link
    if (existingSearch.is_shared && existingSearch.share_token) {
      const shareLink = `${process.env.FRONTEND_URL}/shared/${existingSearch.share_token}`;
      return res.status(200).json({
        message:   "Search is already shared.",
        shareLink: shareLink,
        search:    existingSearch
      });
    }

    // Generate a unique share token
    const shareToken = crypto.randomBytes(32).toString("hex");

    // Update the search in Supabase
    const { data: updatedSearch, error: updateError } = await supabase
      .from("searches")
      .update({ is_shared: true, share_token: shareToken })
      .eq("id", searchId)
      .eq("user_id", userId)
      .select()
      .single();

    if (updateError) {
      return res.status(500).json({ error: "Could not share search." });
    }

    const shareLink = `${process.env.FRONTEND_URL}/shared/${shareToken}`;

    res.status(200).json({
      message:   "Search shared successfully!",
      shareLink: shareLink,
      search:    updatedSearch
    });

  } catch (error) {
    console.error("Share search error:", error.message);
    res.status(500).json({ error: "Server error while sharing search." });
  }
});


// ── UNSHARE A SEARCH ─────────────────────────────────────────
// PATCH /api/searches/:id/unshare
// Protected: YES
// Removes the public share link
// Returns: { message }

router.patch("/:id/unshare", protect, async (req, res) => {
  try {
    const searchId = req.params.id;
    const userId   = req.user.id;

    const { error } = await supabase
      .from("searches")
      .update({ is_shared: false, share_token: null })
      .eq("id", searchId)
      .eq("user_id", userId);

    if (error) {
      return res.status(500).json({ error: "Could not unshare search." });
    }

    res.status(200).json({ message: "Search is now private." });

  } catch (error) {
    console.error("Unshare error:", error.message);
    res.status(500).json({ error: "Server error while unsharing search." });
  }
});


// ── VIEW SHARED SEARCH (PUBLIC) ───────────────────────────────
// GET /api/searches/shared/:token
// Public — no login needed
// Anyone with the share link can view this search
// Returns: { message, search }

router.get("/shared/:token", async (req, res) => {
  try {
    const shareToken = req.params.token;

    // Find the search by token — only return safe fields (not user_id)
    const { data: search, error } = await supabase
      .from("searches")
      .select("id, query, summary, source, tag, timestamp")
      .eq("share_token", shareToken)
      .eq("is_shared", true)
      .single();

    if (error || !search) {
      return res.status(404).json({
        error: "Shared search not found or this link has expired."
      });
    }

    res.status(200).json({
      message: "Shared search found!",
      search:  search
    });

  } catch (error) {
    console.error("View shared search error:", error.message);
    res.status(500).json({ error: "Server error while fetching shared search." });
  }
});


// ── RETAG ALL SEARCHES WITH AI ────────────────────────────────
// POST /api/searches/retag-all
// Protected: YES
// Goes through all searches tagged as "Other" and re-tags with Gemini
// Useful for updating old searches saved before AI was added

router.post("/retag-all", protect, async (req, res) => {
  try {
    const userId = req.user.id;

    // Get searches with no proper tag
    const { data: searches, error } = await supabase
      .from("searches")
      .select("id, query")
      .eq("user_id", userId)
      .or("tag.eq.Other,summary.eq.");

    if (error) {
      return res.status(500).json({ error: "Could not fetch searches." });
    }

    if (searches.length === 0) {
      return res.status(200).json({
        message: "All your searches already have AI tags and summaries!"
      });
    }

    let updated = 0;

    // Process each search one by one
    for (const search of searches) {
      const [newTag, newSummary] = await Promise.all([
        getAutoTag(search.query),
        getAutoSummary(search.query)
      ]);

      await supabase
        .from("searches")
        .update({ tag: newTag, summary: newSummary })
        .eq("id", search.id);

      updated++;
    }

    res.status(200).json({
      message: `Successfully re-tagged ${updated} searches with Gemini AI!`,
      updated: updated
    });

  } catch (error) {
    console.error("Retag error:", error.message);
    res.status(500).json({ error: "Server error while re-tagging." });
  }
});


module.exports = router;
