#!/usr/bin/env python3
from __future__ import annotations

import argparse
import csv
import os
import sys
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Dict, Iterable, List, Optional, Set
import re

import requests
from dotenv import load_dotenv
import pandas as pd


GOOGLE_ENDPOINT = "https://www.googleapis.com/customsearch/v1"
BING_ENDPOINT = "https://api.bing.microsoft.com/v7.0/search"


@dataclass
class LeadItem:
    name_guess: str
    title_guess: str
    url: str
    snippet: str
    source_engine: str
    fetched_at_iso: str


def normalize_item(title: str, snippet: str, url: str, source: str) -> Dict[str, str]:
    safe_title = (title or "").replace("LinkedIn", "").strip()
    # Strip common separators like "|" and "-" to guess a name-like left side
    name_guess = safe_title.split("|")[0].split(" - ")[0].strip()
    # Single-line, trimmed snippet capped to 120 chars
    single_line_snippet = " ".join((snippet or "").split())
    title_guess = single_line_snippet[:120]
    education = extract_education_from_text(f"{title} \n {snippet}")
    return {
        "name_guess": name_guess,
        "title_guess": title_guess,
        "url": url,
        "snippet": snippet or "",
        "source_engine": source,
        "education": education,
    }


def extract_education_from_text(text: str) -> str:
    """Best-effort heuristic to extract university/education mentions from title/snippet.
    Returns a semicolon-separated list of distinct institutions if multiple.
    """
    if not text:
        return ""
    hay = " ".join(str(text).split())
    patterns = [
        r"([A-Z][A-Za-z.&'\- ]+ University)\b",
        r"([A-Z][A-Za-z.&'\- ]+ College)\b",
        r"([A-Z][A-Za-z.&'\- ]+ Institute of Technology)\b",
        r"(Massachusetts Institute of Technology|MIT)\b",
        r"(California Institute of Technology|Caltech)\b",
        r"([A-Z][A-Za-z.&'\- ]+ School of [A-Z][A-Za-z.&'\- ]+)\b",
        r"([A-Z][A-Za-z.&'\- ]+ Business School)\b",
    ]
    found: Set[str] = set()
    for pat in patterns:
        for m in re.findall(pat, hay):
            inst = m if isinstance(m, str) else m[0]
            inst = inst.strip()
            if inst:
                found.add(inst)
    if not found:
        return ""
    # Preserve stable order by sorting
    return "; ".join(sorted(found))


def require_env(var_name: str) -> str:
    value = os.getenv(var_name)
    if not value:
        print(f"Missing required environment variable: {var_name}")
        sys.exit(1)
    return value


def fetch_google(final_query: str, limit: int, existing_urls: Set[str]) -> List[Dict[str, str]]:
    api_key = require_env("GOOGLE_API_KEY")
    cse_id = require_env("GOOGLE_CSE_ID")

    results: List[Dict[str, str]] = []
    fetched_new = 0
    start_index = 1  # 1-based
    consecutive_zero_new_pages = 0
    session_seen: Set[str] = set()

    while fetched_new < limit and start_index <= 91:  # Google typically caps at ~100 results
        remaining = limit - fetched_new
        num = min(10, remaining)  # Google allows up to 10 per page
        params = {
            "key": api_key,
            "cx": cse_id,
            "q": final_query,
            "num": num,
            "start": start_index,
        }
        try:
            resp = requests.get(GOOGLE_ENDPOINT, params=params, timeout=20)
        except requests.RequestException as e:
            print(f"Google API request failed: {e}")
            sys.exit(1)

        if resp.status_code != 200:
            print(
                f"Google API error: HTTP {resp.status_code}. "
                f"Check your GOOGLE_API_KEY/GOOGLE_CSE_ID and query limits."
            )
            try:
                print(resp.json())
            except Exception:
                pass
            sys.exit(1)

        data = resp.json()
        items = data.get("items", []) or []
        if not items:
            break

        page_new = 0
        for item in items:
            title = item.get("title", "")
            snippet = item.get("snippet", "")
            url = item.get("link", "")
            if "linkedin.com/in" not in (url or ""):
                continue
            url_l = (url or "").lower()
            if not url_l or url_l in existing_urls or url_l in session_seen:
                continue
            results.append(normalize_item(title, snippet, url, "google"))
            session_seen.add(url_l)
            fetched_new += 1
            page_new += 1
            if fetched_new >= limit:
                break

        if page_new == 0:
            consecutive_zero_new_pages += 1
            # Skip ahead more aggressively if we keep seeing duplicates
            if consecutive_zero_new_pages >= 2:
                start_index += 20  # skip two pages
                consecutive_zero_new_pages = 0
            else:
                start_index += num
        else:
            consecutive_zero_new_pages = 0
            start_index += num

        time.sleep(0.2)  # politeness between pages

    return results


