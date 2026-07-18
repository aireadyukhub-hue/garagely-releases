# Claude Design — Content Plan + Prompts (Round 2)

Claude Design (claude.com/product/design) works differently to Canva AI: you set up a **design system once** and every project uses it automatically — no re-pasting brand rules each time. It can also **web-capture garagedash.co.uk** so designs use your real UI, and it **exports directly** (PDF, PPTX, HTML, or to Canva) — no manual download workaround.

**Workflow:** Step 1 (once) → Step 2 → refine → export.

---

## Step 1 — build the design system (one-time)

During onboarding (or via "design system" settings), upload from this folder: `BRAND-BRIEF.md`, all four `logo-*.png`, `app-icon-1024.png`, and the six `example-*` images. Then say:

> Build my design system from these files. GarageDash is garage management software for independent UK garages (garagedash.co.uk). The brief has exact colours and rules — key points: dark-first (#0A0A0A backgrounds, #111111 cards, #1E1E1E borders), one accent only (gold #F4A523), Inter typography, big bold white headlines, grey #999999 supporting text, gold pill CTA buttons with black text. The example-ad images are the canonical style — match their spacing, glow, and restraint. Never stock photography; product screenshots or pure typography only. British English, plain-spoken, no hype, no emojis in artwork.

Optionally add:

> Also web-capture garagedash.co.uk so you have the real site components for product-style visuals.

## Step 2 — the content plan (new project)

Start a project, attach the five `screenshot-*.png` files, and paste:

> Create a set of 10 social posts (1080×1350 portrait) for Instagram/Facebook using my GarageDash design system. Every post gets a small footer line in grey: "14-day free trial · no card needed · garagedash.co.uk". Headline / supporting line / CTA:
>
> 1. **Free reg check** — "Type a reg. Know the car." / "MOT status, tax, make and model — free reg check built into GarageDash, and free for anyone on our site." / CTA "Try the free reg check"
> 2. **MOT reminders** — "They forgot their MOT. You didn't." / "GarageDash flags every customer's MOT and service dates automatically — reminders that bring them back to your garage, not a competitor's." / CTA "Start free"
> 3. **Switching is easy** — "Still on paper? Diary? Setmore?" / "Bring your bookings with you. Get set up in an afternoon, not a month." / CTA "Switch in a day"
> 4. **Before/after** — split layout: left, muted grey "BEFORE: paper job sheets, a diary, three notebooks, retyping every invoice"; right, gold-accented "AFTER: one screen, one login, whole team." / CTA "See the difference"
> 5. **Unlimited users** — "£29. The whole garage." / "No per-seat fees. No 'contact us for pricing'. Every tech, every advisor, one flat price." / CTA "See pricing"
> 6. **Customer trust** — "Your customer sees the photos." / "Digital inspections with photos and Pass/Advisory/Fail — customers approve work faster when they can see why." / CTA "Start free trial"
> 7. **Tip post** — gold label "GARAGE TIP #1" / "Chasing MOT repeat business? A reminder 4 weeks out wins the booking. At 1 week, they've already booked elsewhere." / no CTA, footer only
> 8. **Technician Mode** — feature screenshot-technician-mode.png on a tablet mockup / "Today's jobs. Nothing else." / "Job sheets and inspections on a shared workshop tablet — no pricing visible." / CTA "Start free"
> 9. **Product proof** — screenshot-jobs-board.png large / "Every job, tracked start to finish." / "Booked → in progress → invoiced. Nothing falls through the cracks." / CTA "See it working"
> 10. **Trial CTA** — "Know within a day." / "14 days free, no card. If it doesn't save you time in week one, it's not for you." / CTA "garagedash.co.uk"
>
> Then 2 Meta ad variants at 1080×1080: (A) post 1 reworked, headline "Free reg check for UK garages"; (B) post 5 reworked, headline "£29/month. Whole garage. No per-seat fees."

## Refining (where Claude Design should beat Canva)

- Comment inline on the exact element ("this headline 20% bigger", "less glow here") instead of re-prompting the whole design.
- Ask for **adjustment sliders**: "give me sliders for glow intensity and headline size across all 10."
- Consistency pass: "apply the spacing from post 3 across the whole set."
- Bonus experiments Canva can't do: "make post 9 an interactive prototype of the jobs board" (great for a website embed or Story), or "turn this set into a one-page media kit PDF".

## Export

Export as PNGs/PDF directly, or send to Canva if you want to hand-tweak there. Also try "export this set as a PPTX" — instant sales deck from the same content.

## Captions for publishing (not for Claude Design)

1. "Type any reg, get MOT status, tax, make and model in seconds — built into GarageDash and free on our site. Handy even if you never sign up. Link in bio."
2. "The average garage loses MOT customers to whoever texts them first. GarageDash flags every due date automatically."
3. "Moving from paper, a diary, or another booking tool? You don't lose your history — bring your bookings with you and be running by tomorrow."
4. "We counted: a paper job sheet gets rewritten three times before it becomes an invoice. Once is enough."
5. "Per-seat pricing punishes you for growing. £29/month covers everyone in your garage. That's the whole pricing page."
6. "Customers say yes faster when they can see the worn pads in a photo. Digital inspections, branded report, straight to their phone."
7. "Free tip whether you use us or not: send MOT reminders 4 weeks out. At 1 week, they've already booked somewhere else."
8. "Your techs don't need reports and pricing — just today's jobs and the inspection form. Technician Mode, on a shared tablet."
9. "Booked → in progress → invoiced. If a job's stuck, you see it before the customer rings."
10. "14 days free, no card needed. Most garages know within a day."

## Canva vs Claude Design — what to judge each on

- **Claude Design should win:** typography-led layouts (your whole brand style), consistency across a 10-post set, precise colour fidelity (#F4A523 exactly), edit-by-comment, using real site UI via web capture, exports.
- **Canva should win:** template variety, photo/illustration libraries, drag-and-drop hand-polish, scheduling/publishing direct to socials.
- Same plan in both = clean comparison. Note which tool needed fewer round-trips to get an acceptable post 1.
