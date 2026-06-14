# LinkedIn Comment AI

Free Chrome extension that generates LinkedIn comment suggestions using your own AI API key.

## MVP scope

- Inject a **Generate** button into LinkedIn comment boxes
- Extract post context (author + text)
- Generate 3 English comment suggestions
- One-click insert into the comment field
- Popup settings: provider, API key, tone, emoji toggle

## Supported providers

| Provider | Default model |
|----------|---------------|
| OpenAI | gpt-4o-mini |
| Anthropic | claude-3-5-haiku-latest |
| Gemini | gemini-2.0-flash |
| Groq | llama-3.3-70b-versatile |

## Branch strategy

| Branch | Feature |
|--------|---------|
| `main` | Project foundation |
| `feature/extension-scaffold` | Manifest V3, folder structure, icons |
| `feature/settings-popup` | API key storage & tone settings |
| `feature/linkedin-content-script` | LinkedIn DOM injection |
| `feature/comment-generation` | OpenAI integration & suggestion UI |
| `feature/fix-linkedin-dom` | Robust post content extraction for 2026 LinkedIn DOM |
| `feature/multi-provider-settings` | Provider picker UI + OpenAI/Anthropic/Gemini/Groq router |

## Setup (local dev)

1. Clone the repo and checkout `feature/multi-provider-settings` for the latest MVP.
2. Open Chrome → `chrome://extensions`
3. Enable **Developer mode**
4. Click **Load unpacked** → select the `extension/` folder
5. Open the extension popup → pick a provider → paste your API key → **Save settings**
6. Go to [LinkedIn feed](https://www.linkedin.com/feed/) and click **Generate** on any comment box

## Privacy

- API keys are stored locally in `chrome.storage.sync`
- Post content is sent only to your selected provider when you click **Generate**
- No server, no account, no tracking

## License

MIT
