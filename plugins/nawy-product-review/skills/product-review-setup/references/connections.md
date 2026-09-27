# Connecting Jira, GitHub and Vercel

Check first, then fix only what's missing. Anything that needs a password or a login page is done by the PM in their
browser; never ask them for a password or a token in the chat.

## Jira: the Atlassian connector in Claude

- **Check**: call the Atlassian connector's user-info or accessible-resources tool. It answers → connected; the
  accessible resources give the site's `cloudId` and URL.
- **Not connected**: in the Claude app, Settings → Connectors → Atlassian (Jira & Confluence) → Connect, and sign in
  with the work account. In the Claude Code terminal, `/mcp` shows the connectors and their state. Then start a new
  message so the tools load, and check again.
- **Projects**: the connector's visible-projects tool, or a JQL search per candidate key.
- **Statuses**: the project-statuses call if the connector offers a REST read; otherwise search
  `project = <KEY> ORDER BY updated DESC` (up to 200 issues, field `status`) and take the distinct statuses.
  Propose the mapping from the names, then confirm:

  | Section | Typical statuses |
  |---|---|
  | released | Released, Done, Closed |
  | testing | Ready for Testing, In Testing, QA, Ready for Re-test |
  | uat | UAT, Product UAT, Ready for Deployment |
  | progress | In Progress, In Development, Code Review, Ready for Staging, Returned for Fix, Re-Open |
  | next | To Do, Selected for Development, Ready for Dev |
  | left out | Open, Backlog, On-hold, Cancelled, Discarded, Won't Do |

- **Assignees**: from the same search (field `assignee`), the people with their account ids.

## GitHub

Two ways; the command-line tool is the recommended one in Claude Code.

**GitHub command-line tool (`gh`)**
- Check: `gh --version`, then `gh auth status` (lists the logged-in accounts).
- Install: Mac `brew install gh` (no Homebrew → the installer at cli.github.com); Windows `winget install GitHub.cli`;
  Linux, see cli.github.com.
- Log in: `gh auth login` → GitHub.com → HTTPS → log in with a browser. The PM does the browser part.
- Company repos under SSO: the login asks them to authorize the organization; if repos are missing later, run
  `gh auth refresh` and authorize it.
- Several accounts: `gh auth switch --user <login>` to the one that sees the product's repos; save it as
  `github.account`.
- Repos: `gh repo list <org> --limit 200 --json name,description,pushedAt` (their org from
  `gh api user/orgs -q '.[].login'`).
- People: for each chosen repo,
  `gh pr list --repo <org>/<repo> --state merged --limit 300 --search "merged:>=<60 days ago>" --json author -q '.[].author.login'`,
  counted per login.

**Claude's GitHub connector**
- Settings → Connectors → GitHub → Connect, and allow the company's organization. Use its tools for repos and merged
  PRs; save `github.via` as `connector`.

**Skipping GitHub**: `github.via` = `none`. The review then comes from Jira alone; say that PRs without a story won't
be seen.

## Vercel

- Check: `vercel --version`, then `vercel whoami`.
- Install: `npm install -g vercel` (needs Node; Node from nodejs.org, the LTS version).
- Log in: `vercel login` → they choose how (GitHub, Google or email) in the browser. A free Hobby account is enough.
- Deploy: from the review folder's `site/`, `vercel link --yes --project <short>-product-review`, then
  `vercel deploy --prod --yes`; `vercel inspect <deployment url>` shows the production address.
- Claude's Vercel connector is an alternative for people who have it; the command-line tool is simpler here.

## Node (for Vercel, and for the JavaScript video renderer)

- Check: `node --version` (18 or newer).
- Install: nodejs.org → LTS installer (Mac and Windows), or `brew install node` on a Mac.
