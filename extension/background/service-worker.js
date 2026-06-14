const PROVIDERS = {
  openai: {
    label: "OpenAI",
    defaultModel: "gpt-4o-mini",
  },
  anthropic: {
    label: "Anthropic",
    defaultModel: "claude-3-5-haiku-20241022",
  },
  gemini: {
    label: "Gemini",
    defaultModel: "gemini-1.5-flash",
  },
  replicate: {
    label: "Replicate",
    defaultModel: "meta/meta-llama-3-8b-instruct",
  },
};

const DEFAULTS = {
  provider: "openai",
  apiKeys: {
    openai: "",
    anthropic: "",
    gemini: "",
    replicate: "",
  },
  tone: "professional",
  useEmoji: false,
};

const TONE_LABELS = {
  professional: "professional and concise",
  friendly: "warm and conversational",
  thoughtful: "insightful and reflective",
  enthusiastic: "energetic and supportive",
};

const inflightRequests = new Set();

function buildPrompt({ authorName, postText, tone, useEmoji }) {
  const toneDesc = TONE_LABELS[tone] || TONE_LABELS.professional;
  const emojiRule = useEmoji
    ? "You may use 0-1 relevant emoji per comment."
    : "Do not use emojis.";

  return `You write LinkedIn comments in English.

Post author: ${authorName || "Unknown"}
Post content:
"""
${postText || "(No post text found — write a generic professional engagement comment)"}
"""

Write exactly 3 distinct comment suggestions.
Tone: ${toneDesc}
Length: 1-2 sentences each, under 280 characters.
${emojiRule}
Sound human, specific to the post, not generic praise like "Great post!".
Avoid hashtags. Do not mention AI.

Return ONLY a JSON array of 3 strings, no markdown.`;
}

function parseSuggestions(raw) {
  if (!raw) throw new Error("Empty response from AI provider.");

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length) return parsed.slice(0, 3).map(String);
  } catch {
    const match = raw.match(/\[[\s\S]*\]/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      if (Array.isArray(parsed) && parsed.length) return parsed.slice(0, 3).map(String);
    }
  }

  throw new Error("Could not parse AI response.");
}

async function fetchExternal(url, options) {
  if (!url || !url.startsWith("https://")) {
    throw new Error("Blocked unsafe request URL.");
  }

  return fetch(url, options);
}

async function callOpenAI(apiKey, model, prompt) {
  const response = await fetchExternal("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.8,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error?.message || `OpenAI error (${response.status})`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim();
}

async function callAnthropic(apiKey, model, prompt) {
  const response = await fetchExternal("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      temperature: 0.8,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Anthropic error (${response.status})`);
  }

  const data = await response.json();
  return data.content?.map((block) => block.text).join("").trim();
}

async function callGemini(apiKey, model, prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const response = await fetchExternal(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.8 },
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Gemini error (${response.status})`);
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.map((part) => part.text).join("").trim();
}

function normalizeReplicateUrl(url) {
  if (!url || typeof url !== "string") return null;
  if (url.startsWith("https://api.replicate.com")) return url;
  if (url.startsWith("http://") || url.startsWith("https://")) return null;
  return `https://api.replicate.com${url.startsWith("/") ? url : `/${url}`}`;
}

async function pollReplicatePrediction(apiKey, predictionUrl, maxAttempts = 15) {
  const pollUrl = normalizeReplicateUrl(predictionUrl);
  if (!pollUrl) throw new Error("Invalid Replicate polling URL.");

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const response = await fetchExternal(pollUrl, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!response.ok) {
      throw new Error(`Replicate polling error (${response.status}). Check your API token.`);
    }

    const data = await response.json();
    if (data.status === "succeeded") {
      const output = Array.isArray(data.output) ? data.output.join("") : data.output;
      return String(output || "").trim();
    }

    if (data.status === "failed" || data.status === "canceled") {
      throw new Error(data.error || "Replicate prediction failed.");
    }

    await new Promise((resolve) => setTimeout(resolve, 1500));
  }

  throw new Error("Replicate timed out. Try again.");
}

async function callReplicate(apiKey, model, prompt) {
  const response = await fetchExternal(
    `https://api.replicate.com/v1/models/${model}/predictions`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        Prefer: "wait=30",
      },
      body: JSON.stringify({
        input: {
          prompt,
          max_tokens: 1024,
          temperature: 0.8,
        },
      }),
    }
  );

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.detail || err?.title || `Replicate error (${response.status})`);
  }

  const data = await response.json();
  if (data.status === "succeeded") {
    const output = Array.isArray(data.output) ? data.output.join("") : data.output;
    return String(output || "").trim();
  }

  if (data.status === "processing" && data.urls?.get) {
    return pollReplicatePrediction(apiKey, data.urls.get);
  }

  throw new Error("Unexpected Replicate response.");
}

async function generateWithProvider(provider, apiKey, context) {
  const config = PROVIDERS[provider] || PROVIDERS.openai;
  const prompt = buildPrompt(context);

  let raw;
  switch (provider) {
    case "anthropic":
      raw = await callAnthropic(apiKey, config.defaultModel, prompt);
      break;
    case "gemini":
      raw = await callGemini(apiKey, config.defaultModel, prompt);
      break;
    case "replicate":
      raw = await callReplicate(apiKey, config.defaultModel, prompt);
      break;
    default:
      raw = await callOpenAI(apiKey, config.defaultModel, prompt);
  }

  return parseSuggestions(raw);
}

async function getSettings() {
  const stored = await chrome.storage.sync.get({
    provider: DEFAULTS.provider,
    apiKeys: DEFAULTS.apiKeys,
    apiKey: "",
    tone: DEFAULTS.tone,
    useEmoji: DEFAULTS.useEmoji,
  });

  const apiKeys = { ...DEFAULTS.apiKeys, ...(stored.apiKeys || {}) };
  if (stored.apiKey && !apiKeys.openai) {
    apiKeys.openai = stored.apiKey;
  }

  return {
    provider: stored.provider || DEFAULTS.provider,
    apiKeys,
    tone: stored.tone || DEFAULTS.tone,
    useEmoji: Boolean(stored.useEmoji),
  };
}

async function generateComments(context) {
  const settings = await getSettings();
  const provider = settings.provider || "openai";
  const apiKey = settings.apiKeys?.[provider]?.trim();

  if (!apiKey) {
    throw new Error(`Add your ${PROVIDERS[provider]?.label || "AI"} API key in the extension popup.`);
  }

  if (!context.postText?.trim()) {
    throw new Error("Could not read post content. Scroll the post into view and try again.");
  }

  return generateWithProvider(provider, apiKey, {
    ...context,
    tone: settings.tone,
    useEmoji: settings.useEmoji,
  });
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type !== "GENERATE_COMMENTS") return;

  const requestKey = JSON.stringify({
    author: message.payload?.authorName || "",
    text: (message.payload?.postText || "").slice(0, 120),
  });

  if (inflightRequests.has(requestKey)) {
    sendResponse({ ok: false, error: "Generation already in progress. Please wait." });
    return;
  }

  inflightRequests.add(requestKey);

  generateComments(message.payload)
    .then((suggestions) => sendResponse({ ok: true, suggestions }))
    .catch((error) => sendResponse({ ok: false, error: error.message }))
    .finally(() => inflightRequests.delete(requestKey));

  return true;
});
