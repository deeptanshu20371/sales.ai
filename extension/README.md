# Sales.ai – Developer Guide

Sales.ai is a Chrome extension plus a small FastAPI backend. On LinkedIn profile pages, the content script scrapes page data, asks the backend to generate a short, personalized message with an LLM, opens the LinkedIn message UI, and inserts the text.

## Repository layout

- `extension/`
  - `chrome-extension/`
    - `manifest.json` – Extension manifest (permissions, content scripts, service worker). Ensure the load order of content scripts remains: `config.js`, `content_scrape.js`, `content_dom.js`, `content.js`.
    - `background.js` – Service worker. Listens for `generate_ai_message` and calls the backend using the URL from `config.js`.
    - `config.js` – Centralized config. Set the backend URL here (e.g., `http://localhost:8080`).
    - `content_scrape.js` – Scraping utilities exposed on `window.GENREACH.scrape` (e.g., `getProfileInfo()`, `getExtendedProfile()`). No DOM writes here.
    - `content_dom.js` – DOM utilities exposed on `window.GENREACH.dom` for locating message inputs and inserting text (`ensureMessageUIOpen()`, `injectMessage()`, etc.).
    - `content.js` – Orchestration. Boots the in-page panel, wires button events, calls scraper and backend, and uses DOM helpers to insert the AI message.
    - `panel.html` – Shadow DOM HTML/CSS for the in-page floating panel UI (intent field, status, button).
  - `backend/`
    - `main.py` – FastAPI app exposing `/api/generate`. Forwards to OpenRouter.
    - `prompts.py` – Contains:
      - `get_system_prompt()` – system prompt and guardrails
      - `build_user_payload()` – constructs the user JSON payload
      - `build_user_content()` – builds the final user content string for the API
    - `requirements.txt` – Backend dependencies.

## Where to edit the AI prompt and model

- Prompt lives in `extension/backend/prompts.py` → edit `get_system_prompt()`.
- The user message content is built via `build_user_content()` in `prompts.py` from scraped data and the user-provided intent.
- Model id is defined in `main.py` as `MODEL` (e.g., `meta-llama/llama-3.3-8b-instruct:free`).

Typical changes:
- Shorten/lengthen message, change tone, or add constraints by editing `get_system_prompt()` and the `instruction`/`intent` semantics used to compose `user_content` in `main.py`.
- Swap the model by updating `MODEL` (ensure it’s available to your OpenRouter key).

## Backend setup

1) Configure environment

Create `.env` in `extension/backend/` or export env vars before running:

```
OPENROUTER_API_KEY=sk-or-...
PORT=8080
```

2) Create venv, install, run

```bash
cd extension/backend
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
python -m uvicorn main:app --host 0.0.0.0 --port 8080 --reload
### After editing prompts

Changes to `prompts.py` take effect after restarting the backend. With `--reload`, saving the file triggers automatic reload during development.

```

3) Health check

```bash
curl http://localhost:8080/health
```

## Extension setup and run

1) Configure backend URL

Edit `extension/chrome-extension/config.js`:

```js
self.GENREACH_CONFIG = { BACKEND_URL: 'http://localhost:8080' };
```

2) Load the extension in Chrome

- Go to `chrome://extensions`
- Enable Developer Mode
- Load unpacked → choose `extension/chrome-extension/`

3) Use

- Visit a LinkedIn profile (URL contains `linkedin.com/in/` and not `/edit`).
- Click the Sales.ai toolbar icon to toggle the in-page panel.
- Enter an intent (e.g., "intro for partnership, ask for call"), click Generate & Fill.

## How data flows

1) `content.js` calls `window.GENREACH.scrape.getProfileInfo()` and `getExtendedProfile()`.
2) `background.js` reads `BACKEND_URL` from `config.js` and posts the payload to `/api/generate`.
3) Backend composes the model messages (system prompt + user content) and calls OpenRouter.
4) Response `.message` is returned → `content.js` opens the LinkedIn message UI → `window.GENREACH.dom.injectMessage()` inserts the text.

## Developer notes

- CORS: `backend/main.py` enables permissive CORS for development.
- Errors and fallbacks:
  - If backend fails, the panel shows a clear error (no JSON fallback is inserted).
  - `content.js` uses module functions if present and otherwise does minimal fallbacks (during refactors only).
- Editing the panel UI: change `extension/chrome-extension/panel.html`.
- Tight permissions: `manifest.json` only grants LinkedIn hosts and minimal APIs.

## Common tasks

- Change the model or temperature: edit `MODEL` and parameters in `backend/main.py` request body.
- Adjust prompt format: tweak `system` and the `user_content` string composition in `backend/main.py`.
- Add new scrape fields: extend `content_scrape.js` (e.g., add `extractProjects()`), and include it in `getExtendedProfile()`.
- Modify insertion behavior: update `content_dom.js` (`findMessageInput`, `injectMessage`).

## Troubleshooting

- Backend 400/500: check terminal logs for `OpenRouter error`. Verify API key and model id.
- Network errors: confirm `BACKEND_URL` in `config.js` and that the backend is running.
- Service worker logs: open the extension card → “service worker” link → watch console while clicking Generate.
- Content script not loaded: ensure the page is a LinkedIn profile and the content script order in `manifest.json` is correct.
