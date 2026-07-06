# GarageDash — Growth & Marketing Roadmap (Round 7)

Covers: the trial/revenue bug, technician mode, in-app camera, SEO/GEO, analytics, site motion kit,
Higgsfield, and socials. Built autonomously; here's what's done vs what needs you.

## ✅ Built this session (code-complete, needs deploy — see "To make it live")

1. **Bug fixed: free trials counted as revenue.** The real live backend is
   `GarageDash-Worker/src/index.ts` (a Cloudflare Worker — the `GarageDash-Backend/netlify/functions/`
   copy is dead code left over from before the June Cloudflare move, though I fixed it too for
   consistency). Its `checkout.session.completed` handler set every new/upgraded licence to
   `status: 'active'` regardless of whether the Stripe subscription was still `trialing` (no card
   charged) — that's what inflated "Active Subscriptions" and MRR on the admin dashboard the moment
   a self-serve trial started. Now checks `sub.status === 'trialing'` → stores `'trial'` instead.

   **Worth knowing:** `create-checkout` puts every self-serve signup on a 14-day Stripe trial
   (`trial_period_days`) with a card collected but not charged — so this bug affected essentially
   every self-serve trial, not an edge case. Once deployed, only *new* checkouts get the correct
   status; existing licences already wrongly marked `active` from past trial signups won't
   auto-correct. If your current MRR/Active Subscriptions count looks too high, it's worth a
   one-time check in Stripe for subscriptions still `trialing` and updating those licences to
   `trial` by hand in Admin → Licences.

2. **Technician Mode.** Not a second login/Supabase Auth account — a simple restricted view for a
   shared workshop device. Sidebar toggle switches to just Calendar, Job Sheets, Customers, Vehicles,
   Inspections (direct URL typing is blocked too). Set a PIN in **Settings → Technician Mode** so
   only you can switch a device back to the full view — leaving Technician Mode asks for it.

3. **Camera on the Inspections form.** Each checklist item now has a camera button — opens the
   device camera on phone/tablet (or a file picker on desktop), stores a resized photo against that
   item, shown as a thumbnail in the form and included in the printed customer report.

4. **Website SEO/GEO scaffolding** (`GarageDash-Website`): JSON-LD schema, Open Graph/Twitter tags,
   canonical URL, `robots.txt`, `sitemap.xml`, and `llms.txt` (a plain-text summary AI assistants like
   ChatGPT can read to describe GarageDash accurately).

5. **Analytics/conversion tracking scaffold**: GA4 added to `index.html` + `success.html` with a
   placeholder Measurement ID, plus funnel events already wired up (`cta_click` → `begin_checkout` →
   `trial_activated`, the last one firing only once the licence key is confirmed — the real
   conversion point). Just needs your real GA4 ID dropped in (two places, marked clearly).

6. **Reusable motion kit** (`GarageDash-Website/motion-kit.css` + `.js`): framework-free scroll-reveal
   + staggered hero entrance, applied to the hero, screenshot, feature grid, pricing and download
   cards. `DESIGN_TOKENS.md` documents the colours/type so the next company's site can start from the
   same two files instead of a from-scratch build.

