// ============================================================
// routes/searchRoutes.js
// Handles all search operations with Groq AI integration:
//   POST   /api/searches/save          — Save + AI tag + rich AI summary (instant — no page-content wait)
//   PATCH  /api/searches/:id/content   — Enrich a saved search with the full AI response once it renders
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

// Import embedding functions (powers Semantic Search)
const { getEmbedding, cosineSimilarity } = require("../embeddingClient");


// ── SAVE A SEARCH ─────────────────────────────────────────────
// POST /api/searches/save
// Protected: YES
// Body: { query, source, content, source_url }
//   query      — the user's prompt text (required)
//   source     — platform name e.g. "ChatGPT" (optional, default "ChatGPT")
//   content    — the full AI response text from the page (optional but recommended)
//                When provided, the summary will cover the full response,
//                not just the query. This is what makes summaries rich and detailed.
//   source_url — the exact page URL the prompt was submitted on (optional).
//                Lets the extension UI link back to the original conversation
//                on the AI platform instead of just showing the summary.
// AI automatically assigns tag and summary.
// Returns: { message, search }

router.post("/save", protect, async (req, res) => {
  try {
    const { query, source, content, source_url } = req.body;
    const userId = req.user.id;

    // Query is required
    if (!query || query.trim().length === 0) {
      return res.status(400).json({ error: "Search query cannot be empty." });
    }

    // Trim the query
    const cleanQuery   = query.trim();
    // content is the actual AI response text — may be empty for older clients
    const cleanContent = (content || "").trim();
    // source_url may be empty for older extension clients that haven't updated yet
    const cleanSourceUrl = (source_url || "").trim();

    console.log(`🤖 Groq AI processing: "${cleanQuery.substring(0, 60)}..." (content: ${cleanContent.length} chars)`);

    // Run tag, summary, and short title in parallel (faster)
    // Summary uses the full response content if available, otherwise falls back to query alone
    const [autoTag, autoSummary, shortTitle] = await Promise.all([
      getAutoTag(cleanQuery),
      getAutoSummary(cleanQuery, cleanContent),
      getShortTitle(cleanQuery)
    ]);

    console.log(`✅ Tag: ${autoTag} | ShortTitle: ${shortTitle} | Summary length: ${autoSummary.length} chars`);

    // Generate a semantic embedding from the short title + summary so
    // this search can later be found by MEANING (Semantic Search),
    // not just by matching exact words. If this fails for any reason
    // (e.g. Groq doesn't have an embeddings endpoint / hiccup), we still
    // save the search normally — it just won't show up in semantic
    // results until it's backfilled via POST /api/searches/embed-all.
    // NOTE: as of writing, Groq's public API does not expose an
    // embeddings endpoint at all (only chat/responses/audio/batches),
    // so getEmbedding() is expected to return null every time until
    // this is pointed at a real embeddings provider. That's fine —
    // it fails soft by design and must never block a save.
    const embedding = await getEmbedding(`${shortTitle}. ${autoSummary}`, "document");

    // Save to Supabase — store short title as query (shown in history/dashboard)
    // and preserve the original full prompt in original_query.
    //
    // Only `user_id`, `query`, `source`, `tag`, `summary`, `timestamp`,
    // `is_shared` are guaranteed to exist on every install (they're in the
    // base CREATE TABLE). `original_query`, `content`, `source_url`, and
    // `embedding` were each added by a separate migration file
    // (short_title_migration.sql, search_response.sql / content column,
    // add_source_url_migration.sql, semantic_search_migration.sql) — if
    // any of those haven't been run yet on this Supabase project, that
    // column won't exist in PostgREST's schema cache, and Supabase
    // rejects the ENTIRE insert the moment the payload references it —
    // not just that field. That's what was happening: Groq AI processing
    // succeeded every time, then the DB insert silently died.
    //
    // Rather than special-case one column, this saves with everything we
    // have, and if Supabase reports a specific column doesn't exist,
    // strips just that field and retries — so a save always goes through
    // with whatever the live schema actually supports, and never gets
    // thrown away entirely over a migration you haven't run yet.
    const insertPayload = {
      user_id:         userId,
      query:           shortTitle,          // short title shown in UI
      original_query:  cleanQuery,          // full original prompt preserved
      source:          source || "ChatGPT",
      tag:             autoTag,
      summary:         autoSummary,
      content:         cleanContent,
      source_url:      cleanSourceUrl || null,
      timestamp:       new Date(),
      is_shared:       false
    };
    if (embedding) insertPayload.embedding = embedding;

    let savedSearch = null;
    let error = null;
    const droppedColumns = [];

    for (let attempt = 0; attempt < 6; attempt++) {
      const result = await supabase.from("searches").insert(insertPayload).select().single();
      savedSearch = result.data;
      error = result.error;

      if (!error) break;

      // Supabase's "column doesn't exist in schema cache" error names the
      // offending column — e.g. "Could not find the 'original_query'
      // column of 'searches' in the schema cache".
      const match = (error.message || "").match(/Could not find the '([^']+)' column/i);
      if (match && Object.prototype.hasOwnProperty.call(insertPayload, match[1])) {
        droppedColumns.push(match[1]);
        delete insertPayload[match[1]];
        continue; // retry without that column
      }

      break; // some other, unrecoverable error
    }

    if (droppedColumns.length) {
      console.warn(`⚠️  Missing column(s) in Supabase 'searches' table, saved without them: ${droppedColumns.join(", ")}. Run the matching migration file(s) and reload the schema cache to stop seeing this.`);
    }

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


// ── ENRICH A SEARCH WITH THE FULL AI RESPONSE (instant-save follow-up) ──
// PATCH /api/searches/:id/content
// Protected: YES
// Body: { content, source_url }
//   content    — the full AI response text, captured AFTER /save already
//                returned (the reply is still streaming/rendering at the
//                moment the prompt itself is saved).
//   source_url — optional — the final conversation URL, once the SPA has
//                assigned one (may not be known yet at the moment /save runs).
//
// WHY THIS EXISTS: the extension now saves the prompt the instant it is
// typed/sent so the user sees it in their history right away, instead of
// waiting (sometimes 10-45s) for the assistant to finish replying. This
// endpoint lets the extension come back a few seconds later with the full
// response text so the AI tag/summary/short-title/embedding can be
// regenerated from the complete conversation — exactly as rich as before,
// just decoupled from the instant save.
// Returns: { message, search }

router.patch("/:id/content", protect, async (req, res) => {
  try {
    const searchId = req.params.id;
    const userId   = req.user.id;
    const { content, source_url } = req.body;

    const cleanContent   = (content || "").trim();
    const cleanSourceUrl = (source_url || "").trim();

    if (!cleanContent && !cleanSourceUrl) {
      return res.status(200).json({ message: "Nothing to update.", search: null });
    }

    const { data: existing, error: findError } = await supabase
      .from("searches")
      .select("id, original_query, query, content, source_url")
      .eq("id", searchId)
      .eq("user_id", userId)
      .single();

    if (findError || !existing) {
      return res.status(404).json({ error: "Search not found or you do not have permission." });
    }

    const fullQuery = (existing.original_query || existing.query || "").trim();
    const updatePayload = {};

    if (cleanSourceUrl) updatePayload.source_url = cleanSourceUrl;

    if (cleanContent && cleanContent !== existing.content) {
      updatePayload.content = cleanContent;

      const [autoTag, autoSummary, shortTitle] = await Promise.all([
        getAutoTag(fullQuery),
        getAutoSummary(fullQuery, cleanContent),
        getShortTitle(fullQuery)
      ]);

      updatePayload.tag     = autoTag;
      updatePayload.summary = autoSummary;
      updatePayload.query   = shortTitle;

      const embedding = await getEmbedding(`${shortTitle}. ${autoSummary}`, "document");
      if (embedding) updatePayload.embedding = embedding;
    }

    if (Object.keys(updatePayload).length === 0) {
      return res.status(200).json({ message: "Nothing to update.", search: existing });
    }

    let updatedSearch = null;
    let error = null;
    const droppedColumns = [];
    const payload = { ...updatePayload };

    for (let attempt = 0; attempt < 6; attempt++) {
      const result = await supabase
        .from("searches")
        .update(payload)
        .eq("id", searchId)
        .eq("user_id", userId)
        .select()
        .single();
      updatedSearch = result.data;
      error = result.error;

      if (!error) break;

      const match = (error.message || "").match(/Could not find the '([^']+)' column/i);
      if (match && Object.prototype.hasOwnProperty.call(payload, match[1])) {
        droppedColumns.push(match[1]);
        delete payload[match[1]];
        continue;
      }
      break;
    }

    if (droppedColumns.length) {
      console.warn(`⚠️  Missing column(s) in Supabase 'searches' table, updated without them: ${droppedColumns.join(", ")}.`);
    }

    if (error) {
      console.error("Enrich search DB error:", error.message);
      return res.status(500).json({ error: "Could not update search." });
    }

    res.status(200).json({
      message: "Search enriched with full response.",
      search:  updatedSearch
    });

  } catch (error) {
    console.error("Enrich search error:", error.message);
    res.status(500).json({ error: "Server error while updating search." });
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


// ── SEMANTIC SEARCH ────────────────────────────────────────────
// GET /api/searches/semantic-search?q=...
// Protected: YES
//
// Finds past searches that are conceptually SIMILAR to the query,
// even when they don't share any exact keywords — e.g. searching
// "car trouble" can surface a saved search about "engine repair
// costs" because they mean similar things, not because they share
// any words.
//
// How it works:
//   1. Turn the user's query into a vector embedding.
//   2. Compare it against every one of the user's saved search
//      embeddings using cosine similarity.
//   3. Return the closest matches, best-first, each with a
//      matchScore (0-100) showing how relevant it is.
//
// Returns: { message, count, query, searches }

router.get("/semantic-search", protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const q      = (req.query.q || "").trim();

    if (!q) {
      return res.status(400).json({ error: "Query text is required." });
    }

    // Turn the live query into a vector. Uses the "query" task type —
    // Nomic embeddings are asymmetric, so queries and stored documents
    // are embedded slightly differently for best retrieval accuracy.
    const queryEmbedding = await getEmbedding(q, "query");

    if (!queryEmbedding) {
      return res.status(503).json({
        error: "Semantic search is temporarily unavailable. Please try again."
      });
    }

    // Pull this user's searches that already have an embedding stored.
    // Anything saved before Semantic Search existed won't have one yet
    // — see POST /api/searches/embed-all to backfill those.
    const { data: searches, error } = await supabase
      .from("searches")
      .select("id, query, original_query, source, tag, summary, timestamp, is_shared, embedding")
      .eq("user_id", userId)
      .not("embedding", "is", null);

    if (error) {
      console.error("Semantic search — DB fetch error:", error.message);
      return res.status(500).json({ error: "Could not fetch searches." });
    }

    // Score every search by how similar its meaning is to the query,
    // then keep only the genuinely relevant ones, best match first.
    const ranked = (searches || [])
      .map(s => {
        const score = cosineSimilarity(queryEmbedding, s.embedding);
        const { embedding, ...rest } = s; // never send raw vectors to the client
        return { ...rest, matchScore: Math.max(0, Math.round(score * 100)) };
      })
      // Below ~30% similarity a result is usually unrelated noise.
      .filter(s => s.matchScore >= 30)
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, 30);

    res.status(200).json({
      message:  "Semantic search complete.",
      count:    ranked.length,
      query:    q,
      searches: ranked
    });

  } catch (error) {
    console.error("Semantic search error:", error.message);
    res.status(500).json({ error: "Server error while running semantic search." });
  }
});


// ── BACKFILL EMBEDDINGS FOR OLDER SEARCHES ────────────────────
// POST /api/searches/embed-all
// Protected: YES
//
// Generates embeddings for any of this user's searches that were
// saved before Semantic Search existed (embedding column is still
// null). Safe to call more than once — already-indexed rows are
// skipped automatically.
//
// Returns: { message, updated }

router.post("/embed-all", protect, async (req, res) => {
  try {
    const userId = req.user.id;

    const { data: searches, error } = await supabase
      .from("searches")
      .select("id, query, summary")
      .eq("user_id", userId)
      .is("embedding", null);

    if (error) {
      console.error("Embed-all — DB fetch error:", error.message);
      return res.status(500).json({ error: "Could not fetch searches." });
    }

    if (!searches || searches.length === 0) {
      return res.status(200).json({
        message: "All your searches are already indexed for semantic search!",
        updated: 0
      });
    }

    let updated = 0;
    for (const s of searches) {
      const text      = `${s.query || ""}. ${s.summary || ""}`.trim();
      const embedding = await getEmbedding(text, "document");

      if (embedding) {
        await supabase.from("searches").update({ embedding }).eq("id", s.id);
        updated++;
      }
    }

    res.status(200).json({
      message: `Indexed ${updated} of ${searches.length} searches for semantic search!`,
      updated: updated
    });

  } catch (error) {
    console.error("Embed-all error:", error.message);
    res.status(500).json({ error: "Server error while indexing searches." });
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

      // Keep the semantic search index in sync with the refreshed
      // title/summary so re-tagged searches stay findable by meaning.
      const newEmbedding = await getEmbedding(`${newShortTitle}. ${newSummary}`, "document");

      await supabase
        .from("searches")
        .update({ tag: newTag, summary: newSummary, query: newShortTitle, embedding: newEmbedding })
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
