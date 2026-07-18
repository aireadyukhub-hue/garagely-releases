# GarageDash — Deep dive: where we are, and what actually makes this business work

You're picking up GarageDash (garage management software, £29/mo, UK independent garages). Everything below is a snapshot from the evening of 7 Jul 2026 — **verify state before trusting it**, then do the real job: a first-principles review of what this business needs next to get paying customers, not just more artifacts.

## Context to load first

Project memory: `garagedash-seo-geo`, `garagedash-rebrand`, `garagely-ga4-analytics`, `garagely-gold-check`, `garagely-vrm-lookup`, `garagedash-v1.2.6-deploy`, `garagely-cloud-sync`, `garagedash-social-content`, `garagely-hosting-cloudflare`.
Project root docs: `SEO_GEO_STRATEGY.md` (competitors + sourced pricing), `MORNING_TODO.md`, `GBP_SEARCH_CONSOLE_SETUP.md`, `DIRECTORY_LISTINGS.md`. Brand assets in `brand/garagedash/` (GBP photo set in `brand/garagedash/gbp/`).

## State snapshot (7 Jul 2026, verify the starred items)

- Site fully live on Cloudflare Pages: homepage, compare grid, best-in-UK roundup, 4 feature pages, blog (3 posts), sitemap, llms.txt. Stale garagely-app.pages.dev link fixed + deployed. Rebrand URL sweep clean.
- ★ "No card required" claims were removed repo-wide (card IS required for trial) — **check whether that deploy + git commit actually happened**: grep the live site for "no card".
- Google Business Profile (edited the existing GarageLY profile, not a new one): description, website (garagedash.co.uk), cover + 7 photos all LIVE; all 5 services already present; **name change GarageLY→GarageDash still pending Google review** — check it cleared, watch for a re-verification request. Q&A seeding still to do once the panel is public (4 pairs in `GOOGLE_BUSINESS_PROFILE.md`).
- NOT done yet (Lewis-side): Search Console + Bing verification/sitemap, directory listings (SoftwareSuggest/Capterra/G2 — the biggest off-page gap; copy ready in `DIRECTORY_LISTINGS.md`), review generation.
- Other live threads: GA4 live (G-SK6KEQSJDG, funnel events cta_click → begin_checkout → trial_activated); VRM/DVSA lookup live; Gold Check blocked on VDGL approval (reminder 9 Jul); v1.2.6 app deploy pending (`DEPLOY_v1.2.6.md`); Mac app "coming soon"; mobile app visibility unresolved.

## The actual task

SEO Phase 2 is done. The open question is no longer "what content next" — it's **what gets this product its first/next paying customers**. Think hard and be honest, even where it contradicts the existing strategy doc or past work. Dig into:

1. **Funnel reality** — pull whatever GA4 shows (traffic, cta_click → begin_checkout → trial_activated drop-off). If data is thin, that's itself the finding. Card-required trial: right call for this market, or the biggest leak?
2. **Distribution beyond SEO** — SEO compounds slowly. What reaches UK garage owners *this month*? Weigh directories + reviews, GBP posts, trade communities/Facebook groups/forums (e.g. MechanicsHub, UK garage owner groups), partnerships (parts suppliers, MOT trainers), direct outreach, paid (the £400 Google Ads credit sitting on the GBP). Rank by expected customers per hour of Lewis's time.
3. **Positioning & product gaps** — £29 flat vs TechMan/Garage Hive/GDS is a genuine wedge; is the site selling it hard enough? Which product gaps actually block purchases (Mac app? mobile? Gold Check?) vs which just feel important?
4. **Trust** — zero reviews anywhere is likely the #1 conversion blocker for garage owners. What's the fastest honest path to the first 5 reviews (early users, trial users, GBP + Capterra)?

Deliverable: a ruthless, prioritized next-steps plan — impact vs effort, split "Claude can do now" vs "Lewis must do" — then confirm priorities with me (AskUserQuestion) and start executing the top Claude-doable items in this session. Don't pad it: if the answer is "stop building, go get 10 conversations with garage owners", say exactly that.
