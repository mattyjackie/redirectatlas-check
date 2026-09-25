# RedirectAtlas CSV Check

Catch loops, conflicting destinations and redirect chains before a migration map reaches production.

Runs locally or as a GitHub Action. **No dependencies, network requests or telemetry.** Your CSV stays on your machine or GitHub runner. Supports up to **10,000 rows / 4,000,000 bytes** of UTF-8 CSV.

Want a visual report without installing anything? [Open the free RedirectAtlas browser audit](https://redirectatlas.com/app?utm_source=github&utm_medium=referral&utm_campaign=ci_checker&utm_content=readme) for maps up to 1,000 rows. After deployment, [try live redirect verification](https://redirectatlas.com/monitor?utm_source=github&utm_medium=referral&utm_campaign=ci_checker&utm_content=readme) on domains you control. Live verification is a separate seven-day preview with DNS ownership checks.

## Run locally

Requires Node.js 20 or later. Clone this repository, then run:

```sh
node cli.mjs --file examples/clean.csv --base https://example.com
node cli.mjs --file /path/to/redirects.csv --base https://your-site.com --report report.csv
```

The report includes your source and target URLs. Keep it private. The output folder must already exist; existing files are never overwritten. Terminal logs show aggregate counts and fixed finding names only.

## Check every pull request

Place your map at `redirects.csv` and add this workflow. Change `base_url` to the site's origin. Use a full release commit SHA to pin the action if your workflow requires immutable dependencies.

```yaml
name: Check redirect map
on:
  pull_request:
    paths:
      - redirects.csv
      - .github/workflows/redirects.yml
permissions:
  contents: read
jobs:
  redirects:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683 # v4.2.2
      - uses: mattyjackie/redirectatlas-check@v1.0.0
        id: redirects
        with:
          csv: redirects.csv
          base_url: https://your-site.com
          fail_on: errors
```

No secret or write permission is required. Hosted Actions use Node.js 24 for this action; self-hosted runners need a runner version that supports Node.js 24 actions. GitHub supplies the runtime.

| Input | Default | Meaning |
| --- | --- | --- |
| `csv` | Required | CSV path inside the checked-out workspace. Symlinks cannot escape it. |
| `base_url` | `https://example.invalid` | Origin used for relative paths and cross-origin warnings. Set your actual source origin. |
| `fail_on` | `errors` | `errors`, `review` (errors or warnings), or `never`. Invalid input always fails. |
| `report` | None | Optional new report path inside the workspace. Includes URLs. Never overwritten or uploaded automatically. |

Numeric outputs: `rows`, `errors`, `review`, `clear`. The job summary contains counts and finding types, with no map URLs. Keep sensitive maps in private repositories; runner access and repository visibility are controlled by your GitHub settings.

## CSV format

```csv
Source,Target
/old-shop,/shop
/journal,/blog
```

Shopify's `Redirect from,Redirect to` headers also work. Relative paths start with `/`; absolute URLs start with `http://` or `https://`. Quoted CSV fields, BOM and CRLF are supported. Paths preserve case, query strings and trailing slashes.

## Findings and exit codes

| Finding level | Detected cases |
| --- | --- |
| Error | Invalid or missing URLs, self-redirects, loops, conflicting source destinations, chains reaching ambiguous rules, chains exceeding 100 hops |
| Review | Repeated identical rules, intermediate redirect hops, fragments, cross-origin destinations |
| Clear | No structural finding in this map |

Warnings can be intentional. An external destination is not necessarily a mistake. With `fail_on: errors`, warnings appear in the summary but do not block the workflow.

CLI flags use hyphens: `--fail-on review` and `--report new-report.csv`. Exit codes are `0` for passing the selected threshold, `1` for findings reaching it, and `2` for invalid input or configuration. `--fail-on never` does not conceal malformed input or a failed report write.

## What this does not verify

This is an exact-map structural check. It does **not** visit any URL, install redirects, verify HTTP status or destination content, emulate CMS precedence, evaluate wildcard/server rules, check canonical tags or guarantee search rankings. A clear report still needs testing after deployment. Findings use parsed record positions; CSV fields spanning multiple lines may not match physical text-editor line numbers.

For a complete workflow, see [the migration guide](https://redirectatlas.com/guide?utm_source=github&utm_medium=referral&utm_campaign=ci_checker&utm_content=readme). The free checker has no account or payment requirement.

## Development and feedback

```sh
node --test test.mjs
```

Synthetic fixtures cover clean maps, loops and chains. Integration tests exercise exit behavior, report creation, data minimization and workspace containment. Open a GitHub issue with a small synthetic example; do not post customer maps, credentials or private URLs. Maintained by [RTG Product Labs](https://rtgproductlabs.com). MIT licensed.
