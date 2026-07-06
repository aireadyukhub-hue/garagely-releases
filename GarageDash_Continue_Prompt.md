# GarageDash Rebrand — Continuation Prompt

Paste everything below the line into a new Claude session with the `GarageLY` project folder
selected and Chrome connected (logged into Cloudflare, Resend, GitHub, Stripe).

---

We're mid-way through the GarageLY → GarageDash rebrand infra phase. Read the memory file
`garagedash-rebrand` and the Notion "GarageLY — Project Master Doc" first for full state.

**Already done — do not redo:**
- Codebase fully renamed (folders `GarageDash-*`, brand strings, licence prefix GDSH- for new
  keys with GRLY- still valid, approved brand assets wired in, installer icons rebuilt).
- Code URLs flipped to garagedash.co.uk / app.garagedash.co.uk. `RESEND_FROM` deliberately
  still `info@getgaragely.com` (old domain) until Resend verifies the new one.
- `package.json` dual-publishes to `garagedash-releases` (new, created, public) AND
  `garagely-releases` (so existing installs still get updates). Website download links still
  point at the old repo on purpose — flip only after the first release publishes to the new repo.
- Stripe product renamed "GarageDash Monthly" (ID/price/webhook untouched). VRM lookup live.
- DVSA secrets set on worker `garagely-backend` (keep this worker name — old clients call it).
- Domain garagedash.co.uk is active on Cloudflare.
- I was given a terminal block to run: create + deploy Cloudflare Pages projects `garagedash`
  (GarageDash-Website), `garagedash-app` (GarageDash-Web, `npm run build`, deploy `dist`),
  `garagedash-admin` (same), then `wrangler deploy` the worker. Ask me whether I ran it;
  if not, give me the block again.

**Your tasks, in order — check in after each:**
1. Verify my Pages deploys succeeded (`*.pages.dev` URLs load).
2. Cloudflare dashboard: attach custom domains — `garagedash.co.uk` + `www` → project
   `garagedash`; `app.garagedash.co.uk` → `garagedash-app`; `admin.garagedash.co.uk` →
   `garagedash-admin`. DNS is same-account so records auto-create.
3. Resend: add domain `garagedash.co.uk` (use its Cloudflare auto-configure for SPF/DKIM).
   Once verified: set `RESEND_FROM = "GarageDash <info@garagedash.co.uk>"` in
   `GarageDash-Worker/wrangler.toml`, have me `wrangler deploy`. Also check `RESEND_API_KEY`
   secret is set (I was given the command; verify with `wrangler secret list`).
4. Cloudflare Email Routing on garagedash.co.uk: forward `info@` and `support@` to
   lewis.felix000@gmail.com.
5. Draft (DO NOT send) a short plain-spoken email to existing customers explaining the rename
   (there is 1 active paying subscriber). Save as a file for my review.
6. When I say go: rebrand desktop release — `git add -A && git commit`, `npm version patch`,
   `git push --follow-tags`. Note: renames the installed app to GarageDash on update;
   check `.git/index.lock` doesn't exist first.
7. After first release lands in `garagedash-releases`: flip the Website download links from
   `garagely-releases` to `garagedash-releases` and redeploy the marketing site.
8. Docs phase: update all root `.md` files (SETUP-GUIDE, ROUND*_NEXT_STEPS, CLOUD_SYNC_*,
   SOCIAL_MEDIA_STARTER_PACK — handles/bios to GarageDash, new domain) and the Notion master
   doc + roadmap (new name, domain, repo, Pages projects, Resend domain, this whole cutover).
9. Later (1–2 weeks stable): bulk redirect getgaragely.com → garagedash.co.uk. Old sites/repo
   stay live until then — delete nothing.

**Ground rules:** old infra stays live in parallel (no deletions/unpublishing); existing GRLY-
licence keys must keep working; the deployed worker keeps the name `garagely-backend`; appId
`com.garagely.app` must never change; flag anything ambiguous rather than guessing; confirm
with me before anything irreversible or customer-visible.

Also: check my Cloudflare billing for a duplicate domain charge (I paid twice during
registration) — if two charges and one domain, point me to Cloudflare support for a refund.
