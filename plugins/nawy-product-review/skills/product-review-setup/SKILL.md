---
name: product-review-setup
description: Onboard a product manager to the Nawy product review in about 15 minutes, ending with a live link like <product>-product-review.vercel.app. Checks and connects Jira, GitHub and Vercel, asks which Jira project, repos and teammates count, which demo-video renderer suits their computer (Swift on Mac, JavaScript anywhere), takes a PDF of their past reviews, then builds a test review and deploys it. Use right after the nawy-product-review plugin is installed, when someone asks to set up, onboard or configure their product review or weekly slides, to change its settings, or when the product-review skill finds no product-review.json.
---

# Product review setup

The goal: in 10 to 15 minutes the PM has a live review site with a test review on it, and knows how to make the
real one. They are product managers, not developers: talk plainly, do every check yourself, ask only what you can't
find out, one batch of questions per step. Keep a short checklist in the chat as you go (✓ done, → now).

Open with what they'll get and the steps:
1. your product, 2. Jira, 3. GitHub, 4. your product's links, 5. past reviews, 6. demo videos, 7. Vercel,
8. a test review on your live link.

Already set up (a `product-review.json` exists, see the product-review skill's `references/config.md`)? Then this is
a change: show the current settings, ask what to change, change only that.

## 1. The product

Ask, in one message:
- the product's name as it goes on the cover ("Inventory Management System");
- a short name for the menu and the link ("IMS");
- one line about it, the cover's subtitle ("Single place for real estate data ingestion");
- their name, which goes on every cover;
- where to keep the reviews: `~/product-review/` unless they want another folder.

The link will be `https://<short>-product-review.vercel.app` (lowercase). Tell them.

## 2. Jira (required)

Details: `references/connections.md`, Jira.
1. Check the Atlassian connector (its user-info or accessible-resources tool). Not connected → walk them through
   connecting it, then continue.
2. The site: its cloudId and URL. More than one → ask which.
3. The project: list the projects they can see; ask which is their product's.
4. The statuses: collect the project's statuses and propose which feed each section: Released, Testing, UAT,
   In progress, Next, or left out. Show it as a small table and confirm.
5. Whose work: the whole project (default), or only some people's stories? If some, list the assignees seen in the
   last 60 days and let them pick.

## 3. GitHub (recommended)

Details: `references/connections.md`, GitHub.
1. Check the GitHub command-line tool (`gh --version`, `gh auth status`) or Claude's GitHub connector.
2. Neither → offer: the command-line tool (recommended), the connector, or skipping GitHub (the review then comes
   from Jira alone).
3. Several accounts (personal and work)? Pick the one that sees the company's repos.
4. The repos: list what their organization has; ask which belong to their product.
5. The people: list who merged PRs in those repos in the last 60 days, with counts; ask whose PRs count (their squad).

## 4. The product's links (optional)

Production and staging addresses, for the "Open in <short>" buttons on each feature's page. Say now that screenshots
and recordings will come from them: a browser pane here can open the product but can't save images.

## 5. Past reviews (optional)

"Do you have a PDF of your past reviews?" If so, copy it to `site/history/past-reviews.pdf` and make it the first
side-menu entry, labelled "Before <date of their first review here>" (ask the date).

## 6. Demo videos

Find out the computer (`uname -s`: Darwin is a Mac; on Windows, PowerShell or `$env:OS`). Then offer the renderers,
with what each needs (the product-demo-video skill, "The renderer"):
- **Mac**: Swift, usually nothing to install (check `swift --version`; if missing, `xcode-select --install`, an Apple
  download of 1-2 GB), or JavaScript.
- **Any computer**: JavaScript, which needs Node 18+ (check `node --version`; also needed for Vercel) and two packages
  installed once (~100 MB) with `npm install` in the product-demo-video skill's `scripts/` folder.

Let them choose, install what the choice needs (with their OK), then prove it: render a card-only clip,
`{"intro": {"kicker": "<short>", "title": "Your demo videos work"}, "scenes": []}`, to `work/setup-check.mp4` and
tell them where it is.

## 7. Vercel

Details: `references/connections.md`, Vercel. Check `vercel --version` and `vercel whoami`. Missing → install and log
in (they log in themselves, in the browser; a free account is enough). Tell them the link will be public: anyone
with it can open it.

## 8. The folder, the test review, the live link

1. Create the review folder: copy the product-review skill's `assets/site/` to `<folder>/site/`, make `<folder>/work/`,
   fill the `{{PRODUCT}}`, `{{SHORT}}`, `{{TAGLINE}}` and `{{PRESENTER}}` placeholders in `site/index.html`, and write
   `<folder>/product-review.json` with everything from steps 1-7 (format: `references/config.md` of the product-review
   skill).
2. Build the test review with the product-review skill in quick mode (last 14 days, released only, up to three
   features, no numbers, no videos, labelled "Test · <date>").
3. Deploy: in `site/`, `vercel link --yes --project <short>-product-review`, then `vercel deploy --prod --yes`. Open the
   link and check that it loads. If Vercel gave a different address (the name was taken), save the real one in
   `site.url`.

## 9. Hand over

Keep it short:
- **the link**;
- **the skills**: product-review-setup (this one, run it again to change any setting), product-review ("make my
  product review for <date>": it gathers Jira and GitHub, asks you what to show, builds and deploys),
  product-demo-video ("make a demo video of <feature>" from your screenshots or a recording);
- **what to change, where**: `product-review.json` for the Jira project, statuses, repos, people, links and video
  renderer; the cover texts in the same file; the look in `site/shared/deck.css`; the review's rules in the
  product-review skill;
- **next**: "When you're ready for the real review, tell me the date you present." The test entry goes when the first
  real review is built.
