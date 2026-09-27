---
name: product-review
description: Build the next product review for management, an interactive page on the PM's own link (side menu entries like "5th OCT, 2026 - Week 1"). Reads product-review.json, gathers everything since the last review from Jira and the squad's merged GitHub PRs, then asks the PM before building anything (big updates, which features to show, each feature's description, numbers and screens) and only then builds the cover, updates, released, testing, in progress and next, one page per feature told as a pitch (problem, objective, what was built, demo video, numbers), and deploys it on request. Use whenever someone asks for their product review, weekly or bi-weekly review, review slides or management review, or slides on what their squad released or is working on.
---

# Product review

Every week or two a product manager presents their product to management. This skill saves them the mundane part:
going through Jira and GitHub, writing each feature's description, making the demo videos and placing the
screenshots. It hands them a review they're proud of. It never decides for them what management sees, and it never
makes a number up.

Start by reading `product-review.json` (`references/config.md` says where it is and what's in it). No file → run the
product-review-setup skill first. Read `references/sources.md` when gathering and `references/building.md` when
building. "The PM" below is the person you're working with (`presenter`).

## What management sees, and never sees

A handful of features, each told as a short pitch on its own page:
1. why: a pain point or an enhancement, and the objective;
2. the metric it should move;
3. what was built, in a few plain points;
4. how it works: the demo video (the product-demo-video skill) and screenshots;
5. the numbers: where they are now and where they should go (measured, for released features).

Never on the page:
- counts of pull requests or stories, or anything about the squad's productivity;
- story keys, Jira links or Jira status names. Testing says **Testing** or **UAT**, In progress says nothing more,
  Next is an order of priority;
- bug fixes and cosmetic tweaks, unless the PM asks for one;
- numbers or charts the PM didn't give: nothing from a staging database, nothing estimated.

## 1. The period

The PM gives the date they present (ask if they haven't). The review covers everything from the last review in the
side menu (`REVIEWS` in `site/index.html`) up to that date, however long that is. The week number is one more than
the last review's. With no earlier dated review, ask where the period starts.

## 2. Gather, quietly

Pull the period from Jira and GitHub (`references/sources.md`). Build nothing yet.

## 3. Round 1: what goes in

One message, in this order:
1. **Big updates.** "Besides releases, testing and what's next, is there a big update you want to announce?" (a
   milestone, a result, a decision, a risk). The Updates section exists only if they name one, and its content comes
   from them.
2. **Released, Testing, In progress.** The candidates, grouped into proposed features (usually an epic; a single
   story when it matters on its own, so ask when unsure), numbered so they can pick, one line each on what it is.
   Bug fixes and cosmetic changes are listed apart as "left out unless you want them". PRs with no ticket appear too,
   for them to place or drop.
3. **Next.** The upcoming stories, grouped the same way: which to show, and in what order.

## 4. Round 2: each chosen feature's material

For every feature they kept, show the draft and ask "Is this right? Anything to add or change?":
- pain point or enhancement, the problem, the objective, the metric it should move;
- what was built, as plain points (from the stories' descriptions and the PRs).

Then ask for what only they have:
- **numbers**: released features, before → now; testing and in progress, now and the target. Their numbers, or
  sheets they give you to analyse (only the final figures go on the page, with their source and date);
- **screens**: released and testing features, screenshots or a screen recording of the product in the order of the
  flow (production for released, staging for testing); for Next, the Jira designs, which you download yourself, plus
  product screens if the screen already exists;
- **the demo's steps**: propose them, one line each, for the product-demo-video skill;
- **the page to link**: production for released, staging for testing (`links` in the settings, plus the page path).

Keep going until every feature has what its page needs, and say what will be left out if something never comes.
Build nothing until this is settled.

## 5. Build, check, hand over

Make each feature's demo video with the product-demo-video skill, build the page (`references/building.md`), add it
to `REVIEWS`, check every page in the browser, then give the PM the path. Deploy when they ask (`references/building.md`,
Sharing it). Their comments come next: change what they ask, nothing more.

## Quick mode: the test run during setup

When product-review-setup asks for a test review, skip the rounds: take the last 14 days, Released only, up to three
features you choose from Jira, drafts written from the stories, no numbers, no demo videos. Label it
`Test · <date>` (id `test-<YYYY-MM-DD>`), build it, and say plainly that it is a sample: the real one asks them
everything first. The first real review replaces it (remove its folder and its `REVIEWS` line, after asking).