7. **FAQ section + FAQPage schema** added to `index.html` (short, factual Q&As — pricing, trial,
   Mac/Windows, per-garage pricing, who it's for) — both a real on-page section for visitors and
   structured data for Google's FAQ rich results / AI-assistant citations. Motion kit applied to
   `success.html` too for visual consistency.

8. **Content drafts, ready to paste in once accounts exist:**
   - `SOCIAL_MEDIA_STARTER_PACK.md` — bios for Instagram/Facebook/X/TikTok/LinkedIn, handle
     suggestions (check availability first), and a first two-week content calendar with draft
     captions.
   - `GOOGLE_BUSINESS_PROFILE.md` — category, description, services list, and a seeded Q&A section
     for when you set up the Business Profile.

9. **Audited the Worker for similar bugs** — checked every other status-transition path
   (activate-account, validate-licence, licence-status, the other webhook cases). No other bugs
   found, but worth flagging: **your current MRR/Active count may still include past self-serve
   trials that were wrongly marked active before this fix** — see the note under item 1.

`npx tsc --noEmit` clean on both the app and the Worker (no new type errors).

## ⚠️ To make it live

1. **Deploy the Worker** (picks up the revenue bug fix):
   ```
   cd "/Users/lewisfelix/Documents/Claude/Projects/GarageLY/GarageDash-Worker" && wrangler deploy
   ```
2. **Apply the migration** (Technician Mode PIN column) — run
   `GarageDash-Backend/migrations/0010_tech_mode.sql` in the Supabase SQL editor.
3. **Deploy the web app** (Technician Mode + camera):
   ```
   cd "/Users/lewisfelix/Documents/Claude/Projects/GarageLY/GarageDash-Web" && npm run build && wrangler pages deploy dist --project-name garagedash-app
   ```
4. **Deploy the marketing site** (SEO/GEO + analytics + motion kit):
   ```
   cd "/Users/lewisfelix/Documents/Claude/Projects/GarageLY/GarageDash-Website" && wrangler pages deploy . --project-name garagedash
   ```
5. **Desktop release** (optional, so the installed app gets Technician Mode + camera):
   ```
   cd "/Users/lewisfelix/Documents/Claude/Projects/GarageLY" && git add -A && git commit -m "v1.2.4: technician mode, inspection photos, revenue bug fix" && git push && git tag v1.2.4 && git push origin v1.2.4
   ```

## Lewis — things only you can do

These need your identity, accounts, or a browser session — I can't do them from the sandbox.

- [x] **GA4**: DONE — property live, Measurement ID `G-SK6KEQSJDG`, wired into the site with
      funnel events (see `garagely-ga4-analytics` memory). NOTE: re-check GA4 property/domain
      settings now that the site lives at garagedash.co.uk (was getgaragely.com when set up).
- [ ] **Google Business Profile**: set one up for GarageDash — this is what makes branded searches
      ("GarageDash") pop straight to the top fast.
- [ ] **Bing Webmaster Tools**: verify getgaragely.com and submit the new sitemap — ChatGPT's web
      search runs on Bing's index. UPDATED (2026-07-06 rebrand): also verify **garagedash.co.uk**
      now that it's the live domain — keep the old getgaragely.com verification too (old site stays live).
- [ ] **Google Search Console**: verify + submit `https://getgaragely.com/sitemap.xml`. UPDATED
      (2026-07-06 rebrand): also verify + submit `https://garagedash.co.uk/sitemap.xml`.
- [ ] **Higgsfield account**: free tier is thin (10 credits/day, watermarked, no Sora 2/Veo
      3.1/Kling) — fine to test, budget for Basic (~$9/mo) or Pro (~$29/mo) once posting regularly.
- [ ] **Social accounts** — create from desktop, not your phone, given the ban-sensitivity: business
      email + a Google Voice/VoIP number for verification, a scheduler (Buffer/Metricool free tier)
      so you never need the native app to post. I can draft bios/handles/first posts once accounts
      exist.
- [ ] **Backlinks/PR**: 2–3 third-party mentions (a UK small-business directory, a trade forum, local
      press) if any come up naturally.

## Why this order

Fixing the revenue bug came first because it undermines trust in every other number. Technician Mode
and the camera came next because they're what keeps a new trial customer once the promo push lands
them. SEO/GEO and analytics are slow-cooking (4–8 weeks to see AI-citation movement) so they're worth
having live now even before the promo starts. The motion kit/design tokens exist so the site (and the
next company's site) looks sharp before traffic gets sent to it. Promo push comes last, once there's
somewhere for people to land and a way to measure whether the ad spend is working.
