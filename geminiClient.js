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
// maxTokens controls how long the response can be.
// For short tasks (tag, label) use 60; for rich summaries use 800.
async function callGroq(systemPrompt, userMessage, maxTokens = 60) {
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
        temperature: 0.3,
        max_tokens:  maxTokens,
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

    const raw   = await callGroq(system, `Classify: "${query}"`, 60);

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


// ── AUTO SUMMARY (single platform, rich multi-paragraph) ──────
// Called when saving from one platform.
// `content` is the actual AI response text captured from the page.
// If content is empty, falls back to summarizing from the query alone.
async function getAutoSummary(query, content = "") {
  try {
    const system =
`You are an expert summarizer. Your job is to write a clear, informative summary.

Rules:
- Write 1 to 2 paragraphs (not one line, not one sentence — real paragraphs).
- Each paragraph should be 3 to 5 sentences.
- Cover the most important points from the full content provided.
- Do NOT start with "This", "The user", "This query", or "This search".
- Do NOT use bullet points or numbered lists — write in flowing prose.
- Do NOT use any markdown formatting like ** or ##.
- Speak directly about the topic itself.
- End without any trailing question or prompt.
Reply with ONLY the summary paragraphs. Nothing else.`;

    let userMsg;
    if (content && content.trim().length > 100) {
      // We have the real AI response — summarize that
      const trimmedContent = content.trim().substring(0, 6000); // cap to avoid token overflow
      userMsg = `Topic: "${query}"\n\nFull content to summarize:\n${trimmedContent}`;
    } else {
      // No content captured — summarize from the query alone
      userMsg = `Write a 1-2 paragraph summary about the topic: "${query}"`;
    }

    const raw = await callGroq(system, userMsg, 800);

    if (!raw) {
      console.warn(`[Summary] Groq returned null for: "${query}"`);
      return "";
    }

    const summary = raw.replace(/^[\"'`]+|[\"'`]+$/g, "").trim();
    console.log(`[Summary] "${query.substring(0,50)}" → ${summary.length} chars`);
    return summary;

  } catch (err) {
    console.error("[Summary ERROR]", err.message);
    return "";
  }
}


// ── COMBINED SUMMARY (multi-platform cross-search) ────────────
// Called when the user has searched the same topic across multiple platforms.
// `entries` is an array of { source, query, content } objects.
// Returns a rich 3-5 paragraph summary with (Platform) citation markers
// at the end of sentences showing which platform each fact came from.
async function getCombinedSummary(topic, entries) {
  try {
    if (!entries || entries.length === 0) {
      return "";
    }

    // Build the combined content block from all platforms
    const combinedContent = entries.map(e => {
      const src = e.source || "Unknown";
      const text = (e.content || e.query || "").trim().substring(0, 4000);
      return `--- From ${src} ---\n${text}`;
    }).join("\n\n");

    const platformList = entries.map(e => e.source).join(", ");
    const totalPlatforms = entries.length;

    const system =
`You are an expert research synthesizer. You have been given content about the same topic from ${totalPlatforms} different AI platforms: ${platformList}.

Your job is to read ALL the content and write a rich, structured summary using this EXACT FORMAT:

FORMAT RULES:
1. Start with 1 to 2 paragraphs of flowing prose covering the core explanation. These are regular sentences — no bullets here.
2. After the paragraphs, write a section of key bullet points. Each bullet starts with a bullet character: •
3. Each bullet point covers ONE important fact, takeaway, or must-know point.
4. Write 4 to 7 bullet points total.
5. Inside bullet points AND inside paragraphs, wrap important terms or key concepts in double asterisks: **term**
   Examples: **machine learning**, **neural network**, **gradient descent**
6. Every sentence (in paragraphs AND in bullets) must end with a platform citation in parentheses showing which platform that info came from.
   Format: ...(ChatGPT) or ...(Claude) or ...(Gemini) or ...(ChatGPT)(Claude) if from multiple.
   The citation goes right before the period/full stop.

EXAMPLE OUTPUT FORMAT:
Artificial intelligence is a broad field of computer science focused on building systems that mimic human intelligence(ChatGPT). The field has grown rapidly since the 1950s and now powers many everyday technologies(Claude).

• **Machine learning** is the most widely used branch of AI today(ChatGPT)(Gemini).
• **Neural networks** are inspired by the human brain and form the basis of deep learning(Claude).
• AI systems require large amounts of **training data** to learn patterns effectively(Gemini).

WRITING RULES:
- Do NOT start with "This", "The user", "This query", "This summary", or "Based on".
- Do NOT use markdown headers like ## or *.
- Do NOT number the bullet points.
- Keep language clear and informative.
- Separate paragraphs and the bullet section with a blank line.

Reply with ONLY the formatted summary. Nothing else.`;

    const userMsg = `Topic: "${topic}"\n\nContent from all platforms:\n\n${combinedContent}`;

    const raw = await callGroq(system, userMsg, 1600);

    if (!raw) {
      console.warn(`[CombinedSummary] Groq returned null for topic: "${topic}"`);
      return "";
    }

    const summary = raw.replace(/^[\"'`]+|[\"'`]+$/g, "").trim();
    console.log(`[CombinedSummary] "${topic.substring(0,50)}" from ${totalPlatforms} platforms → ${summary.length} chars`);
    return summary;

  } catch (err) {
    console.error("[CombinedSummary ERROR]", err.message);
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

    const raw = await callGroq(system, userMsg, 60);

    if (!raw) {
      return `You explored ${topTag} topics ${searches.length} times this week!`;
    }

    return raw.replace(/^[\"'`]+|[\"'`]+$/g, "").trim();

  } catch (err) {
    console.error("[Insight ERROR]", err.message);
    return `You made ${searches.length} searches this week. Keep exploring!`;
  }
}


module.exports = { getAutoTag, getAutoSummary, getCombinedSummary, getWeeklyInsight }; 
