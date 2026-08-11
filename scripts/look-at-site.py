#!/usr/bin/env python3
"""
Look at the live site. Run after every push.

WHY THIS EXISTS: for several passes I verified deploys by checking HTTP status codes, grepping
the deployed JavaScript bundle, and calling database functions I had written myself. All three
passed while the marketplace was showing 24 deals that should have been gone, and then while
it was showing none at all. None of those checks look at what a person actually sees.

Usage:  python3 scripts/look-at-site.py [path ...]
        python3 scripts/look-at-site.py /deals /library /

It prints what renders, what the page logged, and every request that failed.

KNOWN LIMIT: if the Supabase host is not in this environment's network allowlist, every data
request fails with ERR_FAILED and the page renders its empty state. That is a limit of the
sandbox, NOT evidence about the live site. When that happens the script says so, loudly,
rather than letting an empty page be mistaken for a real result.
"""
import sys
from playwright.sync_api import sync_playwright

BASE = "https://accessyourplace.com"
DATA_HOSTS = ("supabase.co",)


def look(page_path: str) -> None:
    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        page = browser.new_page()
        logs: list[str] = []
        failed: list[str] = []
        page.on("console", lambda m: logs.append(f"{m.type}: {m.text}"))
        page.on("requestfailed", lambda r: failed.append(r.url))

        url = f"{BASE}{page_path}"
        print(f"\n{'=' * 70}\n{url}\n{'=' * 70}")
        try:
            page.goto(url, wait_until="networkidle", timeout=90000)
            page.wait_for_timeout(4000)
        except Exception as exc:  # noqa: BLE001
            print(f"  PAGE DID NOT LOAD: {exc}")
            browser.close()
            return

        body = page.inner_text("body")
        print("\n--- WHAT RENDERS ---")
        for line in [ln for ln in body.split("\n") if ln.strip()][:35]:
            print("   ", line[:100])

        errors = [l for l in logs if l.startswith("error")]
        app = [l for l in logs if "[" in l and not l.startswith("error")]
        if app:
            print("\n--- WHAT THE PAGE LOGGED ---")
            for l in app[:25]:
                print("   ", l[:140])
        if errors:
            print(f"\n--- {len(errors)} CONSOLE ERRORS (first 8) ---")
            for l in errors[:8]:
                print("   ", l[:140])

        blocked_data = [u for u in failed if any(h in u for h in DATA_HOSTS)]
        if blocked_data:
            print("\n" + "!" * 70)
            print("  DATA REQUESTS FAILED FROM THIS ENVIRONMENT.")
            print("  If the Supabase host is not in the network allowlist, this is a SANDBOX")
            print("  limit and says NOTHING about whether the live site works for a real")
            print("  visitor. Do not report an empty page as a finding on this basis.")
            print("!" * 70)
            for u in blocked_data[:4]:
                print("   ", u[:110])
        elif failed:
            print(f"\n--- {len(failed)} OTHER FAILED REQUESTS ---")
            for u in failed[:5]:
                print("   ", u[:110])

        browser.close()


if __name__ == "__main__":
    for p in sys.argv[1:] or ["/deals"]:
        look(p)
