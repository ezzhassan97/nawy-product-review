# Where the review's content comes from

Everything below reads `product-review.json` (called "settings" here).

## The period

From the date of the last review in `REVIEWS` (`site/index.html`; the date is in its id) to the day the PM presents.
Not a fixed two weeks.

## Jira: the Atlassian connector

Use `settings.jira.cloudId`. Search with the connector's JQL search tool, fields
`summary, status, parent, resolutiondate, updated, priority, assignee, description`; epics come back as `parent`.
A story's description gives the problem and what was built, its epic's description the bigger picture, its
attachments the designs (download them with the connector's attachment tool).

Every query starts `project = <jira.project> AND issuetype in (<jira.issueTypes>)`, plus
`AND assignee in (<jira.assignees>)` when that list isn't empty. Then per section, with the statuses from
`jira.statuses`:

| Section | JQL | On the page |
|---|---|---|
| Released | `status in (<released>) AND resolved >= "<period start>" AND resolved <= "<presenting date>"` | Live <date> |
| Testing | `status in (<testing>, <uat>)` | **Testing** or **UAT**: a feature is UAT only when all its stories are in a `uat` status |
| In progress | `status in (<progress>)` | nothing: the section says it |
| Next | `status in (<next>) ORDER BY priority DESC, rank ASC` | the order the PM picks |

A status in none of these lists never shows (Open, On-hold, Cancelled …). If the connector isn't reachable, say so
and stop: ask the PM to reconnect it (product-review-setup, Jira).

## GitHub: what the squad merged

`settings.github.via`:
- `gh`: switch to the right account first (`gh auth switch --user <github.account>` when they have several), then
  for each repo in `github.repos`:
  ```bash
  gh pr list --repo <repo> --state merged --limit 300 --search "merged:>=<period start>" \
    --json number,title,author,baseRefName,headRefName,mergedAt,url \
    -q '[.[] | select(.author.login | IN("<login>", "<login>"))]'
  ```
  (several `author:` in one search mean *all* of them, so filter afterwards, as above; drop the `select` when
  `github.people` is empty).
- `connector`: the same through Claude's GitHub connector: merged PRs of each repo in the period, by the same people.
- `none`: skip GitHub; the review comes from Jira alone.

Match PRs to stories by the story key (`<PROJECT>-<n>`) in the branch or the title. The PRs tell you what shipped and
what the stories really changed; nothing from them is counted on the page. PRs with no story are candidates too.

## The product: links and screens

- `links.production` for released features, `links.staging` for features in testing; add the page's path (ask the
  PM, or read it from the frontend's routes if they gave you the repo). No link set → no "Open in …" button.
- Screenshots and recordings of the product come from the PM. A browser pane can open the product (once they sign
  in there) but can't save an image to a file. Ask in round 2, in the order of the flow.

## Numbers

Only from the PM: numbers they give, or sheets and exports they want analysed. Each goes on the page with its
source and date. Never from a staging database, never estimated.
