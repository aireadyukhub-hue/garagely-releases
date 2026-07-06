# GarageDash Rebuild Prompt

Paste everything below this line into a new Claude session (with access to the `GarageLY` project folder) once you've bought the domain and are ready to start the technical rename.

---

## Prompt to paste

We're rebranding GarageLY to **GarageDash**. This is a full rename across the codebase, repos, and connected accounts — not a new product, just a new name and identity for the same app.

**Background:** GarageLY shares a name with an unrelated competitor (garagelyapp.com), so we're switching to GarageDash to avoid confusion. GarageDash cleared the UK IPO trademark register, Companies House, and has no existing product using the name. The domain `garagedash.co.uk` has been purchased (confirm with me if not — don't proceed with DNS/live cutover until it's actually registered).

**What I need you to do:**

1. Read the Notion page "GarageLY — Project Master Doc" for full current architecture, credentials, and URLs (Supabase, Stripe, Cloudflare, Resend, GitHub) before changing anything.
2. Rename the project consistently across all four sub-projects: `GarageLY` → `GarageDash`, `GarageLY-Backend` → `GarageDash-Backend`, `GarageLY-Web` → `GarageDash-Web`, `GarageLY-Admin` → `GarageDash-Admin`, `GarageLY-Worker` → `GarageDash-Worker`.
3. Global find-and-replace across all source files, configs, and UI strings: "GarageLY", "GarageLy", "garagely" → "GarageDash" / "garagedash" as appropriate to context (component names, page titles, meta tags, email templates, `package.json` name fields).
4. Update the licence key prefix from `GRLY-XXXX-XXXX-XXXX` to `GDSH-XXXX-XXXX-XXXX` for newly issued keys. **Do not touch or reissue existing keys** — they must keep working under the old prefix indefinitely.
5. Update app icon references, splash screens, and favicon paths to point at new GarageDash brand assets (I'll supply these separately, based on the brand guidelines pack — flag anywhere an asset is missing rather than guessing).
6. Update the Stripe product name from "GarageLY Monthly" to "GarageDash Monthly" and refresh checkout page copy. Do not touch pricing, existing subscriptions, or webhook config beyond the name.
7. Set up new Cloudflare Pages projects (`garagedash`, `garagedash-app`, `garagedash-admin`) pointing at `garagedash.co.uk` and subdomains, once DNS is confirmed live. Keep the existing `garagely.pages.dev` / `getgaragely.com` sites running untouched in parallel — do not delete or unpublish anything old yet.
8. Update the Resend sending domain/templates once `garagedash.co.uk` DNS (SPF/DKIM) is verified.
9. Update GitHub: create a new repo for releases (e.g. `garagedash-releases`), point GitHub Actions auto-update workflow at it. Leave the old public repo (`aireadyukhub-hue/garagely-releases`) in place but make it private or archive it once the new one is confirmed working — don't delete it outright in case old installs still reference it.
10. Update every reference in the Notion Project Master Doc, the Roadmap doc, `SETUP-GUIDE.md`, and any `ROUND*_NEXT_STEPS.md` files to reflect the new name, domain, and repo.
11. Ship a release that works under both the old and new domain/branding simultaneously, so nothing breaks for anyone with an old link or installed copy mid-migration.
12. If there are any live paying customers by the time this runs, draft (don't send) a short, plain-spoken email explaining the rename for me to review before it goes out.

**Ground rules:**
- Don't delete or unpublish any existing live domain, repo, or Stripe object — old infrastructure stays live and redirects for at least 6–12 months per the rebrand plan.
- Don't reissue or invalidate existing licence keys.
- Flag anything ambiguous (e.g. a hardcoded string you're not sure is user-facing) rather than guessing.
- Work through this in phases and check in after each major phase (codebase rename, then infra, then docs) rather than doing everything in one pass.

Refer to `GarageDash_Brand_Guidelines.docx` and `GarageLY_Rebrand_Plan.docx` in this folder for full context on naming rationale and the complete checklist this prompt is built from.
