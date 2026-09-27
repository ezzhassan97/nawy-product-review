# Building a review page

## Files

```
<review folder>/site/
  index.html                       what the link opens: a landing cover ("See reviews"), then the side menu of every
                                   review with the chosen one beside it; "#<review id>" skips the cover, the logo returns to it
  shared/deck.css, shared/deck.js  the page engine every review uses. Improve it here, never copy it per review
  shared/cover-visual.js           the buildings drawing on the landing cover and on every review's cover
  brand/nawy-logo.svg              the logo, inlined into each cover
  history/                         the PDF of past reviews, when there is one
  reviews/<YYYY-MM-DD>-week-<n>/   one review: index.html + assets/ (demo videos, shots/)
```

- Name and label: `id` `2026-10-05-week-1`, label `5th OCT, 2026 - Week 1`: the review date with its ordinal
  (1st, 2nd, 3rd, 4th … 11th, 12th, 13th … 21st, 22nd, 23rd, 31st), the month's three letters in capitals, the year,
  then the week number (one more than the last review, whatever the calendar says).
- Add it to the side menu: append to `REVIEWS` in `site/index.html`
  `{ id: '2026-10-05-week-1', label: '5th OCT, 2026 - Week 1', short: 'W1', src: 'reviews/2026-10-05-week-1/index.html' }`.
  The newest opens by default.

## The page

Copy `assets/review-template.html` (next to this skill's SKILL.md) to `site/reviews/<id>/index.html` and fill every
`{{…}}` (product texts, links and presenter from the settings). Order: Cover, Updates (only if the PM named one),
Released, Testing, In progress, Next; drop a section with nothing in it.

- **Cover**, always: `product.name`, the subtitle `product.tagline`, and two tags, the review date and `presenter`.
  The logo (`site/brand/nawy-logo.svg`) is inlined as it is, on its white badge, never recoloured or redrawn.
- **Overviews** (`id` = `released`, `testing`, `progress`): one card per feature, fitting one screen. A card whose
  feature has a page links to it (`href="#<feature-id>"`, "Open →"). Testing cards carry their stage badge
  (`stage-testing` Testing, `stage-uat` UAT); In progress cards carry none.
- **A feature's page**: one long page that scrolls, never split across slides. At the top left, always, the back
  button to its overview (`<a class="back" href="#released">← Released</a>`). Then, top to bottom:
  1. kicker (the section), the feature's name, one line on what it does for users;
  2. badges: `Live <date>` or the stage, and the link, "Open in <short> ↗" (production) or "Open on staging ↗";
  3. `.why`: "Pain point" or "Enhancement" with the problem; "Objective" with "Should move: <metric>";
  4. **What we built**: one card per point;
  5. **How it works**: the demo video, then the screenshots;
  6. **The numbers**: released, the measured change (before → now); otherwise "The numbers, expected" (now, target).

  Leave out a part that has nothing in it.
- **Next**: the list in the PM's order. An item they want to talk through gets its own page (with the Jira designs),
  and its list item links to it.

Section colours come from `data-section` (set in `deck.css`): released green, testing light green, in progress
orange, next grey, updates teal. Cards, kickers, icons, the back button and the bottom bar follow them.

How it behaves: pages are 1600 wide, zoomed to the window; ← → move between pages, ↑ ↓ and Space scroll a long page,
F or "Present" goes full screen (inside the side menu, the menu puts the review's frame in full screen); every demo
video gets "Download video" and "Full screen".

## Components (classes in `shared/deck.css`)

| Want | Markup |
|---|---|
| Back to the overview | `<a class="back" href="#released">← Released</a>`: first thing in a feature's page |
| Link to the product | `<a class="badge open" href="<links.production>/<path>" target="_blank" rel="noopener">Open in <short> ↗</a>` |
| Stage | `<span class="badge stage-testing">Testing</span>` / `<span class="badge stage-uat">UAT</span>` |
| Why | `<div class="why"><div><span class="tag" data-icon="pain">Pain point</span><p>…</p></div><div><span class="tag" data-icon="objective">Objective</span><p>…</p><p class="moves" data-icon="metric">Should move: …</p></div></div>` (`data-icon="enhancement"` with "Enhancement") |
| A part of the page | `<h3 class="part-title" data-icon="built">What we built</h3>`; `how` for How it works, `numbers` for The numbers |
| An icon | `data-icon="<name>"` on any element puts the icon in front of it: `pain`, `enhancement`, `objective`, `metric`, `built`, `how`, `numbers` (a new one goes in `ICONS` in `deck.js`) |
| Points | `<div class="cards"><div class="card"><h3>…</h3><p>…</p></div></div>` |
| Demo video | `<figure class="demo"><video src="assets/x.mp4" muted loop playsinline preload="auto"></video><figcaption>…<a href="assets/x.mp4" download>Download video</a></figcaption></figure>`: plays only while its page is open |
| Screenshots | `<div class="shots"><img src="assets/shots/x.png" alt="…"></div>`: click opens full size |
| A number that counts up | `<div class="metric"><div class="value" data-count="312" data-suffix="%">0</div><div class="label">…</div><div class="note">…</div></div>` inside `<div class="metrics">` (`data-prefix`, `data-decimals` too) |
| Before → after | `<div class="before-after"><span class="before">3 days</span><span class="arrow">→</span><span class="after">2 h</span></div>` |
| A change | `<span class="delta up">+47%</span>` / `delta down` |
| A chart (the PM's numbers only) | `<div class="chart" data-chart='{"type":"line" or "bar","labels":[…],"series":[{"name":"…","values":[…]}],"unit":"%","target":100}'></div>` |
| Sources | `<p class="source">Production export, 1 Oct 2026</p>` under the numbers |
| Layout | `<div class="body cols-2">`, `cols-3`, `split` (text left, media right); `rise` on an element makes it rise in |

A new kind of component belongs in `shared/deck.css` / `deck.js` so every review gets it, and must not break the
older ones.

## Demo videos

One per feature, made with the product-demo-video skill from the PM's screenshots or recording (the Jira designs for
Next): working files in `work/<feature>/`, the video in `site/reviews/<id>/assets/<feature>.mp4`, the screenshots in
`site/reviews/<id>/assets/shots/`.

## Check before handing over

Serve the site and look at every page: `python3 -m http.server 8790 --bind 127.0.0.1` in `site/` (or
`npx serve site`), open `http://127.0.0.1:8790/#<id>`, step through with →, scroll each feature's page to its end,
fix anything that overflows or reads too small, then stop the server. Opening `site/index.html` directly works too.

## Sharing it

On request: from `site/`, `vercel deploy --prod --yes` (the folder was linked to `site.project` by setup; if not,
`vercel link --yes --project <site.project>` first), then give the link (`site.url`). It is public: anyone with the
link can open it.
