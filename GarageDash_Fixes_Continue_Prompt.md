# GarageDash — Continuation Prompt (post-rebrand, back to fixes & updates)

Paste everything below the line into a new Claude session with the `GarageLY` project folder
selected and Chrome connected (logged into Cloudflare, Resend, GitHub, Stripe, Notion).

---

The GarageLY → GarageDash rebrand (codebase + infra + docs) is DONE as of 6 July 2026. Read the
memory file `garagedash-rebrand` for full detail before doing anything — it has the complete
history of what was done and why. Short version below for context; don't redo any of it.

**Rebrand — fully complete, do not redo:**
- Codebase renamed (GarageDash-{Admin,Backend,Web,Website,Worker} folders; brand strings; licence
  keys accept both GDSH-/GRLY-; appId `com.garagely.app` and worker name `garagely-backend`
  deliberately unchanged).
- Domain garagedash.co.uk live on Cloudflare; Pages projects `garagedash`/`garagedash-app`/
  `garagedash-admin` deployed with custom domains attached (garagedash.co.uk+www, app., admin.).
- Resend: garagedash.co.uk verified, `RESEND_FROM` + `RESEND_API_KEY` live and deployed.
- Cloudflare Email Routing: info@/support@garagedash.co.uk → lewis.felix000@gmail.com, Active.
- Stripe product renamed "GarageDash Monthly" (ID/price/webhook unchanged).
- Desktop v1.2.5 released — published to BOTH `garagedash-releases` and `garagely-releases`
  (existing installs auto-update; garagedash-releases repo had to be seeded with an initial commit
  first since GitHub won't create a release in a totally empty repo — now fixed, future releases
  should publish cleanly to both without that workaround).
- Website download links flipped to `garagedash-releases`.
- Cloudflare billing double-charge already auto-refunded by Cloudflare (credit memo) — no action.
- All root .md docs + the Notion "GarageDash — Project Master Doc" and roadmap page updated for
  the new name/domain/repo/Pages projects.
- getgaragely.com **kept alive on purpose** (Lewis has SEO/GEO work invested there) — shows an
  orange "we've rebranded" banner with a 6s auto-redirect to garagedash.co.uk on `index.html`, and
  a banner-only (no auto-redirect) notice on `success.html` so nobody gets yanked away before
  copying their licence key. Ask Lewis to confirm he ran
  `cd GarageDash-Website && wrangler pages deploy . --project-name garagely` to push this live —
  if not, give him that command again.

**Still open from the rebrand (small, not urgent):**
1. `customer_rename_email_draft.md` in the project folder — drafted, NOT sent. Ask Lewis if he
   wants to send it now, edit it, or hold off.
2. Redirect getgaragely.com → garagedash.co.uk more permanently (e.g. a real 301) was originally
   planned for "1-2 weeks after stable" — now superseded by the soft JS-banner redirect above,
   which Lewis wants kept indefinitely rather than a hard cutover. Don't do a hard redirect unless
   he explicitly asks.

**New backlog items Lewis flagged (not started, no urgency signaled):**
- The web app needs to read more obviously as an installable app for phone/tablet visitors —
  likely surface the existing PWA install prompt / "add to home screen" messaging more prominently
  on the *marketing site* for mobile visitors, not just inside the web app itself. Needs scoping —
  ask Lewis what "more obvious" should look like (banner on site? bigger callout on download
  section? something else) before building.
- Logo colour mismatch — Lewis said the new GarageDash mark (`#FF6A00`, flat orange) reads as more
  "dark orange" next to the older rebrand pass's colour (`#F4A523`, more yellow/gold, from the
  June 2026 "BRANDING ROLLOUT" — see `garagely-cloud-sync` memory). He flagged this as a "big-ish
  job" for later, not asking to start now. When he's ready: needs a decision on which orange is
  canonical, then a consistent recolor pass across app/web/admin/website/email assets.

**Your task:** start by asking Lewis what he wants to fix/update first — he said he has a list of
"fixes and updates" to get back to now that the rebrand infra is stable. Don't assume scope; ask
before starting multi-step work, per usual.

**Ground rules (carry forward):** old infra stays live in parallel, nothing deleted/unpublished;
`GRLY-` licence keys keep working forever; worker name stays `garagely-backend`; appId stays
`com.garagely.app`; flag anything ambiguous rather than guessing; confirm before anything
irreversible or customer-visible.
