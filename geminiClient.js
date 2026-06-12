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

// Used only for the Combined Summary (cross-platform synthesis).
// This task needs real reasoning/rewriting ability — the 8b model tends to
// just echo chunks of the source text back instead of synthesizing it.
// llama-3.3-70b-versatile is still free on Groq and follows the
// "rewrite, don't copy" instructions far more reliably.
const GROQ_MODEL_SYNTH = "llama-3.3-70b-versatile";

const VALID_TAGS   = ["Science", "Tech", "Health", "Finance", "History", "Sports", "Music", "Fitness", "Other"];

// ── CORE HELPER — calls Groq API ──────────────────────────────
// maxTokens controls how long the response can be.
// For short tasks (tag, label) use 60; for rich summaries use 800.
async function callGroq(systemPrompt, userMessage, maxTokens = 60, model = GROQ_MODEL) {
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
        model:       model,
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
Categories: Science, Tech, Health, Finance, History, Sports, Music, Fitness, Other
Rules:
- Science:  biology, chemistry, physics, space, nature, math, research
- Tech:     programming, AI, software, computers, apps, internet, hardware
- Health:   medicine, mental health, nutrition, diseases, doctors, wellness
- Finance:  money, stocks, investing, banking, crypto, taxes, economy
- History:  past events, wars, civilizations, ancient history, historical figures
- Sports:   football, basketball, cricket, soccer, tennis, athletics, games, teams, players, scores
- Music:    songs, artists, albums, concerts, genres, lyrics, bands, musicians, playlists
- Fitness:  workouts, gym, exercise routines, training, weight loss, bodybuilding, yoga, running
- Other:    travel, food, entertainment, relationships, hobbies, anything else
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


// ── SHORT TITLE ───────────────────────────────────────────────
// Converts a long user prompt into a short, clean topic title (2-5 words).
// e.g. "who is albert einstein and what did he discover" → "Albert Einstein"
// e.g. "explain how transformer neural networks work in deep learning" → "Transformer Neural Networks"
async function getShortTitle(query) {
  try {
    const system =
`You are a title extractor. Convert a user's question or prompt into a short, clean topic title.

Rules:
- Output ONLY 2 to 5 words maximum.
- Extract the core subject or topic being asked about.
- Use title case (capitalize main words).
- Remove question words like "who is", "what is", "explain", "how does", "tell me about".
- No punctuation, no quotes, no full sentences.
- Examples:
  "who is albert einstein?" → "Albert Einstein"
  "explain how black holes form" → "Black Hole Formation"
  "what are the symptoms of diabetes" → "Diabetes Symptoms"
  "best programming languages for web development in 2024" → "Web Development Languages"
Reply with ONLY the short title. Nothing else.`;

    const raw = await callGroq(system, `Convert to short title: "${query}"`, 30);

    if (!raw) {
      console.warn(`[ShortTitle] Groq returned null for: "${query}"`);
      return _fallbackTitle(query);
    }

    const title = raw.replace(/^[\"'`]+|[\"'`]+$/g, "").trim();
    console.log(`[ShortTitle] "${query.substring(0,60)}" → "${title}"`);
    return title;

  } catch (err) {
    console.error("[ShortTitle ERROR]", err.message);
    return _fallbackTitle(query);
  }
}

// Fallback title when Groq is unavailable.
// Strips common question/response openers and returns first 4 meaningful words.
// Prevents garbage like "Innovation Is The Driving Force..." appearing as a title.
function _fallbackTitle(query) {
  const STRIP_PREFIXES = [
    /^(who|what|where|when|why|how)\s+(is|are|was|were|do|does|did|can|could|should|would|has|have|had)\s+/i,
    /^(tell me about|explain|describe|give me|show me|write me|help me|summarize)\s+/i,
    /^(a|an|the)\s+/i,
  ];
  let clean = query.trim();
  // If it looks like an AI response (very long), just say "Search Result"
  if (clean.length > 200) return "Search Result";
  for (const re of STRIP_PREFIXES) {
    clean = clean.replace(re, '');
  }
  // Take first 4 words, title-case them
  return clean
    .split(/\s+/)
    .slice(0, 4)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ') || 'Search Result';
}


// ── AUTO SUMMARY (single platform, rich multi-paragraph) ──────
// Called when saving from one platform.
// `content` is the actual AI response text captured from the page.
// If content is empty, falls back to summarizing from the query alone.
// Detects speech/biography queries and formats them with a speech-style layout.
async function getAutoSummary(query, content = "") {
  try {
    // ── SPEECH / BIOGRAPHY DETECTION ──────────────────────────
    // If the query is about a speech or a biography/person, use a
    // special prompt that returns structured speech-style output with
    // key points and bold quotes.
    const speechPattern = /\b(speech|address|inaugural|keynote|commencement|oration|manifesto|declaration|gettysburg|i have a dream|state of the union|famous speech)\b/i;
    const bioPattern    = /\b(biography|life of|story of|who is|who was|about.{0,40}(president|prime minister|king|queen|leader|founder|inventor|scientist|musician|athlete|actor|author|poet|writer|philosopher|general|emperor|empress|pioneer|activist|revolutionary))\b/i;

    const isSpeech = speechPattern.test(query) || speechPattern.test((content || "").substring(0, 500));
    const isBio    = bioPattern.test(query);

    if (isSpeech || isBio) {
      // ── SPEECH / BIO FORMAT ──────────────────────────────────
      const speechSystem =
`You are an expert at presenting speeches and biographies in a compelling, readable format.

Rules:
- Start with a single short introductory sentence about the speaker or subject and their context.
- Then write "Key Points:" on its own line.
- List 4 to 6 key points, each starting with a bullet "•" on its own line.
- Each key point should be 1-2 sentences and cover one important idea, message, or fact.
- If there are any memorable quotes in the content, include them on their own line.
- All quotes MUST be wrapped in double asterisks like: **"Quote text here."**
- Do NOT use any markdown headers (##) or numbered lists.
- Write in a dignified, engaging tone appropriate for the subject.
- Do NOT start with "This", "The user", "This query".
Reply with ONLY the formatted output described above. Nothing else.`;

      let userMsg;
      if (content && content.trim().length > 100) {
        const trimmedContent = content.trim().substring(0, 6000);
        userMsg = `Topic/Speaker: "${query}"\n\nFull content:\n${trimmedContent}`;
      } else {
        userMsg = `Topic/Speaker: "${query}"\n\nWrite a speech/biography summary with key points and any notable quotes.`;
      }

      const raw = await callGroq(speechSystem, userMsg, 900);

      if (!raw) {
        console.warn(`[Summary/Speech] Groq returned null for: "${query}"`);
        return "";
      }

      const summary = raw.replace(/^["'`]+|["'`]+$/g, "").trim();
      console.log(`[Summary/Speech] "${query.substring(0,50)}" → ${summary.length} chars`);
      return summary;
    }

    // ── STANDARD SUMMARY FORMAT ────────────────────────────────
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

    const summary = raw.replace(/^["'`]+|["'`]+$/g, "").trim();
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
// Returns a rich, REWRITTEN (not copy-pasted) summary in this shape:
//   - 1-2 intro paragraphs in plain, layman-friendly language
//   - a blank line
//   - 4-7 bullet points ("• **Key term** ... (Platform)")
// Front-end (history.js renderCombinedText) turns this into justified
// paragraphs + bold key terms + bullet "insight cards" with platform badges.
async function getCombinedSummary(topic, entries) {
  try {
    if (!entries || entries.length === 0) {
      return "";
    }

    // Keep each platform's slice short and CLEAN. Long, raw, markdown-heavy
    // platform output is what causes the model to just copy/paste chunks
    // back verbatim instead of synthesizing — so we cap aggressively.
    const combinedContent = entries.map((e, i) => {
      const src  = e.source || "Unknown";
      const text = (e.content || e.query || "").trim().replace(/\s+/g, " ").substring(0, 1500);
      return `SOURCE ${i + 1} (${src}):\n${text}`;
    }).join("\n\n");

    const platformList    = [...new Set(entries.map(e => e.source))].join(", ");
    const totalPlatforms  = entries.length;

    const system =
`You are a research synthesizer and editor. You will be given notes about the SAME topic, gathered from ${totalPlatforms} different AI platforms (${platformList}).

YOUR JOB:
Read all the sources, figure out what they have in common and what unique points each one adds, and then WRITE A BRAND NEW EXPLANATION OF THE TOPIC IN YOUR OWN WORDS — simple enough for a layperson to understand. You are creating an original piece of writing that merges and refines the ideas, not a copy of the input.

ABSOLUTE RULES (breaking these makes the output useless):
- NEVER copy a run of more than 6 words in a row from any source. Rephrase everything.
- NEVER reproduce the sources' own sentence structure, headings, or bullet lists — restructure from scratch.
- Do NOT mention the sources, the platforms, the word "summary", or phrases like "according to" inside your sentences (citations are handled separately, see below).
- Do NOT start with "This", "The user", "This query", "This summary", "Based on", or "These sources".
- Write for someone with no background knowledge — explain plainly, like you're talking to a curious friend.

OUTPUT FORMAT (follow exactly):
1. Write 1 to 2 short paragraphs of flowing prose that introduce and explain the topic, combining the overlapping core ideas from all sources into ONE coherent explanation (the "intersection" of what they all agree on, told simply).
2. Leave one blank line.
3. Then write 4 to 7 bullet points. Each bullet is ONE distinct, important, non-overlapping fact or takeaway (notable points that came from one or more sources). Each bullet starts with the character •
4. In both the paragraphs and the bullets, wrap the 1-3 most important key terms per sentence in double asterisks, e.g. **photosynthesis**, **machine learning**.
5. Every sentence (in paragraphs AND bullets) must end with a citation in parentheses naming the platform(s) that contributed that idea, written right before the period, e.g. ...(ChatGPT) or ...(Claude)(Gemini). Use only these platform names when citing: ${platformList}.

EXAMPLE SHAPE (style only — write fresh content for the real topic):
Plants make their own food using sunlight through a process that converts light energy into chemical energy(ChatGPT). This happens inside tiny structures in the leaves and is the reason plants are green(Claude).

• **Chlorophyll** is the pigment that absorbs sunlight and gives leaves their green color(Gemini).
• The process also produces oxygen as a byproduct, which is why plants are important for breathable air(ChatGPT)(Claude).

STRICT FORMATTING — no markdown headers (##), no numbered lists, no asterisk bullets (use • only), no preamble or closing remarks. Reply with ONLY the paragraphs and bullets described above.`;

    const userMsg = `Topic: "${topic}"\n\nSource notes:\n\n${combinedContent}`;

    // Primary attempt: stronger model for real synthesis.
    let raw = await callGroq(system, userMsg, 1400, GROQ_MODEL_SYNTH);

    // Fallback: if the synthesis model is unavailable/rate-limited, retry
    // with the default fast model rather than failing outright.
    if (!raw) {
      console.warn(`[CombinedSummary] ${GROQ_MODEL_SYNTH} failed, falling back to ${GROQ_MODEL}`);
      raw = await callGroq(system, userMsg, 1400, GROQ_MODEL);
    }

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


module.exports = { getAutoTag, getAutoSummary, getCombinedSummary, getWeeklyInsight, getShortTitle };
