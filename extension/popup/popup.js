const PROVIDER_CONFIG = {
  openai: {
    label: "OpenAI API Key",
    placeholder: "sk-...",
    keyUrl: "https://platform.openai.com/api-keys",
  },
  anthropic: {
    label: "Anthropic API Key",
    placeholder: "sk-ant-...",
    keyUrl: "https://console.anthropic.com/settings/keys",
  },
  gemini: {
    label: "Gemini API Key",
    placeholder: "AI...",
    keyUrl: "https://aistudio.google.com/apikey",
  },
  replicate: {
    label: "Replicate API Token",
    placeholder: "r8_...",
    keyUrl: "https://replicate.com/account/api-tokens",
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

const form = document.getElementById("settings-form");
const apiKeyInput = document.getElementById("api-key");
const apiKeyLabel = document.getElementById("api-key-label");
const keyLink = document.getElementById("key-link");
const keyStatus = document.getElementById("key-status");
const toggleKeyBtn = document.getElementById("toggle-key");
const useEmojiCheckbox = document.getElementById("use-emoji");
const statusEl = document.getElementById("status");
const providerInputs = [...document.querySelectorAll('input[name="provider"]')];
const toneInputs = [...document.querySelectorAll('input[name="tone"]')];

let currentProvider = DEFAULTS.provider;
let apiKeys = { ...DEFAULTS.apiKeys };

function showStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.classList.toggle("error", isError);
}

function getSelectedProvider() {
  return providerInputs.find((input) => input.checked)?.value || DEFAULTS.provider;
}

function getSelectedTone() {
  return toneInputs.find((input) => input.checked)?.value || DEFAULTS.tone;
}

function updateProviderUI() {
  const provider = getSelectedProvider();
  const config = PROVIDER_CONFIG[provider];
  currentProvider = provider;

  apiKeyLabel.textContent = config.label;
  apiKeyInput.placeholder = config.placeholder;
  apiKeyInput.value = apiKeys[provider] || "";
  keyLink.href = config.keyUrl;
  keyLink.textContent = "Get key →";

  const hasKey = Boolean(apiKeys[provider]?.trim());
  keyStatus.textContent = hasKey ? "Saved" : "Not set";
  keyStatus.classList.toggle("key-status--saved", hasKey);
  keyStatus.classList.toggle("key-status--empty", !hasKey);
}

function persistCurrentKey() {
  apiKeys[currentProvider] = apiKeyInput.value.trim();
}

async function loadSettings() {
  const stored = await chrome.storage.sync.get({
    provider: DEFAULTS.provider,
    apiKeys: DEFAULTS.apiKeys,
    apiKey: "",
    tone: DEFAULTS.tone,
    useEmoji: DEFAULTS.useEmoji,
  });

  apiKeys = { ...DEFAULTS.apiKeys, ...(stored.apiKeys || {}) };
  if (stored.apiKey && !apiKeys.openai) {
    apiKeys.openai = stored.apiKey;
  }

  const provider = stored.provider || DEFAULTS.provider;
  providerInputs.forEach((input) => {
    input.checked = input.value === provider;
  });

  toneInputs.forEach((input) => {
    input.checked = input.value === (stored.tone || DEFAULTS.tone);
  });

  useEmojiCheckbox.checked = Boolean(stored.useEmoji);
  updateProviderUI();
}

providerInputs.forEach((input) => {
  input.addEventListener("change", () => {
    persistCurrentKey();
    updateProviderUI();
    showStatus("");
  });
});

apiKeyInput.addEventListener("input", () => {
  const hasKey = Boolean(apiKeyInput.value.trim());
  keyStatus.textContent = hasKey ? "Ready" : "Not set";
  keyStatus.classList.toggle("key-status--saved", hasKey);
  keyStatus.classList.toggle("key-status--empty", !hasKey);
});

toggleKeyBtn.addEventListener("click", () => {
  const isHidden = apiKeyInput.type === "password";
  apiKeyInput.type = isHidden ? "text" : "password";
  toggleKeyBtn.textContent = isHidden ? "Hide" : "Show";
  toggleKeyBtn.setAttribute("aria-label", isHidden ? "Hide API key" : "Show API key");
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  persistCurrentKey();

  const provider = getSelectedProvider();
  const tone = getSelectedTone();
  const useEmoji = useEmojiCheckbox.checked;

  await chrome.storage.sync.set({
    provider,
    apiKeys,
    tone,
    useEmoji,
  });

  updateProviderUI();
  showStatus("Settings saved.");
});

loadSettings();
