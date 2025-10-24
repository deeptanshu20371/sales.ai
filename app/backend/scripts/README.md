Sales.ai Lead Finder (Public LinkedIn via Search APIs)

This minimal CLI discovers PUBLIC LinkedIn profile URLs using search engines' official APIs. It never logs in or fetches LinkedIn pages. Given a free-text query, it queries Google Programmable Search (Custom Search JSON API) or Bing Web Search restricted to site:linkedin.com/in, applies light heuristics to guess a name/title from the search result title/snippet, then writes a CSV locally.

## Setup

1) Create and activate a virtual environment

```bash
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\\Scripts\\activate
```

2) Install dependencies

```bash
pip install -r requirements.txt
```

3) Configure API keys

```bash
cp .env.example .env
# Edit .env to add your keys
```

- Google: Create a Programmable Search Engine (CSE) and enable the "Custom Search API" in Google Cloud. Use `GOOGLE_CSE_ID` for your CSE ID and `GOOGLE_API_KEY` for your API key. Optionally, add `linkedin.com` as a site in your CSE for tighter scoping. Note: Google’s free tier is small; consider Bing if you prefer.
- Bing: Create a Bing Web Search resource in Azure, and use its key as `BING_KEY`.

## Usage

```bash
python leadfinder.py --query 'fintech "New York" product manager' --limit 25 --engine google
python leadfinder.py --query 'AI "San Francisco" founder' --engine bing --out sf_ai_founders.csv
```

Arguments:
- `--query` (required): free-text search query
- `--engine` (optional, default `google`): one of [`google`, `bing`]
- `--limit` (optional, default `25`): number of results to request (cap at 50)
- `--out` (optional, default `leads.csv`): output CSV path

The tool constructs a query like `site:linkedin.com/in <your-query>`, calls the chosen API, filters only results that contain `linkedin.com/in`, lightly normalizes the name/title from result titles/snippets, and saves a CSV with columns: `name_guess, title_guess, url, snippet, source_engine, fetched_at_iso`.

## Outreach message generation

After finding leads, you can generate personalized outreach messages using Google's Gemini AI. The CSV now also includes `education` (best-effort from titles/snippets) and `search_query` columns. Lead appends avoid duplicates by URL.

### Setup for outreach messages

1) Add your Gemini API key to `.env`:
   ```
   GEMINI_API_KEY=your_gemini_api_key_here
   SERVICES="Comprehensive financial planning, investment management, and tax-efficient strategies."
   ```

2) Install the additional dependency:
   ```bash
   pip install google-generativeai
   ```

### Usage

**Option 1: Generate messages during lead finding**
```bash
python leadfinder.py --query 'fintech "New York" product manager' --limit 30 --engine google --out leads.csv --write-messages
```

**Option 2: Generate messages for existing CSV**
```bash
python outreach_messages.py --csv leads.csv --services "Retirement planning, portfolio strategy, tax-aware investing"
```

**Additional options:**
- `--overwrite`: Regenerate messages for rows that already have them
- `--model gemini-1.5-flash`: Choose Gemini model (default: gemini-1.5-flash)
- `--max-chars 300`: Set maximum message length (default: 300)
- `--sleep 0.75`: Seconds to sleep between API calls (rate-limit safety)
- `--goal "I am a wealth manager offering ..."`: High-level goal/context to include in the prompt

The outreach messages are personalized using available CSV fields (name, title, location, company, snippet) and include a brief mention of your services with a clear call-to-action.

## Compliance note

Respect LinkedIn Terms of Service. This tool only uses public search engine APIs and does not access or parse LinkedIn pages, logged-in or otherwise.

