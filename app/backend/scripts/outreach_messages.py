#!/usr/bin/env python3
from __future__ import annotations

import argparse
import os
import sys
import time
from typing import Dict, Optional

import google.generativeai as genai
import pandas as pd
from dotenv import load_dotenv


def extract_personalization_fields(row: pd.Series) -> Dict[str, str]:
    """Extract personalization fields from a CSV row."""
    # Name: prefer fullName, then name_guess, then username (title-cased)
    name = ""
    for field in ["fullName", "name_guess", "username"]:
        if field in row and pd.notna(row[field]) and str(row[field]).strip():
            name = str(row[field]).strip()
            if field == "username":
                # Convert username to title case for better presentation
                name = name.replace(".", " ").replace("_", " ").title()
            break
    
    # Title: prefer headline, then title_guess
    title = ""
    for field in ["headline", "title_guess"]:
        if field in row and pd.notna(row[field]) and str(row[field]).strip():
            title = str(row[field]).strip()
            break
    
    # Other fields
    location = str(row.get("location", "")).strip() if pd.notna(row.get("location")) else ""
    company = str(row.get("company", "")).strip() if pd.notna(row.get("company")) else ""
    url = str(row.get("url", "")).strip() if pd.notna(row.get("url")) else ""
    snippet = str(row.get("snippet", "")).strip() if pd.notna(row.get("snippet")) else ""
    education = str(row.get("education", "")).strip() if pd.notna(row.get("education")) else ""
    
    return {
        "name": name,
        "title": title,
        "location": location,
        "company": company,
        "url": url,
        "snippet": snippet,
        "education": education,
    }


def build_prompt(fields: Dict[str, str], services: str, max_chars: int, goal: str = "") -> str:
    """Build the prompt for Gemini to generate outreach messages."""
    name = fields["name"] or "there"
    title = fields["title"] or ""
    location = fields["location"] or ""
    company = fields["company"] or ""
    snippet = fields["snippet"] or ""
    education = fields.get("education", "") or ""
    goal_line = f"Goal: {goal}\n" if goal else ""
    return f"""You are composing ultra-brief LinkedIn outreach (max {max_chars} characters).
Sender: Deeptansh (wealth manager).
Services (briefly mention): {services}.
{goal_line}Target:
  - Name: {name}
  - Title/Headline: {title}
  - Location: {location}
  - Company: {company}
  - Education: {education}
  - Context: {snippet}
Constraints:
  - 1 short paragraph, <= {max_chars} characters total.
  - Personalize to the target based on provided details.
  - Friendly, specific, and credible; clear CTA to chat.
  - No emojis, no hashtags, no bullets, no greetings that add fluff beyond what's needed.
Output ONLY the final message text."""


def trim_message(text: str, max_chars: int) -> str:

    """Trim message to max_chars, avoiding word breaks when possible."""
    if len(text) <= max_chars:
        return text
    
    # Find the last space before the limit
    trimmed = text[:max_chars]
    last_space = trimmed.rfind(" ")
    
    if last_space > max_chars * 0.8:  # If we can trim at a reasonable point
        trimmed = trimmed[:last_space]
    else:
        trimmed = trimmed[:max_chars]
    
    # Add ellipsis if we trimmed
    if len(text) > max_chars:
        trimmed += "…"
    
    return trimmed


def generate_outreach_message(fields: Dict[str, str], services: str, max_chars: int, model_name: str, goal: str = "") -> str:
    """Generate a single outreach message using Gemini."""
    try:
        prompt = build_prompt(fields, services, max_chars, goal=goal)
        model = genai.GenerativeModel(model_name=model_name)
        response = model.generate_content(prompt)
        
        if not response.text:
            return ""
        
        message = response.text.strip()
        return trim_message(message, max_chars)
        
    except Exception as e:
        print(f"Warning: Failed to generate message for {fields.get('name', 'unknown')}: {e}")
        return ""


def process_csv(csv_path: str, services: str, model_name: str, max_chars: int, overwrite: bool = False, sleep_s: float = 0.75, goal: str = "") -> None:
    """Process the CSV file to add outreach messages."""
    # Load CSV
    try:
        df = pd.read_csv(csv_path)
    except Exception as e:
        print(f"Error reading CSV: {e}")
        sys.exit(1)
    
    # Ensure outreach_message column exists
    if "outreach_message" not in df.columns:
        df["outreach_message"] = ""
    
    # Count rows to process
    if overwrite:
        rows_to_process = len(df)
    else:
        rows_to_process = df["outreach_message"].isna().sum() + (df["outreach_message"] == "").sum()
    
    if rows_to_process == 0:
        print("No rows to process.")
        return
    
    print(f"Processing {rows_to_process} rows...")
    
    processed = 0
    generated = 0
    skipped = 0
    
    for idx, row in df.iterrows():
        # Skip if already has message and not overwriting
        if not overwrite and pd.notna(row.get("outreach_message")) and str(row.get("outreach_message", "")).strip():
            skipped += 1
            continue
        
        # Extract personalization fields
        fields = extract_personalization_fields(row)
        
        # Generate message
        message = generate_outreach_message(fields, services, max_chars, model_name, goal=goal)
        
        if message:
            df.at[idx, "outreach_message"] = message
            generated += 1
        else:
            df.at[idx, "outreach_message"] = ""
            skipped += 1
        
        processed += 1
        
        # Rate limiting
        time.sleep(max(0.0, sleep_s))
        
        # Progress indicator
        if processed % 10 == 0:
            print(f"Processed {processed}/{rows_to_process} rows...")
    
    # Save updated CSV
    try:
        df.to_csv(csv_path, index=False)
        print(f"Updated CSV saved to {csv_path}")
    except Exception as e:
        print(f"Error saving CSV: {e}")
        sys.exit(1)
    
    print(f"Summary: {processed} processed, {generated} generated, {skipped} skipped")


def parse_args(argv: Optional[list] = None) -> argparse.Namespace:
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(
        description="Generate personalized outreach messages for LinkedIn leads using Gemini AI"
    )
    parser.add_argument("--csv", required=True, help="Path to CSV file with leads")
    parser.add_argument("--overwrite", action="store_true", help="Overwrite existing messages")
    parser.add_argument("--services", help="Services description (overrides SERVICES env var)")
    parser.add_argument("--model", default="gemini-1.5-flash", help="Gemini model to use")
    parser.add_argument("--max-chars", type=int, default=300, help="Maximum characters per message")
    parser.add_argument("--sleep", type=float, default=0.75, help="Seconds to sleep between API calls (rate limit)")
    parser.add_argument("--goal", type=str, default="", help="What you want to accomplish; included in prompt")
    
    return parser.parse_args(argv)


def main(argv: Optional[list] = None) -> None:
    """Main function."""
    load_dotenv()
    args = parse_args(argv)
    
    # Get API key
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        print("Error: GEMINI_API_KEY not found in environment")
        sys.exit(1)
    
    # Configure Gemini
    genai.configure(api_key=api_key)
    
    # Get services text
    services = args.services or os.getenv("SERVICES", "")
    if not services:
        print("Error: SERVICES not provided via --services or SERVICES env var")
        sys.exit(1)
    
    # Process CSV
    process_csv(
        csv_path=args.csv,
        services=services,
        model_name=args.model,
        max_chars=args.max_chars,
        overwrite=args.overwrite,
        sleep_s=args.sleep,
        goal=args.goal,
    )


if __name__ == "__main__":
    main()
