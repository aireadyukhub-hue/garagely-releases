# GarageLY — Round 5: trial invites + in-app payment prompt

Code-complete and type-checked. No database migration this round.

## What changed

1. **Admin → "Invite a tester"** (was "Create Free Trial"): set the trial length, hit
   **"Invite to try GarageLY for X days"**, and you get the licence key **plus a ready-to-send
   invite message** (download links + key + steps) with a **Copy invite** button and a
   **Compose email** button that opens your mail app addressed to them. No card needed — same
   manual trial as before, just easier to send.
2. **In-app trial prompts** (web + desktop):
   - **Final 5 days:** a slim dismissible "trial ends in X days" banner.
   - **When the trial ends:** a friendly "set up payment" prompt that's **dismissible for 3 days**.
   - **After the 3-day grace:** a **hard lock** — they must subscribe to continue (data kept safe).
   - "Set up payment" opens Stripe checkout for their account.
3. **Pay-to-unlock wiring:** when a tester subscribes, the Stripe webhook now **upgrades their
   existing licence to active** (instead of minting a new key), so their account unlocks
   automatically — no mismatch.

## Deploy (Cloudflare — run each on its own line)

```
cd "/Users/lewisfelix/Documents/Claude/Projects/GarageLY/GarageLY-Worker" && wrangler deploy
```
```
cd "/Users/lewisfelix/Documents/Claude/Projects/GarageLY/GarageLY-Web" && npm run build && wrangler pages deploy dist --project-name garagely-app
```
```
cd "/Users/lewisfelix/Documents/Claude/Projects/GarageLY/GarageLY-Admin" && npm run build && wrangler pages deploy dist --project-name garagely-admin
```

If Liam (or any tester) will use the **Windows desktop app**, also cut a release so the trial
prompt ships to desktop:
```
cd "/Users/lewisfelix/Documents/Claude/Projects/GarageLY"
git add -A && git commit -m "v1.2.1: trial invites + in-app payment prompt"
git push
git tag v1.2.1 && git push origin v1.2.1
```

## Testing tip
To see the end-of-trial prompt without waiting, go to **Admin → Licences**, edit the tester's
licence, and set the **expiry date to today or the past**. Reload the app as that user:
- expiry today → "trial ended" dismissible prompt
- expiry 4+ days ago → hard lock
Set it back to a future date to return them to a normal trial.

## Notes
- The invite uses Copy/Compose-email (works now). Auto-emailing is still pending SendGrid setup.
- Stripe checkout currently includes its standard trial window before the first charge; the
  tester sets up their card now and the licence flips to active on checkout. If you'd prefer
  immediate billing with no extra Stripe trial, say so and I'll add a no-trial checkout path.
