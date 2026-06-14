importScripts("providers.js");

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

  return generateWithProvider(
    provider,
    apiKey,
    {
      ...context,
      tone: settings.tone,
      useEmoji: settings.useEmoji,
    },
    settings,
    TONE_LABELS
  );
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type !== "GENERATE_COMMENTS") return;

  generateComments(message.payload)
    .then((suggestions) => sendResponse({ ok: true, suggestions }))
    .catch((error) => sendResponse({ ok: false, error: error.message }));

  return true;
});