def fetch_bing(final_query: str, limit: int, existing_urls: Set[str]) -> List[Dict[str, str]]:
    api_key = require_env("BING_KEY")

    results: List[Dict[str, str]] = []
    fetched_new = 0
    offset = 0
    consecutive_zero_new_pages = 0
    session_seen: Set[str] = set()

    while fetched_new < limit:
        remaining = limit - fetched_new
        count = min(50, remaining)
        headers = {"Ocp-Apim-Subscription-Key": api_key}
        params = {
            "q": final_query,
            "count": count,
            "offset": offset,
        }
        try:
            resp = requests.get(BING_ENDPOINT, headers=headers, params=params, timeout=20)
        except requests.RequestException as e:
            print(f"Bing API request failed: {e}")
            sys.exit(1)

        if resp.status_code != 200:
            print(
                f"Bing API error: HTTP {resp.status_code}. "
                f"Check your BING_KEY and query limits."
            )
            try:
                print(resp.json())
            except Exception:
                pass
            sys.exit(1)

        data = resp.json()
        web_pages = data.get("webPages") or {}
        values = web_pages.get("value", []) or []
        if not values:
            break

        page_new = 0
        for v in values:
            title = v.get("name", "")
            snippet = v.get("snippet", "")
            url = v.get("url", "")
            if "linkedin.com/in" not in (url or ""):
                continue
            url_l = (url or "").lower()
            if not url_l or url_l in existing_urls or url_l in session_seen:
                continue
            results.append(normalize_item(title, snippet, url, "bing"))
            session_seen.add(url_l)
            fetched_new += 1
            page_new += 1
            if fetched_new >= limit:
                break

        if page_new == 0:
            consecutive_zero_new_pages += 1
            # Skip ahead more aggressively if duplicates persist
            if consecutive_zero_new_pages >= 2:
                offset += 100  # skip two pages worth
                consecutive_zero_new_pages = 0
            else:
                offset += count
        else:
            consecutive_zero_new_pages = 0
            offset += count

    return results


def drop_duplicate_urls(items: List[Dict[str, str]]) -> List[Dict[str, str]]:
    seen = set()
    deduped: List[Dict[str, str]] = []
    for it in items:
        url_key = (it.get("url") or "").lower()
        if not url_key or url_key in seen:
            continue
        seen.add(url_key)
        deduped.append(it)
    return deduped


def load_existing_url_set(out_path: str) -> Set[str]:
    existing: Set[str] = set()
    if not os.path.exists(out_path):
        return existing
    try:
        df = pd.read_csv(out_path, usecols=["url"])
        for u in df["url"].dropna().astype(str).tolist():
            existing.add(u.lower())
    except Exception:
        # If the existing file can't be read, treat as no existing
        return existing
    return existing


def save_to_csv(items: List[Dict[str, str]], out_path: str, search_query: str) -> None:
    if not items:
        # Create empty CSV with headers for consistency
        columns = [
            "name_guess",
            "title_guess",
            "url",
            "snippet",
            "source_engine",
            "fetched_at_iso",
            "search_query",
            "education",
        ]
        with open(out_path, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=columns)
            writer.writeheader()
        print(f"Saved 0 leads to {out_path}")
        return

    # Add search query to each item
    for item in items:
        item["search_query"] = search_query

    # Load existing CSV if it exists
    existing_df = pd.DataFrame()
    if os.path.exists(out_path):
        try:
            existing_df = pd.read_csv(out_path)
        except Exception as e:
            print(f"Warning: Could not read existing CSV: {e}")

    # Create new dataframe with current items
    new_df = pd.DataFrame(items)
    
    # Combine existing and new data
    if not existing_df.empty:
        combined_df = pd.concat([existing_df, new_df], ignore_index=True)
    else:
        combined_df = new_df

    # Remove duplicates based on URL (case-insensitive)
    combined_df["url_lower"] = combined_df["url"].str.lower()
    combined_df = combined_df.drop_duplicates(subset=["url_lower"], keep="first")
    combined_df = combined_df.drop("url_lower", axis=1)

    # Save the combined dataframe
    combined_df.to_csv(out_path, index=False)
    
    new_count = len(new_df)
    total_count = len(combined_df)
    print(f"Added {new_count} new leads to {out_path} (total: {total_count})")


def parse_args(argv: Optional[List[str]] = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Discover PUBLIC LinkedIn profile URLs via Google or Bing search APIs. "
            "No LinkedIn scraping."
        )
    )
    parser.add_argument("--query", required=True, help="Free-text search query")
    parser.add_argument(
        "--engine",
        default="google",
        choices=["google", "bing"],
        help="Search engine to use",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=25,
        help="Number of results to request (cap at 50)",
    )
    parser.add_argument(
        "--out",
        default="leads.csv",
        help="Output CSV path",
    )
    parser.add_argument(
        "--write-messages",
        action="store_true",
        help="Generate outreach messages after finding leads",
    )
    return parser.parse_args(argv)


def main(argv: Optional[List[str]] = None) -> None:
    load_dotenv()
    args = parse_args(argv)

    limit = max(0, min(50, int(args.limit)))
    if limit == 0:
        print("Nothing to do: --limit is 0")
        sys.exit(0)

    base_query = args.query.strip()
    if not base_query:
        print("--query cannot be empty")
        sys.exit(1)

    final_query = f"site:linkedin.com/in {base_query}"

    # Build set of existing URLs to ensure we only collect NEW leads
    existing_urls = load_existing_url_set(args.out)

    if args.engine == "google":
        items = fetch_google(final_query, limit, existing_urls)
    else:
        items = fetch_bing(final_query, limit, existing_urls)

    fetched_at_iso = datetime.now(timezone.utc).isoformat()
    items = drop_duplicate_urls(items)
    for it in items:
        it["fetched_at_iso"] = fetched_at_iso

    save_to_csv(items, args.out, base_query)
    
    # Generate outreach messages if requested
    if args.write_messages:
        try:
            from outreach_messages import main as generate_messages
            print("\nGenerating outreach messages...")
            generate_messages(["--csv", args.out])
        except ImportError:
            print("Warning: outreach_messages module not found. Install google-generativeai to use --write-messages")
        except Exception as e:
            print(f"Warning: Failed to generate outreach messages: {e}")


if __name__ == "__main__":
    main()


