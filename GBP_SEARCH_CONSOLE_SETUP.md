# Google Business Profile + Search Console + Bing — Setup Steps

Two things Lewis needs to actually click through (can't be done from the sandbox — both require a
Google login). Content is already written; this is just the "click here, paste this" path. ~20
minutes total.

## Part 1 — Google Business Profile (~10 min)

All the content (description, category, Q&A, etc.) is already drafted in `GOOGLE_BUSINESS_PROFILE.md`
in this folder. Steps:

1. Go to [business.google.com](https://business.google.com) and sign in with whichever Google
   account you want to own this listing (recommend a business-relevant account, not a throwaway).
2. Click **Add your business to Google** (or **Manage now**).
3. Business name: type `GarageDash`.
4. Business category: choose **Software Company** (see `GOOGLE_BUSINESS_PROFILE.md` → Category
   section for backups if that's not offered).
5. When asked "Do you have a location customers can visit?" → click **No**.
6. When asked for a service area → select **United Kingdom**.
7. Add contact details: website `https://garagedash.co.uk`, email `info@garagedash.co.uk`, phone
   optional (leave blank if you don't want business calls on it).
8. Google will ask you to verify. For a service-area business without a public address, this is
   usually by **phone or email verification** rather than a postcard — follow whichever option
   Google offers.
9. Once verified, open the profile editor and paste in:
   - The **description** (750-char block in `GOOGLE_BUSINESS_PROFILE.md`)
   - The 5 **services** listed there
   - The 4 **Q&A** pairs (Google's Q&A is public and user-submittable, so post these as the business
     owner to seed accurate answers before anyone else asks a worse one)
10. Upload photos: square logo from `brand/garagedash/` as the profile photo. Screenshots can wait
    until you have some to hand — not blocking.

**After it's live:** ask 2-3 early customers for a genuine Google review. Review count/recency is
one of the strongest signals for branded search ("GarageDash reviews") showing a rich result.

## Part 2 — Google Search Console (~5 min)

This tells Google to actively crawl and index the new pages (compare.html, the best-in-UK roundup,
and the 3 feature pages) instead of waiting to discover them organically.

1. Go to [search.google.com/search-console](https://search.google.com/search-console).
2. Add property → choose **URL prefix** → enter `https://garagedash.co.uk`.
3. Verify ownership. Since the site's on Cloudflare Pages, the easiest method is usually:
   - **HTML tag**: Google gives you a `<meta name="google-site-verification" ...>` tag → add it
     into `GarageDash-Website/index.html`'s `<head>` and redeploy, or
   - **DNS TXT record**: add the TXT record Google gives you to the garagedash.co.uk DNS zone in
     the Cloudflare dashboard (Cloudflare → garagedash.co.uk → DNS → Add record).
   DNS is usually less fiddly since it doesn't need a redeploy. Come back to me if you want the
   meta-tag added to the codebase instead.
4. Once verified, go to **Sitemaps** in the left nav, enter `sitemap.xml`, and submit.
5. Optionally, under **URL Inspection**, paste in the new page URLs
   (`/compare.html`, `/best-garage-management-software-uk.html`, etc.) and click **Request
   indexing** on each — this nudges Google to crawl them faster than waiting for the sitemap to be
   picked up naturally.

## Part 3 — Bing Webmaster Tools (~3 min)

Smaller volume than Google but AI answer engines like Copilot lean on Bing's index, so worth doing.

1. Go to [bing.com/webmasters](https://www.bing.com/webmasters).
2. Sign in, add site `https://garagedash.co.uk`.
3. Bing Webmaster Tools has an **"Import from Google Search Console"** option if you've just done
   Part 2 — use that to skip re-verifying manually.
4. Submit `sitemap.xml` the same way as Search Console.

## What this unlocks

Once both are verified, ping me and I can (with API access, if you connect it) or you can manually
check the **Performance** reports in a few weeks to see which pages/queries are actually driving
impressions — that's what tells us whether to double down on comparison pages, feature pages, or
pivot the content plan.
