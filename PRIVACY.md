# Privacy Policy — LinkedIn Comment AI

**Last updated:** June 18, 2026  
**Extension:** LinkedIn Comment AI  
**Developer:** Hamza Uguz  
**Contact:** [linkedin.com/in/hamzauguz](https://www.linkedin.com/in/hamzauguz)

## Overview

LinkedIn Comment AI is a free Chrome extension that helps you write LinkedIn comment suggestions using your own AI API key (Bring Your Own Key / BYOK).

This extension does **not** operate a backend server. Your settings stay in your browser, and data is sent to third-party AI providers **only when you click Generate**.

## Data we collect

### Authentication information (stored locally)

When you save settings in the extension popup, the following is stored in **Chrome local storage** (`chrome.storage.sync`) on your device:

- Your API key(s) for the provider(s) you configure (OpenAI, Anthropic, Google Gemini, or Groq)
- Your selected AI provider
- Your default comment tone preference
- Your emoji on/off preference

This data is **not** sent to the extension developer. It remains on your device and in your synced Chrome profile (if you use Chrome sync).

### Website content (processed on demand)

When you click **Generate** on a LinkedIn comment box, the extension reads from the current LinkedIn page:

- The visible text of the post you are commenting on
- The post author’s display name (if visible on the page)

This content is used only to create comment suggestions. It is sent to the **AI provider you selected**, using **your API key**, to generate suggestions. The extension developer does not receive or store this content.

## What we do not collect

The extension does **not** collect:

- Your name, email address, or LinkedIn account credentials
- Your browsing history or a list of pages you visit
- Health, financial, or location data
- Personal communications (email, chat messages, etc.)
- Keystrokes, mouse movements, scroll behavior, or general activity tracking

## How data is used

All collected data is used for a **single purpose**: generating LinkedIn comment suggestions when you request them.

- API keys are used to authenticate requests to your chosen AI provider
- Post content is used as context for AI-generated comment suggestions
- Preferences are used to apply your default tone and emoji settings

Data is **not** used for advertising, analytics, profiling, credit decisions, or any purpose unrelated to comment generation.

## Third-party services

When you click **Generate**, post context is sent directly from your browser to the AI provider you selected:

| Provider | API endpoint |
|----------|----------------|
| OpenAI | `api.openai.com` |
| Anthropic | `api.anthropic.com` |
| Google Gemini | `generativelanguage.googleapis.com` |
| Groq | `api.groq.com` |

Each provider has its own privacy policy and terms. You are responsible for your API usage and any costs charged by that provider.

LinkedIn (`linkedin.com`) is used only so the extension can inject the Generate button and read post content from pages you are already viewing.

## Data sharing and sale

- We **do not sell** your data
- We **do not transfer** your data to third parties for unrelated purposes
- We **do not** use your data to determine creditworthiness or for lending purposes

The only transfers are to the AI provider **you choose**, and **only when you click Generate**.

## Data retention

- Settings and API keys remain in your browser until you remove them or uninstall the extension
- The extension does not maintain a separate database or server-side storage
- Generated comment suggestions are shown in the page UI and are not stored by the extension author

## Your choices

You can:

- Remove or change your API key at any time in the extension popup
- Stop using the extension by disabling or uninstalling it from `chrome://extensions`
- Choose which AI provider to use (or stop using the extension entirely)

## Children

This extension is not directed at children under 13, and we do not knowingly collect personal information from children.

## Changes to this policy

We may update this privacy policy from time to time. Updates will be posted in this repository. The “Last updated” date at the top will reflect the latest version.

## Contact

Questions about this privacy policy or the extension:

**Hamza Uguz** — [https://www.linkedin.com/in/hamzauguz](https://www.linkedin.com/in/hamzauguz)
