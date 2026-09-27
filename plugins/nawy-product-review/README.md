# Nawy product review

A Claude Code plugin for product managers. It turns what your squad shipped (Jira stories, GitHub pull requests)
into a product review for management: an interactive page on your own link, one page per feature told as a pitch
(the problem, the objective, what was built, a demo video, the numbers). It does the mundane part (reading Jira and
GitHub, writing descriptions, making demo videos, publishing) and asks you before anything goes on the page.

## Install

You need Claude Code: the Code tab of the Claude desktop app, or the `claude` terminal app.

**From GitHub** (recommended, you get updates). In a terminal:

```
claude plugin marketplace add ezzhassan97/nawy-product-review
claude plugin install nawy-product-review@nawy-product-review
```

(Inside Claude Code, the same with `/plugin marketplace add …` and `/plugin install …`, or simply ask Claude to
install the plugin from `ezzhassan97/nawy-product-review`.)

**From the zip**: unzip it and move the `nawy-product-review` folder into your Claude skills folder:
`~/.claude/skills/` on a Mac, `C:\Users\<you>\.claude\skills\` on Windows. It loads in your next Claude Code session.

Then open a new Claude Code session and say: **"Set up my product review"**.

## What's inside

| Skill | Say | What it does |
|---|---|---|
| product-review-setup | "Set up my product review" | About 15 minutes: connects Jira (and GitHub, Vercel), asks which project, repos and teammates count, which demo-video renderer suits your computer, takes a PDF of your past reviews, builds a test review and puts it on `https://<product>-product-review.vercel.app`. Run it again any time to change a setting. |
| product-review | "Make my product review for 5th October" | Gathers everything since your last review, asks what to announce and which features to show, confirms each feature's description, numbers and screens with you, then builds the review and publishes it when you say. |
| product-demo-video | "Make a demo video of the new issues page" | Turns your screenshots or a screen recording into a feature video: a laptop, the camera moving to what matters, a spotlight, labels, a cursor clicking, step captions, a Nawy title card. |

## What it needs

- **Jira**: the Atlassian connector in Claude (setup walks you through it). Required.
- **GitHub**: the GitHub command-line tool or Claude's GitHub connector. Optional: without it, reviews come from Jira.
- **Vercel**: a free account and the Vercel command-line tool, which needs Node (nodejs.org). For your live link.
- **Demo videos**: on a Mac, Swift (usually already there), or on any computer, JavaScript (Node plus two packages
  installed once). Setup lets you choose and explains each.
- **Screens**: screenshots or screen recordings of your product come from you.

## Make it yours

Everything about your product lives in `product-review.json` in your review folder (default `~/product-review/`):
the cover texts, the Jira project and which statuses mean released, testing, UAT, in progress and next, the repos,
your squad, your product's links and the video renderer. The look is in `site/shared/deck.css`. The rules for what
goes on a review are in the product-review skill: ask Claude to change them.

## Update

GitHub install: `claude plugin marketplace update nawy-product-review`, then
`claude plugin update nawy-product-review@nawy-product-review`, and restart Claude Code. Zip install: replace the
folder with the new one, or switch to the GitHub install.

Fonts: Poppins, under the SIL Open Font License (`skills/product-demo-video/assets/fonts/OFL.txt`).
