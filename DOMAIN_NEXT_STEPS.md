# GarageLY — getgaragely.com Domain Rollout

All code changes are done. You just need to run some terminal commands and do a few clicks in Cloudflare.

---

## 1. Deploy Worker (picks up new SITE_URL + SENDGRID_FROM)
```bash
cd "/Users/lewisfelix/Documents/Claude/Projects/GarageLY/GarageLY-Worker"
wrangler deploy
```

## 2. Rebuild + deploy web app
```bash
cd "/Users/lewisfelix/Documents/Claude/Projects/GarageLY/GarageLY-Web"
npm run build && wrangler pages deploy dist --project-name garagely-app
```

## 3. Deploy marketing site
```bash
cd "/Users/lewisfelix/Documents/Claude/Projects/GarageLY/GarageLY-Website"
wrangler pages deploy . --project-name garagely
```

## 4. Deploy admin
```bash
cd "/Users/lewisfelix/Documents/Claude/Projects/GarageLY/GarageLY-Admin"
npm run build && wrangler pages deploy dist --project-name garagely-admin
```

---

## 5. Cloudflare Pages — add custom domains (do once in dashboard)

Go to https://dash.cloudflare.com → Workers & Pages, then for each project:

| Project | Custom domain to add |
|---|---|
| `garagely` (marketing) | `getgaragely.com` |
| `garagely-app` (web app) | `app.getgaragely.com` |
| `garagely-admin` (admin) | `admin.getgaragely.com` |

Steps for each:
1. Click the project name
2. Go to **Custom domains** tab
3. Click **Set up a custom domain**
4. Type the domain, click **Continue**
5. Cloudflare will add the DNS records automatically (since the domain is in the same account)
6. Click **Activate domain** — it goes live in minutes

---

## 6. Email Routing — info@getgaragely.com → Gmail

Go to https://dash.cloudflare.com → click **getgaragely.com** → **Email** → **Email Routing**

1. Click **Enable Email Routing** (adds MX records automatically)
2. Under **Routing rules** → **Custom addresses** → **Create address**
3. Enter: `hello` → Forward to → `lewis.felix000@gmail.com`
4. You'll get a verification email to Gmail — click the link to confirm

That's it. Anything emailed to info@getgaragely.com will land in your Gmail.

---

## 7. SendGrid — activate email sending from info@getgaragely.com

Once you have a SendGrid account:

1. SendGrid dashboard → **Settings** → **Sender Authentication** → **Authenticate Your Domain**
2. Enter `getgaragely.com` → follow steps → it gives you DNS records to add to Cloudflare
3. Add those DNS records in Cloudflare → **getgaragely.com** → **DNS**
4. Back in SendGrid, click **Verify**
5. Then run: `wrangler secret put SENDGRID_API_KEY` (paste your SendGrid API key)
6. `SENDGRID_FROM` is already set to `info@getgaragely.com` in wrangler.toml — no secret needed

---

## 8. Desktop release (optional — pushes new domain to installed apps)
```bash
cd "/Users/lewisfelix/Documents/Claude/Projects/GarageLY"
git add -A && git commit -m "v1.2.4: domain update to getgaragely.com"
git push
git tag v1.2.4 && git push origin v1.2.4
```

---

## What was updated in code
- `wrangler.toml`: SITE_URL → getgaragely.com, added SENDGRID_FROM
- `GarageLY-Worker/src/index.ts`: fallback URL + invite email URLs
- `GarageLY-Admin/src/pages/CreateTrial.tsx`: SITE_URL + WEB_URL
- `src/pages/Auth.tsx`: trial link + support email
- `src/pages/Activate.tsx`: website link + support email
- `GarageLY-Website/index.html`: footer email
- `GarageLY-Website/success.html`: support email in error messages
