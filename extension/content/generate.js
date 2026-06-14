(function initLcaiGenerate() {
  if (!chrome?.runtime?.id) return;

  if (window.__LCAI_GENERATE__) {
    window.dispatchEvent(new CustomEvent("lcai:cleanup"));
  }
  window.__LCAI_GENERATE__ = true;

  const LCAI_PROVIDERS = {
    openai: { label: "OpenAI", defaultModel: "gpt-4o-mini" },
    anthropic: { label: "Anthropic", defaultModel: "claude-3-5-haiku-20241022" },
    gemini: { label: "Gemini", defaultModel: "gemini-2.5-flash" },
    groq: { label: "Groq", defaultModel: "llama-3.3-70b-versatile" },
  };

  const LCAI_DEFAULTS = {
    provider: "openai",
    apiKeys: { openai: "", anthropic: "", gemini: "", groq: "" },
    tone: "professional",
    useEmoji: false,
  };

  const LCAI_TONE_LABELS = {
    professional: "professional and concise",
    friendly: "warm and conversational",
    thoughtful: "insightful and reflective",
    enthusiastic: "energetic and supportive",
  };

  let lcaiInflight = false;

  function lcaiBuildPrompt({ authorName, postText, tone, useEmoji }) {
    const toneDesc = LCAI_TONE_LABELS[tone] || LCAI_TONE_LABELS.professional;
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

  function lcaiParseSuggestions(raw) {
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

  async function lcaiFetchExternal(url, options) {
    if (!url || !url.startsWith("https://")) {
      throw new Error("Blocked unsafe request URL.");
    }
    return fetch(url, options);
  }

  async function lcaiCallOpenAI(apiKey, model, prompt) {
    const response = await lcaiFetchExternal("https://api.openai.com/v1/chat/completions", {
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

  async function lcaiCallAnthropic(apiKey, model, prompt) {
    const response = await lcaiFetchExternal("https://api.anthropic.com/v1/messages", {
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

  const LCAI_GEMINI_MODELS = [
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-3.5-flash",
  ];

  async function lcaiCallGeminiOnce(apiKey, model, prompt) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const response = await lcaiFetchExternal(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.8 },
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      const message = err?.error?.message || `Gemini error (${response.status})`;
      const retryable = response.status === 404 || /not found|not supported/i.test(message);
      const error = new Error(message);
      error.retryable = retryable;
      throw error;
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.map((part) => part.text).join("").trim();
  }

  async function lcaiCallGemini(apiKey, model, prompt) {
    const models = [model, ...LCAI_GEMINI_MODELS.filter((m) => m !== model)];
    let lastError;

    for (const candidate of models) {
      try {
        return await lcaiCallGeminiOnce(apiKey, candidate, prompt);
      } catch (error) {
        lastError = error;
        if (!error.retryable) throw error;
      }
    }

    throw lastError || new Error("No Gemini model available for your API key.");
  }

  async function lcaiCallGroq(apiKey, model, prompt) {
    const response = await lcaiFetchExternal("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.8,
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err?.error?.message || `Groq error (${response.status})`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content?.trim();
  }

  async function lcaiGetSettings() {
    const stored = await chrome.storage.sync.get({
      provider: LCAI_DEFAULTS.provider,
      apiKeys: LCAI_DEFAULTS.apiKeys,
      apiKey: "",
      tone: LCAI_DEFAULTS.tone,
      useEmoji: LCAI_DEFAULTS.useEmoji,
    });

    const apiKeys = { ...LCAI_DEFAULTS.apiKeys, ...(stored.apiKeys || {}) };
    if (stored.apiKey && !apiKeys.openai) {
      apiKeys.openai = stored.apiKey;
    }
    if (stored.apiKeys?.replicate && !apiKeys.groq) {
      apiKeys.groq = stored.apiKeys.replicate;
    }

    let provider = stored.provider || LCAI_DEFAULTS.provider;
    if (provider === "replicate") provider = "groq";

    return {
      provider,
      apiKeys,
      tone: stored.tone || LCAI_DEFAULTS.tone,
      useEmoji: Boolean(stored.useEmoji),
    };
  }

  window.lcaiGenerateComments = async function lcaiGenerateComments(context) {
    if (!chrome?.runtime?.id) {
      throw new Error("Extension reloaded. Hard-refresh this LinkedIn tab (Cmd+Shift+R).");
    }

    if (lcaiInflight) {
      throw new Error("Generation already in progress. Please wait.");
    }

    lcaiInflight = true;
    try {
      const settings = await lcaiGetSettings();
      const provider = settings.provider || "openai";
      const apiKey = settings.apiKeys?.[provider]?.trim();
      const config = LCAI_PROVIDERS[provider] || LCAI_PROVIDERS.openai;

      if (!apiKey) {
        throw new Error(`Add your ${config.label} API key in the extension popup.`);
      }

      if (!context.postText?.trim()) {
        throw new Error("Could not read post content. Scroll the post into view and try again.");
      }

      const prompt = lcaiBuildPrompt({
        ...context,
        tone: settings.tone,
        useEmoji: settings.useEmoji,
      });

      let raw;
      switch (provider) {
        case "anthropic":
          raw = await lcaiCallAnthropic(apiKey, config.defaultModel, prompt);
          break;
        case "gemini":
          raw = await lcaiCallGemini(apiKey, config.defaultModel, prompt);
          break;
        case "groq":
          raw = await lcaiCallGroq(apiKey, config.defaultModel, prompt);
          break;
        default:
          raw = await lcaiCallOpenAI(apiKey, config.defaultModel, prompt);
      }

      return lcaiParseSuggestions(raw);
    } finally {
      lcaiInflight = false;
    }
  };
})();
