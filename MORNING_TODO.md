# Morning To-Do — GarageDash SEO/GEO

Overnight session built the rest of the Phase 2 content plan. Here's what's waiting on you, in order.

## 1. Deploy (2 min)

Everything built after your last deploy (`garage-booking-system.html` + the new `/blog/` section,
3 posts) is sitting in the folder, not live yet.

```
cd GarageDash-Website
wrangler pages deploy . --project-name garagedash
```

## 2. Commit the repo (2 min)

Wrangler has warned about uncommitted changes on every deploy so far tonight. Worth clearing:

```
git add -A && git commit -m "seo: compare grid, best-in-UK roundup, 4 feature pages, blog"
```

## 3. Google Business Profile + Search Console (~20 min total)

Full click-by-click steps in `GBP_SEARCH_CONSOLE_SETUP.md`. Short version:
- Submit the Google Business Profile (content's been written for weeks, just never submitted).
- Verify Search Console + Bing Webmaster Tools, submit `sitemap.xml` (11 URLs now), and request
  indexing on the new pages directly so Google doesn't wait to discover them organically.

## 4. Directory listings (~15 min to start, ongoing)

Ready-to-paste copy + verified submission links in `DIRECTORY_LISTINGS.md`: SoftwareSuggest,
Capterra (usually covers GetApp/Software Advice too), G2. Free listings — these are the sites
currently occupying page 1 that GarageDash isn't on yet.

## 5. Quick read-through

Take a look at what got built, mainly to sanity-check the tone and that nothing reads off:
- `/compare.html` — now a tick/cross/pill grid instead of a plain table
- `/best-garage-management-software-uk.html` — 6-way roundup, upfront about GarageDash not being neutral
- `/garage-booking-system.html`, plus the 3 feature pages from earlier
- `/blog/` — 3 posts (MOT reminders, workshop scheduling, UK VAT on parts/labour — the VAT one has
  a "this isn't tax advice" disclaimer, worth glancing at)

## Not urgent, whenever

- Backlink outreach / getting early customers to leave reviews — flagged in the strategy doc but
  genuinely needs real customers and listings to exist first, so it's a "later" not a "now."
- Keep the blog going — strategy doc suggests 2-4 posts/month. Happy to draft more whenever.

Everything's also summarized in `SEO_GEO_STRATEGY.md` if you want the full picture with sources.
