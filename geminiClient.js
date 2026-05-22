// ============================================================
// geminiClient.js — Recall AI
//
// SWITCHED FROM GEMINI TO GROQ API
// Reason: Gemini free tier quota exhausted on your account.
//
// Groq is 100% free, no quota issues, very fast.
// Get your free key at: https://console.groq.com
// (Sign up → API Keys → Create API Key)
//
// Uses: llama-3.1-8b-instant model (free, fast, accurate)
// ============================================================

require("dotenv").config();

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_URL     = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL   = "llama-3.1-8b-instant";

const VALID_TAGS   = ["Science", "Tech", "Health", "Finance", "History", "Other"];

// ── CORE HELPER — calls Groq API ──────────────────────────────
async function callGroq(systemPrompt, userMessage) {
  try {
    if (!GROQ_API_KEY) {
      console.error("❌ GROQ_API_KEY missing from .env — add it!");
      return null;
    }

    const response = await fetch(GROQ_URL, {
      method:  "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model:       GROQ_MODEL,
        temperature: 0.1,
        max_tokens:  60,
        messages: [
          { role: "system",  content: systemPrompt },
          { role: "user",    content: userMessage  }
        ]
      })
    });

    if (!response.ok) {
      const err = await response.text();
      console.error(`Groq HTTP ${response.status}:`, err.substring(0, 200));
      return null;
    }

    const data = await response.json();
    return data?.choices?.[0]?.message?.content?.trim() || null;

  } catch (err) {
    console.error("Groq fetch error:", err.message);
    return null;
  }
}

// ── AUTO TAG ──────────────────────────────────────────────────
async function getAutoTag(query) {
  try {
    const system =
`You are a search query classifier. Classify queries into exactly one category.
Categories: Science, Tech, Health, Finance, History, Other
Rules:
- Science:  biology, chemistry, physics, space, nature, math, research
- Tech:     programming, AI, software, computers, apps, internet, hardware
- Health:   medicine, fitness, mental health, nutrition, diseases, doctors
- Finance:  money, stocks, investing, banking, crypto, taxes, economy
- History:  past events, wars, civilizations, ancient history, historical figures
- Other:    travel, food, sports, entertainment, relationships, hobbies, anything else
Reply with ONLY the single category word. No punctuation. No explanation.`;

    const raw   = await callGroq(system, `Classify: "${query}"`);

    if (!raw) {
      console.warn(`[Tag] Groq returned null for: "${query}"`);
      return "Other";
    }

    const clean = raw.replace(/[^a-zA-Z]/g, "").trim();
    const match = VALID_TAGS.find(t => t.toLowerCase() === clean.toLowerCase());

    console.log(`[Tag] "${query.substring(0,50)}" → "${match || "Other"}"`);
    return match || "Other";

  } catch (err) {
    console.error("[Tag ERROR]", err.message);
    return "Other";
  }
}


// ── AUTO SUMMARY ──────────────────────────────────────────────
async function getAutoSummary(query) {
  try {
    const system =
`You are a summarizer. Write a short summary of a search query in 12 words or less.
Rules:
- Do NOT start with "This", "The user", "This query", or "This search"
- Describe the topic directly, like labelling a folder
- No punctuation at the end
- No quotes around your answer
Reply with ONLY the summary text. Nothing else.`;

    const raw = await callGroq(system, `Summarize: "${query}"`);

    if (!raw) {
      console.warn(`[Summary] Groq returned null for: "${query}"`);
      return "";
    }

    const summary = raw.replace(/^["'`]+|["'`]+$/g, "").trim().substring(0, 150);
    console.log(`[Summary] "${query.substring(0,50)}" → "${summary}"`);
    return summary;

  } catch (err) {
    console.error("[Summary ERROR]", err.message);
    return "";
  }
}
// ── WEEKLY INSIGHT ────────────────────────────────────────────
async function getWeeklyInsight(searches) {
  try {
    if (!searches || searches.length === 0) {
      return "Start searching on ChatGPT or Claude to see your weekly insights!";
    }

    const list = searches.slice(0, 20).map(s => `- ${s.query}`).join("\n");

    const tagCounts = {};
    searches.forEach(s => {
      if (s.tag) tagCounts[s.tag] = (tagCounts[s.tag] || 0) + 1;
    });
    const topTag = Object.keys(tagCounts)
      .sort((a, b) => tagCounts[b] - tagCounts[a])[0] || "various topics";

    const system =
`You are a helpful assistant for Recall AI, a search history dashboard.
Write ONE short friendly insight sentence (max 20 words) about a user's search patterns.
Make it personal and helpful. Do not start with "You".
Reply with ONLY the sentence. No quotes.`;

    const userMsg =
`The user made ${searches.length} searches this week. Top topic: ${topTag}.
Searches:
${list}`;

    const raw = await callGroq(system, userMsg);

    if (!raw) {
      return `You explored ${topTag} topics ${searches.length} times this week!`;
    }

    return raw.replace(/^["'`]+|["'`]+$/g, "").trim();

  } catch (err) {
    console.error("[Insight ERROR]", err.message);
    return `You made ${searches.length} searches this week. Keep exploring!`;
  }
}


module.exports = { getAutoTag, getAutoSummary, getWeeklyInsight };
