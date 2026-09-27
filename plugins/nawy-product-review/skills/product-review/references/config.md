# product-review.json: one product's settings

Setup writes it; every skill reads it; the user can edit it any time (or rerun setup). It lives at the root of the
review folder and is never deployed.

```
<review folder>/            default ~/product-review/
  product-review.json       this file
  site/                     what gets deployed: index.html, shared/, brand/, history/, reviews/<id>/
  work/                     working files: storyboards, grids, stills, raw screenshots (never deployed)
```

Find it in the current folder, then its parents, then `~/product-review/`. None → run the product-review-setup skill.

## Format

```json
{
  "product": { "name": "Inventory Management System", "short": "IMS", "tagline": "Single place for real estate data ingestion" },
  "presenter": "Ezz Hassan",
  "site": { "project": "ims-product-review", "url": "https://ims-product-review.vercel.app" },
  "jira": {
    "cloudId": "<the Atlassian site id, found by setup>",
    "siteUrl": "https://nawy.atlassian.net",
    "project": "IMS",
    "issueTypes": ["Story", "Task"],
    "assignees": [],
    "statuses": {
      "released": ["Released", "Done"],
      "testing": ["Ready For Testing", "In Testing", "Ready for Re-test"],
      "uat": ["Product UAT", "Ready for Deployment"],
      "progress": ["In Progress", "Code Review", "Ready For Staging", "Returned for Fix", "Re-Open"],
      "next": ["To Do"]
    }
  },
  "github": {
    "via": "gh",
    "account": "<work GitHub login>",
    "repos": ["<org>/<product>-frontend", "<org>/<product>-backend"],
    "people": ["<github-login>", "<github-login>"]
  },
  "links": { "production": "https://…", "staging": "https://…" },
  "video": { "renderer": "swift" }
}
```

| Key | Meaning |
|---|---|
| `product.name`, `short`, `tagline` | the cover's title, the short name (menu, link, "Open in …"), the cover's subtitle |
| `presenter` | the name on every cover |
| `site.project`, `site.url` | the Vercel project and its link |
| `jira.cloudId`, `siteUrl`, `project` | the Atlassian site and the project key |
| `jira.issueTypes` | which issue types count (never sub-tasks) |
| `jira.assignees` | account ids whose work counts; empty = the whole project |
| `jira.statuses` | which Jira statuses feed each section; a status in none of them is left out (Open, On-hold, Cancelled …) |
| `github.via` | `gh` (GitHub command-line tool), `connector` (Claude's GitHub connector) or `none` (Jira only) |
| `github.account` | with `gh`: the account that sees these repos (`gh auth switch --user <account>` first) |
| `github.repos`, `people` | the repos to read, and whose merged PRs count (GitHub logins) |
| `links.production`, `staging` | the product's addresses, for the "Open in …" buttons; empty = no button |
| `video.renderer` | `swift` (Mac) or `node` (any computer), for the product-demo-video skill |
