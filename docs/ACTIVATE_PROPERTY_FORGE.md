# Turning Property Forge on

**What this is for:** Property Forge is the deal-finding tool. A client gives it a ZIP, it
returns real rental listings plus a market read, and releasing one reveals the address,
photos and source link for one credit ($62.50).

**Where it stands today:** it has run **zero searches in its entire life**. Not because it is
broken — because the search half has never been given credentials. The market analysis half
works. Everything below is done in a browser, not in code, and none of it touches the
platform.

There are four steps. Steps 1 and 2 are the ones that actually switch it on.

---

## Step 1 — Create the Google search credentials

Property Forge finds real listings through Google's Programmable Search. You need two values
from Google: an **API key** and a **search engine ID** (Google calls it a "cx").

**1a. Get the API key**

1. Go to `console.cloud.google.com` and sign in with the Google account that owns the
   business.
2. Top left, open the project picker. Use the same project the Maps key already lives in, or
   create one called `access-your-place`.
3. In the search bar at the top, type **Custom Search API** and open it.
4. Press **Enable**. If it already says "Manage", it is on.
5. Left menu → **APIs and services** → **Credentials**.
6. **Create credentials** → **API key**. Copy the key it shows you.
7. Press **Edit API key** and under *API restrictions* choose **Restrict key**, then tick
   **Custom Search API** only. This stops the key being usable for anything else if it ever
   leaks.

**1b. Get the search engine ID**

1. Go to `programmablesearchengine.google.com/controlpanel/create`.
2. Name it `Access Your Place property search`.
3. Choose **Search the entire web**.
4. Create it, then open **Customise** / **Overview**. Copy the **Search engine ID** — a short
   string of letters and numbers.

**Cost:** the first 100 searches a day are free. Beyond that it is $5 per 1,000, capped at
10,000 a day. At current volume you will not reach the free limit.

---

## Step 2 — Put both values into Supabase

1. Go to `supabase.com/dashboard`, open the **Access Your Place** project.
2. Left menu → **Edge Functions** → **Secrets** (on some versions: Settings → Edge Functions
   → Secrets).
3. **Add new secret**, twice:

   | Name | Value |
   |---|---|
   | `GOOGLE_API_KEY` | the key from step 1a |
   | `GOOGLE_CX` | the search engine ID from step 1b |

   The names must match exactly, capitals included. A lowercase name is a different secret
   and Forge will not see it.

4. Save.

**Nothing needs redeploying.** Edge functions read secrets at request time, so the next
search picks them up.

---

## Step 3 — Check it worked, in a way that cannot lie to you

Ask Penny, on the staff desk:

> Run a Property Forge search on ZIP 33609.

**If it is on**, you get real listings with a market read.

**If the keys are missing or wrong**, you now get this, in these words:

> "Property search is not switched on for this platform yet, so no listings could be pulled.
> This is not an empty market — it is a setup step on our side."

That sentence exists because of what was wrong before: the tool returned an empty list when
the key was missing, when the request failed, **and** when the market genuinely had nothing.
All three looked identical. A client would have been told a market was bare when the tool had
simply never been switched on. **If you see the old wording "No real listings were found",
that means it searched properly and found nothing.**

---

## Step 4 — Decide who can spend credits

Staff have unlimited releases. Clients spend one credit per release, at $62.50.

- **A client's Forge balance is separate from their deal credits.** The balance shown in
  Property Forge is `funding_amount`; the credits that buy deals are `credit_balance`. Right
  now **no client has any Forge funding at all**, so no client can release a property even
  once the search works.
- To give somebody a balance, ask Penny to grant Property Forge credits for that client, or
  do it from the staff console. Decide whether Forge is a paid add-on or something you fund
  for clients you are working closely with — the software supports either, and it is not a
  decision the code should make for you.

---

## What is still true after all four steps

- **Forge listings are unverified.** They come from a public web search, not from a
  conversation with a landlord. They are `penny_scan`, never `ayp_verified`, and the platform
  must keep saying so. A client sourcing their own deal through Forge has found a lead, not
  an Access Your Place deal.
- **The market figures are AI estimates** following our methodology, not a live data feed.
  Forge already labels them that way and should keep doing so.

---

## If something does not work

**"Property search is not switched on"** — the secrets are missing, misspelled, or saved in
the wrong project. Check the names character by character.

**Search runs but returns nothing anywhere** — the Custom Search engine was created for a
specific site rather than the whole web. Go back to step 1b and set it to search the entire
web.

**Listings appear but look irrelevant** — that is the search query, not the setup. Tell me
and I will tighten it.
