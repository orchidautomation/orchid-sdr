#!/usr/bin/env python3
"""
Probe one LinkedIn post through the intended AI SDR research chain.

Flow:
1. Fetch the post via the LinkedIn discovery actor/task.
2. Extract the author LinkedIn profile URL from the post result.
3. Scrape the author profile via the LinkedIn profile/company research actor/task.
4. Derive the author's current employer from the profile result.
5. Scrape the employer company record.
6. Optionally enrich the author in Prospeo.

This script intentionally prefers:
post -> author profile -> current employer -> company

It does not treat the company mentioned in the post content as the default account
target, because that is often the wrong company for AI SDR.

Usage:
  python3 scripts/linkedin_post_chain_probe.py \
    "https://www.linkedin.com/feed/update/urn:li:activity:7453109055172063232/"

  python3 scripts/linkedin_post_chain_probe.py \
    "https://www.linkedin.com/feed/update/urn:li:activity:7453109055172063232/" \
    --with-prospeo --verbose

Required env:
  APIFY_TOKEN
  APIFY_LINKEDIN_POSTS_TASK_ID or APIFY_LINKEDIN_POSTS_ACTOR_ID (recommended)
    or APIFY_LINKEDIN_TASK_ID / APIFY_LINKEDIN_ACTOR_ID (fallback search actor)
  APIFY_LINKEDIN_PROFILE_TASK_ID or APIFY_LINKEDIN_PROFILE_ACTOR_ID

Optional env:
  APIFY_BASE_URL=https://api.apify.com/v2
  APIFY_LINKEDIN_POSTS_INPUT_TEMPLATE=<json template for exact post lookup>
  APIFY_LINKEDIN_INPUT_TEMPLATE=<json template for post lookup>
  APIFY_LINKEDIN_PROFILE_INPUT_TEMPLATE=<json template for profile/company lookup>
  PROSPEO_API_KEY
  PROSPEO_BASE_URL=https://api.prospeo.io

Template placeholders:
  Exact post lookup template:
    {{post_url}}, {{max_posts}}, {{target_urls}}
  Discovery template:
    {{post_url}}, {{query}}, {{limit}}, {{queries}}, {{target_urls}}
  Profile/company template:
    {{query}}, {{queries}}
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
from typing import Any, Dict, List, Optional
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, urlparse, urlunparse
from urllib.request import Request, urlopen


DEFAULT_APIFY_BASE_URL = "https://api.apify.com/v2"
DEFAULT_PROSPEO_BASE_URL = "https://api.prospeo.io"
DEFAULT_TIMEOUT_SECONDS = 60
DEFAULT_WAIT_ATTEMPTS = 30
DEFAULT_WAIT_INTERVAL_SECONDS = 2


def log(message: str, verbose: bool) -> None:
    if verbose:
        print(message, file=sys.stderr)


def require_env(*names: str) -> str:
    for name in names:
        value = os.getenv(name)
        if value:
            return value
    joined = " or ".join(names)
    raise SystemExit(f"Missing required env: {joined}")


def optional_env(*names: str, default: Optional[str] = None) -> Optional[str]:
    for name in names:
        value = os.getenv(name)
        if value:
            return value
    return default


def http_json(
    url: str,
    *,
    method: str = "GET",
    headers: Optional[Dict[str, str]] = None,
    body: Optional[Dict[str, Any]] = None,
) -> Any:
    payload = None
    request_headers = headers.copy() if headers else {}
    if body is not None:
        payload = json.dumps(body).encode("utf-8")
        request_headers.setdefault("Content-Type", "application/json")

    request = Request(url, data=payload, headers=request_headers, method=method)
    try:
        with urlopen(request, timeout=DEFAULT_TIMEOUT_SECONDS) as response:
            raw = response.read().decode("utf-8")
            return json.loads(raw) if raw else None
    except HTTPError as error:
        raw = error.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"HTTP {error.code} for {url}: {raw}") from error
    except URLError as error:
        raise RuntimeError(f"Request failed for {url}: {error}") from error


def interpolate_template(template: str, values: Dict[str, str]) -> str:
    def replace(match: re.Match[str]) -> str:
        key = match.group(1)
        return values.get(key, "")

    return re.sub(r"\{\{\s*([a-zA-Z0-9_]+)\s*\}\}", replace, template)


def normalize_linkedin_url(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    parsed = urlparse(value.strip())
    if not parsed.scheme or not parsed.netloc:
        return None
    host = parsed.netloc.lower()
    if host.startswith("www."):
        host = host[4:]
    path = parsed.path.rstrip("/")
    cleaned = parsed._replace(netloc=f"www.{host}", path=path, query="", fragment="")
    return urlunparse(cleaned)


def extract_activity_id(value: str) -> Optional[str]:
    patterns = [
        r"urn:li:activity:(\d+)",
        r"activity-(\d+)",
        r"activity:(\d+)",
        r"/(\d{10,})/?$",
    ]
    for pattern in patterns:
        match = re.search(pattern, value)
        if match:
            return match.group(1)
    return None


def pick_string(record: Any, *keys: str) -> Optional[str]:
    if not isinstance(record, dict):
        return None
    for key in keys:
        value = record.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return None


def build_discovery_input(post_url: str, limit: int) -> Dict[str, Any]:
    template = os.getenv("APIFY_LINKEDIN_INPUT_TEMPLATE")
    if template:
        rendered = interpolate_template(
            template,
            {
                "post_url": post_url,
                "query": post_url,
                "limit": str(limit),
                "queries": json.dumps([post_url]),
                "target_urls": json.dumps([post_url]),
            },
        )
        return json.loads(rendered)

    # Fallback shape is intentionally broad. Some actors only consume one or two of
    # these fields. The template env should be used once the exact Harvest payload
    # shape is locked.
    return {
        "query": post_url,
        "queries": [post_url],
        "searchTerms": [post_url],
        "keyword": post_url,
        "keywords": [post_url],
        "targetUrl": [post_url],
        "targetUrls": [post_url],
        "urls": [post_url],
        "postUrls": [post_url],
        "startUrls": [{"url": post_url}],
        "limit": limit,
        "maxItems": limit,
        "max_results": limit,
    }


def build_exact_post_lookup_input(post_url: str, max_posts: int) -> Dict[str, Any]:
    template = os.getenv("APIFY_LINKEDIN_POSTS_INPUT_TEMPLATE")
    if template:
        rendered = interpolate_template(
            template,
            {
                "post_url": post_url,
                "max_posts": str(max_posts),
                "target_urls": json.dumps([post_url]),
            },
        )
        return json.loads(rendered)

    return {
        "targetUrls": [post_url],
        "maxPosts": max_posts,
        "scrapeComments": False,
        "scrapeReactions": False,
    }


def build_profile_research_input(queries: List[str]) -> Dict[str, Any]:
    template = os.getenv("APIFY_LINKEDIN_PROFILE_INPUT_TEMPLATE")
    if template:
        rendered = interpolate_template(
            template,
            {
                "query": queries[0] if queries else "",
                "queries": json.dumps(queries),
            },
        )
        return json.loads(rendered)

    return {
        "profileScraperMode": "Profile details no email ($4 per 1k)",
        "queries": queries,
    }


def resolve_discovery_path() -> str:
    task_id = os.getenv("APIFY_LINKEDIN_TASK_ID")
    actor_id = os.getenv("APIFY_LINKEDIN_ACTOR_ID")
    if task_id:
        return f"/actor-tasks/{task_id}/runs"
    if actor_id:
        return f"/acts/{actor_id}/runs"
    raise SystemExit("Missing APIFY_LINKEDIN_TASK_ID or APIFY_LINKEDIN_ACTOR_ID")


def resolve_exact_post_lookup_path() -> Optional[str]:
    task_id = os.getenv("APIFY_LINKEDIN_POSTS_TASK_ID")
    actor_id = os.getenv("APIFY_LINKEDIN_POSTS_ACTOR_ID")
    if task_id:
        return f"/actor-tasks/{task_id}/runs"
    if actor_id:
        return f"/acts/{actor_id}/runs"
    return None


def resolve_profile_research_path() -> str:
    task_id = os.getenv("APIFY_LINKEDIN_PROFILE_TASK_ID")
    actor_id = os.getenv("APIFY_LINKEDIN_PROFILE_ACTOR_ID")
    if task_id:
        return f"/actor-tasks/{task_id}/runs"
    if actor_id:
        return f"/acts/{actor_id}/runs"
    raise SystemExit("Missing APIFY_LINKEDIN_PROFILE_TASK_ID or APIFY_LINKEDIN_PROFILE_ACTOR_ID")


def start_apify_run(path: str, payload: Dict[str, Any], *, verbose: bool) -> Dict[str, Optional[str]]:
    token = require_env("APIFY_TOKEN")
    base_url = optional_env("APIFY_BASE_URL", default=DEFAULT_APIFY_BASE_URL)
    url = f"{base_url}{path}"
    log(f"POST {url}", verbose)
    response = http_json(
        url,
        method="POST",
        headers={"Authorization": f"Bearer {token}"},
        body=payload,
    )
    data = response.get("data", {}) if isinstance(response, dict) else {}
    actor_run_id = pick_string(data, "id", "actorRunId") or pick_string(response, "id", "actorRunId")
    default_dataset_id = (
        pick_string(data, "defaultDatasetId", "defaultDataset_id")
        or pick_string(response, "defaultDatasetId", "defaultDataset_id")
    )
    if not actor_run_id:
        raise RuntimeError(f"Apify run start did not return an actor run id: {response}")
    return {
        "actorRunId": actor_run_id,
        "defaultDatasetId": default_dataset_id,
    }


def get_apify_run(actor_run_id: str) -> Dict[str, Any]:
    token = require_env("APIFY_TOKEN")
    base_url = optional_env("APIFY_BASE_URL", default=DEFAULT_APIFY_BASE_URL)
    url = f"{base_url}/actor-runs/{actor_run_id}"
    response = http_json(url, headers={"Authorization": f"Bearer {token}"})
    data = response.get("data", {}) if isinstance(response, dict) else {}
    return data if isinstance(data, dict) else {}


def wait_for_apify_run(actor_run_id: str, *, verbose: bool) -> Dict[str, Any]:
    for attempt in range(DEFAULT_WAIT_ATTEMPTS):
        run = get_apify_run(actor_run_id)
        status = (pick_string(run, "status") or "UNKNOWN").upper()
        log(f"Run {actor_run_id} status={status} attempt={attempt + 1}", verbose)
        if status == "SUCCEEDED":
            return run
        if status in {"FAILED", "ABORTED", "TIMED-OUT", "TIMED_OUT"}:
            raise RuntimeError(f"Apify run {actor_run_id} ended with status {status}")
        time.sleep(DEFAULT_WAIT_INTERVAL_SECONDS)
    raise RuntimeError(f"Timed out waiting for Apify run {actor_run_id}")


def fetch_dataset_items(dataset_id: str, *, limit: int) -> List[Dict[str, Any]]:
    token = require_env("APIFY_TOKEN")
    base_url = optional_env("APIFY_BASE_URL", default=DEFAULT_APIFY_BASE_URL)
    query = urlencode({"clean": "true", "limit": str(limit), "format": "json"})
    url = f"{base_url}/datasets/{dataset_id}/items?{query}"
    response = http_json(url, headers={"Authorization": f"Bearer {token}"})
    return response if isinstance(response, list) else []


def run_discovery_for_post(post_url: str, *, verbose: bool) -> List[Dict[str, Any]]:
    payload = build_discovery_input(post_url, limit=10)
    handle = start_apify_run(resolve_discovery_path(), payload, verbose=verbose)
    run = wait_for_apify_run(handle["actorRunId"], verbose=verbose)
    dataset_id = pick_string(run, "defaultDatasetId", "defaultDataset_id") or handle["defaultDatasetId"]
    if not dataset_id:
        raise RuntimeError("Apify discovery run did not expose a dataset id")
    return fetch_dataset_items(dataset_id, limit=10)


def run_exact_post_lookup(post_url: str, *, verbose: bool) -> List[Dict[str, Any]]:
    path = resolve_exact_post_lookup_path()
    if not path:
        return []
    payload = build_exact_post_lookup_input(post_url, max_posts=5)
    handle = start_apify_run(path, payload, verbose=verbose)
    run = wait_for_apify_run(handle["actorRunId"], verbose=verbose)
    dataset_id = pick_string(run, "defaultDatasetId", "defaultDataset_id") or handle["defaultDatasetId"]
    if not dataset_id:
        raise RuntimeError("Apify exact post lookup run did not expose a dataset id")
    return fetch_dataset_items(dataset_id, limit=5)


def run_profile_research(queries: List[str], *, verbose: bool) -> List[Dict[str, Any]]:
    payload = build_profile_research_input(queries)
    handle = start_apify_run(resolve_profile_research_path(), payload, verbose=verbose)
    run = wait_for_apify_run(handle["actorRunId"], verbose=verbose)
    dataset_id = pick_string(run, "defaultDatasetId", "defaultDataset_id") or handle["defaultDatasetId"]
    if not dataset_id:
        raise RuntimeError("Apify profile/company research run did not expose a dataset id")
    return fetch_dataset_items(dataset_id, limit=max(1, len(queries)))


def choose_post_item(items: List[Dict[str, Any]], post_url: str) -> Dict[str, Any]:
    target_url = normalize_linkedin_url(post_url)
    target_activity_id = extract_activity_id(post_url)

    for item in items:
        candidate_urls = [
            normalize_linkedin_url(pick_string(item, "linkedinUrl", "url", "postUrl")),
        ]
        if target_url and target_url in candidate_urls:
            return item

        candidate_activity_ids = [
            extract_activity_id(pick_string(item, "linkedinUrl", "url", "postUrl") or ""),
            pick_string(item, "entityId", "id"),
        ]
        if target_activity_id and target_activity_id in candidate_activity_ids:
            return item

    if items:
        return items[0]
    raise RuntimeError("Discovery actor returned no items")


def extract_author_profile_url(post_item: Dict[str, Any]) -> Optional[str]:
    author = post_item.get("author", {})
    return normalize_linkedin_url(
        pick_string(author, "linkedinUrl", "url")
        or pick_string(post_item, "authorLinkedinUrl", "profileUrl")
    )


def extract_mentioned_companies(post_item: Dict[str, Any]) -> List[Dict[str, Optional[str]]]:
    output: List[Dict[str, Optional[str]]] = []
    content_attributes = post_item.get("contentAttributes", [])
    if not isinstance(content_attributes, list):
        return output

    for entry in content_attributes:
        if not isinstance(entry, dict):
            continue
        if pick_string(entry, "type") != "COMPANY_NAME":
            continue
        company = entry.get("company", {})
        output.append(
            {
                "name": pick_string(company, "name"),
                "linkedinUrl": normalize_linkedin_url(
                    pick_string(company, "linkedinUrl", "url") or pick_string(entry, "hyperlink")
                ),
            }
        )
    return output


def map_items_by_linkedin_url(items: List[Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
    mapped: Dict[str, Dict[str, Any]] = {}
    for item in items:
        linkedin_url = normalize_linkedin_url(pick_string(item, "linkedinUrl"))
        if linkedin_url:
            mapped[linkedin_url] = item
    return mapped


def first_current_position(profile_item: Dict[str, Any]) -> Dict[str, Any]:
    positions = profile_item.get("currentPosition", [])
    if isinstance(positions, list) and positions:
        first = positions[0]
        if isinstance(first, dict):
            return first
    experiences = profile_item.get("experience", [])
    if isinstance(experiences, list) and experiences:
        for entry in experiences:
            if not isinstance(entry, dict):
                continue
            end_date = entry.get("endDate")
            if isinstance(end_date, dict) and pick_string(end_date, "text") == "Present":
                return entry
    return {}


def enrich_with_prospeo(profile_item: Dict[str, Any], company_item: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    api_key = os.getenv("PROSPEO_API_KEY")
    if not api_key:
        return None

    base_url = optional_env("PROSPEO_BASE_URL", default=DEFAULT_PROSPEO_BASE_URL)
    current = first_current_position(profile_item)
    body = {
        "only_verified_email": True,
        "data": {
            "full_name": " ".join(
                part for part in [pick_string(profile_item, "firstName"), pick_string(profile_item, "lastName")] if part
            ),
            "linkedin_url": normalize_linkedin_url(pick_string(profile_item, "linkedinUrl")),
            "company_name": pick_string(current, "companyName") or pick_string(company_item or {}, "name"),
            "company_website": pick_string(company_item or {}, "website"),
        },
    }

    response = http_json(
        f"{base_url}/enrich-person",
        method="POST",
        headers={"X-KEY": api_key},
        body=body,
    )
    person = response.get("person", {}) if isinstance(response, dict) else {}
    email = person.get("email", {}) if isinstance(person, dict) else {}
    return {
        "request": body,
        "email": email if isinstance(email, dict) else None,
        "raw": response,
    }


def summarize_post(post_item: Dict[str, Any]) -> Dict[str, Any]:
    author = post_item.get("author", {})
    return {
        "id": pick_string(post_item, "id", "entityId"),
        "linkedinUrl": normalize_linkedin_url(pick_string(post_item, "linkedinUrl", "url", "postUrl")),
        "authorName": pick_string(author, "name") or pick_string(post_item, "authorName"),
        "authorLinkedinUrl": extract_author_profile_url(post_item),
        "authorHeadline": pick_string(author, "info", "headline"),
        "contentPreview": (pick_string(post_item, "content", "text") or "")[:300],
        "mentionedCompanies": extract_mentioned_companies(post_item),
    }


def summarize_profile(profile_item: Dict[str, Any]) -> Dict[str, Any]:
    current = first_current_position(profile_item)
    return {
        "linkedinUrl": normalize_linkedin_url(pick_string(profile_item, "linkedinUrl")),
        "publicIdentifier": pick_string(profile_item, "publicIdentifier"),
        "name": " ".join(
            part for part in [pick_string(profile_item, "firstName"), pick_string(profile_item, "lastName")] if part
        ),
        "headline": pick_string(profile_item, "headline"),
        "currentCompanyName": pick_string(current, "companyName"),
        "currentCompanyLinkedinUrl": normalize_linkedin_url(pick_string(current, "companyLinkedinUrl")),
        "currentCompanyId": pick_string(current, "companyId"),
        "websites": profile_item.get("websites", []),
    }


def summarize_company(company_item: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "linkedinUrl": normalize_linkedin_url(pick_string(company_item, "linkedinUrl")),
        "name": pick_string(company_item, "name"),
        "tagline": pick_string(company_item, "tagline"),
        "website": pick_string(company_item, "website"),
        "employeeCount": company_item.get("employeeCount"),
        "followerCount": company_item.get("followerCount"),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Probe one LinkedIn post through the author -> employer chain")
    parser.add_argument("post_url", help="LinkedIn post/feed/activity URL")
    parser.add_argument("--with-prospeo", action="store_true", help="Call Prospeo enrich-person after profile/company resolution")
    parser.add_argument("--verbose", action="store_true", help="Print run details to stderr")
    parser.add_argument("--include-raw", action="store_true", help="Include raw actor payloads in the final JSON")
    args = parser.parse_args()

    require_env("APIFY_TOKEN")
    resolve_profile_research_path()
    exact_post_path = resolve_exact_post_lookup_path()

    if exact_post_path:
        log("Using exact post lookup actor/task for targetUrls-based post fetch", args.verbose)
        discovery_items = run_exact_post_lookup(args.post_url, verbose=args.verbose)
    else:
        log(
            "Exact post lookup actor/task is not configured; falling back to the search-oriented LinkedIn discovery actor",
            args.verbose,
        )
        resolve_discovery_path()
        discovery_items = run_discovery_for_post(args.post_url, verbose=args.verbose)
    post_item = choose_post_item(discovery_items, args.post_url)
    author_profile_url = extract_author_profile_url(post_item)
    if not author_profile_url:
        raise RuntimeError(f"Could not resolve an author LinkedIn URL from discovery item: {post_item}")

    profile_items = run_profile_research([author_profile_url], verbose=args.verbose)
    profile_by_url = map_items_by_linkedin_url(profile_items)
    profile_item = profile_by_url.get(author_profile_url)
    if not profile_item and profile_items:
        profile_item = profile_items[0]
    if not profile_item:
        raise RuntimeError(f"No profile research item returned for {author_profile_url}")

    current = first_current_position(profile_item)
    employer_company_url = normalize_linkedin_url(pick_string(current, "companyLinkedinUrl"))
    if not employer_company_url:
        raise RuntimeError(f"Could not derive a current employer company URL from profile: {profile_item}")

    company_items = run_profile_research([employer_company_url], verbose=args.verbose)
    company_by_url = map_items_by_linkedin_url(company_items)
    company_item = company_by_url.get(employer_company_url)
    if not company_item and company_items:
        company_item = company_items[0]
    if not company_item:
        raise RuntimeError(f"No company research item returned for {employer_company_url}")

    result: Dict[str, Any] = {
        "input": {
            "postUrl": args.post_url,
        },
        "post": summarize_post(post_item),
        "authorProfile": summarize_profile(profile_item),
        "employerCompany": summarize_company(company_item),
        "chain": {
            "authorProfileUrl": author_profile_url,
            "employerCompanyUrl": employer_company_url,
            "mentionedCompanyUrls": [
                item["linkedinUrl"] for item in extract_mentioned_companies(post_item) if item.get("linkedinUrl")
            ],
        },
    }

    if args.with_prospeo:
        result["prospeo"] = enrich_with_prospeo(profile_item, company_item)

    if args.include_raw:
        result["raw"] = {
            "discoveryItems": discovery_items,
            "profileItems": profile_items,
            "companyItems": company_items,
        }

    print(json.dumps(result, indent=2, sort_keys=False))


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        raise SystemExit(130)
