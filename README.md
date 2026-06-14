# LinkedIn Comment AI

Free Chrome extension that generates LinkedIn comment suggestions using your own OpenAI API key.

## MVP scope

- Inject a **Generate** button into LinkedIn comment boxes
- Extract post context (author + text)
- Generate 3 English comment suggestions via OpenAI
- One-click insert into the comment field
- Popup settings: API key, tone, emoji toggle

## Branch strategy

| Branch | Feature |
|--------|---------|
| `main` | Project foundation |
| `feature/extension-scaffold` | Manifest V3, folder structure, icons |
| `feature/settings-popup` | API key storage & tone settings |
| `feature/linkedin-content-script` | LinkedIn DOM injection |
| `feature/comment-generation` | OpenAI integration & suggestion UI |

## Push to GitHub

```bash
gh auth login
chmod +x scripts/push-to-github.sh
./scripts/push-to-github.sh
```

This creates a public repo and pushes all feature branches.

## Setup (local dev)

1. Clone the repo and checkout `feature/comment-generation` for the full MVP.
2. Open Chrome → `chrome://extensions`
3. Enable **Developer mode**
4. Click **Load unpacked** → select the `extension/` folder
5. Open the extension popup → paste your [OpenAI API key](https://platform.openai.com/api-keys)
6. Go to [LinkedIn feed](https://www.linkedin.com/feed/) and click **Generate** on any comment box

## Privacy

- Your API key is stored locally in `chrome.storage.sync`
- Post content is sent only to OpenAI when you click **Generate**
- No server, no account, no tracking

## License

MIT
# linkedin-comment-ai
