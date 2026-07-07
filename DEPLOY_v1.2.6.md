# Deploying v1.2.6 — run these in Terminal on your Mac

The sandbox can't do this part: it has no Cloudflare login, and a stray
`.git/index.lock` from my session can only be removed from your real
Terminal (same issue as last time — see `GarageDash_Continue_Prompt.md`).

## 1. Clear the stale lock, then commit

```
cd ~/Documents/Claude/Projects/GarageLY
rm -f .git/index.lock
git status   # confirm everything below shows up (already staged)
git commit -m "v1.2.6: dashboard Reg Check widget + MOT defects, Gold Check (VDGL) scaffold, logo colour revert + site fixes"
git tag v1.2.6
git push origin main --tags
```

This pushes to `garagely-releases`/`garagedash-releases` and kicks off the
GitHub Actions build. Windows build should succeed; Mac build will fail as
usual (no Apple signing cert yet — expected, not a new problem).

## 2. Deploy the Worker (Reg Check defects + Gold Check endpoint)

```
cd GarageDash-Worker
wrangler deploy
```

Safe to deploy now even before VDGL approves you — `/gold-check` just
returns "not set up yet" until `VDGL_API_KEY`/`VDGL_BASE_URL` secrets exist.

## 3. Deploy the web app (dashboard Reg Check card)

```
cd GarageDash-Web
npm run build
wrangler pages deploy dist --project-name garagedash-app
```

## 4. Deploy the marketing sites (logo colour revert + banner fix — carried over from last session, still pending)

```
cd GarageDash-Website
wrangler pages deploy . --project-name garagedash   # new domain
wrangler pages deploy . --project-name garagely     # old domain, banner colour fix
```

## 5. Once VDGL approves you

Send me the API key + a sample response from their portal docs and I'll
verify/fix the field mapping in `goldCheck()` and set the two secrets:

```
cd GarageDash-Worker
wrangler secret put VDGL_API_KEY
wrangler secret put VDGL_BASE_URL
wrangler deploy
```

I've already scheduled myself to nudge you about VDGL approval in 3 days
(Thu 9 Jul, 9am).
