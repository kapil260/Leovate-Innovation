// ============================================================
// routes/searchRoutes.js
// Handles all search operations with Groq AI integration:
//   POST   /api/searches/save          — Save + AI tag + rich AI summary
//   POST   /api/searches/combine       — Combine summaries from multiple platforms
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

// Import Groq AI functions
const {
  getAutoTag,
  getAutoSummary,
  getCombinedSummary,
  getWeeklyInsight,
  getShortTitle
} = require("../geminiClient");


// ── SAVE A SEARCH ─────────────────────────────────────────────
// POST /api/searches/save
// Protected: YES
// Body: { query, source, content }
//   query   — the user's prompt text (required)
//   source  — platform name e.g. "ChatGPT" (optional, default "ChatGPT")
//   content — the full AI response text from the page (optional but recommended)
//             When provided, the summary will cover the full response,
//             not just the query. This is what makes summaries rich and detailed.
// AI automatically assigns tag and summary.
// Returns: { message, search }

router.post("/save", protect, async (req, res) => {
  try {
    const { query, source, content } = req.body;
    const userId = req.user.id;

    // Query is required
    if (!query || query.trim().length === 0) {
      return res.status(400).json({ error: "Search query cannot be empty." });
    }

    // Trim the query
    const cleanQuery   = query.trim();
    // content is the actual AI response text — may be empty for older clients
    const cleanContent = (content || "").trim();

    console.log(`🤖 Groq AI processing: "${cleanQuery.substring(0, 60)}..." (content: ${cleanContent.length} chars)`);

    // Run tag, summary, and short title in parallel (faster)
    // Summary uses the full response content if available, otherwise falls back to query alone
    const [autoTag, autoSummary, shortTitle] = await Promise.all([
      getAutoTag(cleanQuery),
      getAutoSummary(cleanQuery, cleanContent),
      getShortTitle(cleanQuery)
    ]);

    console.log(`✅ Tag: ${autoTag} | ShortTitle: ${shortTitle} | Summary length: ${autoSummary.length} chars`);

    // Save to Supabase — store short title as query (shown in history/dashboard)
    // and preserve the original full prompt in original_query
    const { data: savedSearch, error } = await supabase
      .from("searches")
      .insert({
        user_id:         userId,
        query:           shortTitle,          // short title shown in UI
        original_query:  cleanQuery,          // full original prompt preserved
        source:          source || "ChatGPT",
        tag:             autoTag,
        summary:         autoSummary,
        // Store the raw content so we can use it later for combined summaries.
        // If your Supabase table doesn't have a `content` column yet, add one:
        //   ALTER TABLE searches ADD COLUMN content TEXT;
        content:         cleanContent,
        timestamp:       new Date(),
        is_shared:       false
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


// ── COMBINE SUMMARIES FROM MULTIPLE PLATFORMS ──────────────────
// POST /api/searches/combine
// Protected: YES
// Body: { topic, searchIds }
//   topic     — the common search topic / query text
//   searchIds — array of search IDs to combine (must belong to this user)
//
// This endpoint reads the stored `content` (or `summary` as fallback) for
// each search ID, sends all of it to Groq, and returns a single unified
// multi-paragraph summary covering all platforms.
//
// The extension calls this automatically when it detects the same query
// on multiple platforms. The user can also trigger it manually from the
// history page.
//
// Returns: { message, combinedSummary, platforms, searchCount }

router.post("/combine", protect, async (req, res) => {
  try {
    const { topic, searchIds } = req.body;
    const userId = req.user.id;

    if (!topic || topic.trim().length === 0) {
      return res.status(400).json({ error: "Topic is required." });
    }

    if (!searchIds || !Array.isArray(searchIds) || searchIds.length === 0) {
      return res.status(400).json({ error: "searchIds array is required." });
    }

    if (searchIds.length < 2) {
      return res.status(400).json({ error: "Need at least 2 searches to combine." });
    }

    // Fetch all requested searches — security: only this user's searches
    const { data: searches, error } = await supabase
      .from("searches")
      .select("id, query, source, content, summary")
      .eq("user_id", userId)
      .in("id", searchIds);

    if (error) {
      console.error("Combine — DB fetch error:", error.message);
      return res.status(500).json({ error: "Could not fetch searches." });
    }

    if (!searches || searches.length === 0) {
      return res.status(404).json({ error: "No matching searches found." });
    }

    // Build entries for the AI. Prefer the already-refined `summary` (clean,
    // plain-language prose written by the AI when the search was saved) —
    // raw `content` is the unprocessed page text and is what was causing the
    // combined summary to look like a copy-paste of all 3 platforms.
    // Only fall back to raw content (trimmed) if no summary exists yet.
    const entries = searches.map(s => ({
      source:  s.source || "Unknown",
      query:   s.query,
      content: (s.summary && s.summary.trim().length > 50)
                 ? s.summary
                 : (s.content || "").trim().substring(0, 1500)
    }));

    const platformList = [...new Set(entries.map(e => e.source))];
    console.log(`🔀 Combining ${entries.length} searches from [${platformList.join(", ")}] on topic: "${topic.substring(0,60)}"`);

    // Ask Groq to synthesize everything into one rich summary
    const combinedSummary = await getCombinedSummary(topic.trim(), entries);

    if (!combinedSummary) {
      return res.status(500).json({ error: "AI could not generate a combined summary. Please try again." });
    }

    // Save this combined summary permanently so the user can revisit it
    // later from History → Combined tab without re-selecting and
    // re-combining the same searches again.
    let savedRecord = null;
    try {
      const { data: saved, error: saveErr } = await supabase
        .from("combined_summaries")
        .insert({
          user_id:          userId,
          topic:             topic.trim(),
          combined_summary:  combinedSummary,
          platforms:         platformList,
          source_ids:        searchIds,
          search_count:      searches.length
        })
        .select()
        .single();

      if (saveErr) {
        // Don't fail the whole request if saving fails — the user still
        // gets to see their combined summary, it just won't persist.
        console.error("Combine — could not save combined_summaries row:", saveErr.message);
      } else {
        savedRecord = saved;
      }
    } catch (saveCatchErr) {
      console.error("Combine — save exception:", saveCatchErr.message);
    }

    res.status(200).json({
      message:         "Combined summary generated!",
      combinedSummary: combinedSummary,
      platforms:       platformList,
      searchCount:     searches.length,
      combinedId:      savedRecord ? savedRecord.id : null,
      savedAt:         savedRecord ? savedRecord.created_at : null
    });

  } catch (error) {
    console.error("Combine error:", error.message);
    res.status(500).json({ error: "Server error while combining summaries." });
  }
});


// ── GET SAVED COMBINED SUMMARIES ──────────────────────────────
// GET /api/searches/combined
// Protected: YES
// Returns every combined summary this user has previously generated,
// newest first, so they can be revisited any time from the History page.
// Returns: { message, count, combined }

router.get("/combined", protect, async (req, res) => {
  try {
    const userId = req.user.id;

    const { data, error } = await supabase
      .from("combined_summaries")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Get combined summaries error:", error.message);
      return res.status(500).json({ error: "Could not fetch combined summaries." });
    }

    res.status(200).json({
      message:  "Combined summaries fetched.",
      count:    data ? data.length : 0,
      combined: data || []
    });

  } catch (error) {
    console.error("Get combined summaries error:", error.message);
    res.status(500).json({ error: "Server error while fetching combined summaries." });
  }
});


// ── DELETE A SAVED COMBINED SUMMARY ───────────────────────────
// DELETE /api/searches/combined/:id
// Protected: YES
// Lets the user remove a saved combined summary they no longer want.
// Returns: { message }

router.delete("/combined/:id", protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id }  = req.params;

    const { error } = await supabase
      .from("combined_summaries")
      .delete()
      .eq("id", id)
      .eq("user_id", userId); // security: only delete your own rows

    if (error) {
      console.error("Delete combined summary error:", error.message);
      return res.status(500).json({ error: "Could not delete combined summary." });
    }

    res.status(200).json({ message: "Combined summary deleted." });

  } catch (error) {
    console.error("Delete combined summary error:", error.message);
    res.status(500).json({ error: "Server error while deleting combined summary." });
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

    // Ask Groq to generate a personalized insight
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


// ── CLEAR ALL SEARCHES ────────────────────────────────────────
// DELETE /api/searches/clear
// MUST be defined BEFORE /:id — otherwise Express treats "clear" as an id param
// Protected: YES

router.delete("/clear", protect, async (req, res) => {
  try {
    const userId = req.user.id;

    console.log(`[RecallAI] Clearing all searches for user ${userId}`);

    const { error } = await supabase
      .from("searches")
      .delete()
      .eq("user_id", userId);

    if (error) {
      console.error("Clear all history DB error:", error.message, error.details, error.hint);
      return res.status(500).json({ error: "Could not clear history: " + error.message });
    }

    console.log(`[RecallAI] All searches cleared for user ${userId}`);
    res.status(200).json({ message: "All search history cleared successfully!" });

  } catch (err) {
    console.error("Clear all history error:", err.message);
    res.status(500).json({ error: "Server error while clearing history." });
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
// Goes through all searches tagged as "Other" and re-tags with Groq AI.
// Also regenerates summaries for entries that have very short summaries
// (under 80 chars — likely one-liners from the old version).
// Useful for upgrading old searches saved before the rich summary update.

router.post("/retag-all", protect, async (req, res) => {
  try {
    const userId = req.user.id;

    // Get searches with no proper tag OR very short (one-line) summaries
    const { data: searches, error } = await supabase
      .from("searches")
      .select("id, query, content, summary")
      .eq("user_id", userId)
      .or("tag.eq.Other,summary.eq.,summary.is.null");

    if (error) {
      return res.status(500).json({ error: "Could not fetch searches." });
    }

    // Also grab searches with suspiciously short summaries (< 80 chars = one-liners)
    const { data: shortSummarySearches, error: shortErr } = await supabase
      .from("searches")
      .select("id, query, content, summary")
      .eq("user_id", userId)
      .not("summary", "is", null)
      .lt("summary", "zzz"); // workaround — we'll filter in JS

    if (shortErr) {
      console.warn("Could not fetch short-summary searches:", shortErr.message);
    }

    // Combine: all "Other"/empty + those with short summaries
    const shortOnes = (shortSummarySearches || []).filter(
      s => s.summary && s.summary.trim().length < 80
    );

    // Deduplicate by id
    const allIds = new Set((searches || []).map(s => s.id));
    const combined = [...(searches || [])];
    for (const s of shortOnes) {
      if (!allIds.has(s.id)) {
        combined.push(s);
        allIds.add(s.id);
      }
    }

    if (combined.length === 0) {
      return res.status(200).json({
        message: "All your searches already have AI tags and rich summaries!"
      });
    }

    let updated = 0;

    // Process each search one by one
    for (const search of combined) {
      const cleanContent = (search.content || "").trim();
      // Use original_query if available (full prompt), otherwise fall back to query
      const fullQuery = (search.original_query || search.query || "").trim();
      const [newTag, newSummary, newShortTitle] = await Promise.all([
        getAutoTag(fullQuery),
        getAutoSummary(fullQuery, cleanContent),
        getShortTitle(fullQuery)
      ]);

      await supabase
        .from("searches")
        .update({ tag: newTag, summary: newSummary, query: newShortTitle })
        .eq("id", search.id);

      updated++;
    }

    res.status(200).json({
      message: `Successfully updated ${updated} searches with rich AI summaries!`,
      updated: updated
    });

  } catch (error) {
    console.error("Retag error:", error.message);
    res.status(500).json({ error: "Server error while re-tagging." });
  }
});


module.exports = router;
