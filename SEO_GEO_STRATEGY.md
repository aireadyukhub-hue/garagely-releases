# GarageDash SEO/GEO Strategy — Phased Roadmap

Goal: rank for "garage management software" (UK) and adjacent terms, and get cited by AI answer
engines (ChatGPT, Perplexity, Gemini, Copilot) when someone asks for garage software recommendations.
Written 6 Jul 2026, post-rebrand from GarageLY.

## Where we start

garagedash.co.uk is a strong single page: solid meta/OG tags, `SoftwareApplication` + `FAQPage`
JSON-LD, and an `llms.txt` file already aimed at GEO. But it's one page and a one-week-old domain.
That's the real gap versus the market — not technical SEO.

## The competitive landscape

Dedicated UK garage management systems (GMS) — the direct competitive set:

- **TechMan** — the most established UK cloud GMS. Reported pricing: Lite £189/mo, Advanced £315/mo,
  Pro £415/mo, unlimited users, but tends to require 3-year contracts. ([Capterra](https://www.capterra.co.uk/software/172835/techman), [esremedia comparison](https://esremedia.co.uk/blog/garage-management-software-uk-comparison))
- **Garage Hive** — popular with 3–8 bay independents. Runs as an add-on to Microsoft Dynamics
  Business Central, so the ~£89–145/mo Garage Hive fee is on top of a separate £61.50–84.60/user/mo
  Microsoft licence. 6-month minimum contract. ([Garage Hive pricing](https://garagehive.co.uk/pricing/))
- **Dragon2000 (DragonDMS)** — 30-year-old player, leans toward used-car dealerships as much as
  independent garages; no public pricing, sales-call only, 30-day trial.
- **AutoChain** — newer, positions itself as the simple/mobile-first option for smaller independents.
  £69.99/month + VAT, unlimited employees, no long-term contract. ([AutoChain](https://www.autochain.co.uk/))
- **GDS (Garage Data Systems)** — part of the ClearCourse group, separate Workshop Manager and
  Commercial Vehicle Manager products. Published from £149/month rising to £249–299/month on higher
  tiers, plus a setup fee reported from £350 up to £1,500, and usage-based credits for SMS/VRM/Haynes
  Pro lookups on top of the subscription. ([GDS pricing](https://gds.co.uk/pricing/))

Plus a layer of **listicle/directory sites** that occupy most of page 1 for "best garage management
software UK": SoftwareSuggest, Capterra, GetApp, Software Advice, and a wave of newer AI-generated
comparison blogs (esremedia, autodots, workshopease, garagerevs, autochain's own comparison pages).
These sites rank because they're old, have domain authority, and get updated constantly — GarageDash
isn't listed on any of them yet.

**GarageDash's honest wedge:** flat £29/month per garage, no per-seat fees, no long contract, 14-day
trial with no card required. Every direct competitor above either charges 5–10x more, tacks on
per-user Microsoft licensing, or locks customers into multi-year terms. That price/simplicity gap is
the whole positioning strategy — the content and outreach below all point back to it.

## Phase 1 — Technical & GEO quick wins (do first, cheapest, fastest to land)

Shippable from the codebase, no external dependencies:

- Expand JSON-LD beyond `SoftwareApplication`/`FAQPage`: add `Organization` + `BreadcrumbList`, and a
  schema block on every new page.
- Grow `sitemap.xml` as new pages ship (currently lists only `/`).
- Keep `llms.txt` current as the site's answer-engine summary — update it whenever a new page or
  differentiator ships (comparison page, pricing changes).
- Internal linking: nav + footer should link to comparison/feature pages once they exist, so crawlers
  (and AI crawlers) find them from the homepage.

Needs Lewis, not sandbox-doable — click-by-click steps written up in `GBP_SEARCH_CONSOLE_SETUP.md`:
- Finish and publish the **Google Business Profile** (content already drafted in
  `GOOGLE_BUSINESS_PROFILE.md`, never actually submitted) — this is the fastest win for branded
  search ("GarageDash reviews", "GarageDash pricing") and is a prerequisite for local/map pack
  presence.
- Verify the site in **Google Search Console** and **Bing Webmaster Tools**, submit the sitemap,
  request indexing on the new pages directly.
- Set up **Google Analytics 4 goal/conversion tracking** (GA4 property already live per prior work)
  so we can see which content actually drives trials.

## Phase 2 — Content (the actual ranking strategy)

A one-page marketing site cannot outrank sites with dozens of indexed pages. Priority order:

1. **Comparison pages** — "GarageDash vs TechMan", "GarageDash vs Garage Hive", "GarageDash vs
   Dragon2000/GDS" (built as one combined page first, can split later if one competitor term shows
   enough search volume on its own). These capture people actively comparing options — the highest
   commercial-intent traffic there is. **Shipped this session:** `/compare.html` (now covers TechMan,
   Garage Hive, Dragon2000 and GDS).
2. **Feature/use-case pages** — "Digital vehicle health check software", "MOT reminder software for
   garages", "Job sheet software UK", "Garage booking system" — each targets a specific feature
   search with less competition than the head term. **All 4 shipped:**
   `/digital-vehicle-health-check-software.html`, `/mot-reminder-software.html`,
   `/job-sheet-software-uk.html`, `/garage-booking-system.html`.
3. **"Best garage management software UK" roundup** — yes, write GarageDash's own version of the
   listicle that currently ranks above it, with GarageDash positioned #1 (honestly, not just as
   self-promotion) and the field genuinely covered. Very commonly outranks competitor listicles for
   the same query. **Shipped this session:** `/best-garage-management-software-uk.html` (covers
   GarageDash, TechMan, Garage Hive, GDS, AutoChain, Dragon2000 with an upfront non-neutrality
   disclosure).
4. **Blog** — 2–4 posts/month on independent-garage operational topics (MOT reminder workflows,
   handling VAT on parts, workshop scheduling). Not primarily for head-term ranking, but builds
   topical authority and gives something to link to from social/outreach. **Started:** `/blog/`
   index plus 3 posts (MOT reminder workflows, workshop scheduling/double-booking, UK VAT on parts
   and labour — the VAT post carries a "not tax advice, confirm with an accountant/HMRC" disclaimer
   since it's the one genuinely financial topic). Ongoing cadence from here.

## Phase 3 — Off-page & directories

- **Submit to the listicle sites themselves**: SoftwareSuggest, Capterra, GetApp, Software Advice,
  G2. Free listings on most of these; being *in* the comparison (even ranked lower initially) beats
  being invisible, and these pages already rank #1–3 for the head term. Ready-to-paste copy +
  per-site submission notes written up in `DIRECTORY_LISTINGS.md` — still needs Lewis to create the
  vendor accounts and paste it in.
- **Reviews**: ask the first handful of real customers for a Google review and a Capterra/G2 review
  once listed — review volume/recency is a ranking factor on both Google and the directory sites'
  internal rankings.
- **Backlinks**: UK trade press (Professional Motor Mechanic, Aftermarket magazine — both already
  showed up covering competitors like Garage Hive), independent garage forums/Facebook groups,
  possibly a comparison mention pitch to the blogs currently ranking (esremedia, autodots,
  workshopease) — journalists/bloggers who cover this space refresh these posts periodically.

## Phase 4 — GEO (showing up in AI answers)

- `llms.txt` is the baseline — keep it accurate and current.
- Comparison pages double as GEO content: AI answer engines lean heavily on pages that directly
  compare named competitors with specific numbers, which is exactly what `/compare.html` now does.
- Structured FAQ content (already on the homepage, added to `/compare.html`) is disproportionately
  quoted by AI assistants because it's pre-formatted as Q&A.
- Getting listed on Capterra/G2/SoftwareSuggest also matters here — those are exactly the pages
  ChatGPT/Perplexity cite when asked "what's the cheapest garage management software."

## Status

| Phase | Item | Status |
|---|---|---|
| 1 | JSON-LD expansion, sitemap, llms.txt | Done |
| 1 | Google Business Profile submission | **Needs Lewis** — steps in `GBP_SEARCH_CONSOLE_SETUP.md` |
| 1 | Search Console / Bing Webmaster verification | **Needs Lewis** — steps in `GBP_SEARCH_CONSOLE_SETUP.md` |
| 2 | Comparison page (TechMan/Garage Hive/Dragon2000/GDS), colour-coded tick/cross grid | Done (`/compare.html`) |
| 2 | "Best garage management software UK" roundup | Done (`/best-garage-management-software-uk.html`) |
| 2 | Feature pages: digital VHC, MOT reminders, job sheets, booking system | Done |
| 2 | Blog (index + 3 posts) | Done — ongoing cadence from here |
| 3 | Directory submissions | **Needs Lewis** — copy + steps in `DIRECTORY_LISTINGS.md` |
| 3 | Reviews, backlinks | **Needs Lewis** — revisit once directory listings are live and there are real customers to ask |
| 4 | GEO content | Ongoing — grows with Phase 2 |

Deploy note: none of the website changes are live until the next `wrangler pages deploy` (see
`DEPLOY_v1.2.6.md` / prior deploy notes — same manual step applies to website changes). The
`GBP_SEARCH_CONSOLE_SETUP.md` and `DIRECTORY_LISTINGS.md` guides don't need a deploy — they're just
docs for Lewis to work through directly.
