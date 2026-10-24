# Remove an extra hop from a domain-move map

A domain move can accidentally send an old page through another old path before reaching the new site. This fictional example compares that chain with a direct destination. It uses reserved example domains and makes no requests to them.

## Run the comparison

Use Node.js 20 or later. Run each checker command separately: a findings exit code is expected and must not prevent the second command from running.

```sh
git clone https://github.com/mattyjackie/redirectatlas-check.git
cd redirectatlas-check
node cli.mjs --file examples/domain-move-before.csv --base https://old.example.com
node cli.mjs --file examples/domain-move-corrected.csv --base https://old.example.com
```

In the first map, `/services` points to `/new-services`, which then points to `https://new.example.com/services/`. In the corrected map, both old paths point directly to that final URL. The contact rule is unchanged.

Both maps have three rows and zero errors. The first has one chain finding and two external-target findings; the corrected map has three external-target findings and no chain. Both have three rows marked for review. Its default `errors` threshold permits review findings, so both commands exit with code 0. To require manual resolution of every review finding, use `--fail-on review`; both then exit with code 1. Cross-origin destinations are intentional in this domain move and should not be removed merely to produce a clear report. Review the destination host before approving them.

## Keep the trailing slash deliberate

The destination in this example ends in `/` because that is the fictional target's chosen URL. Use the actual final form served by your destination. A map checker cannot tell whether a server will add or remove a slash, perform another domain redirect, return a missing page or apply a higher-priority rule.

Keep each old path that still needs a redirect, replace intermediate destinations with the intended final page, and resolve competing destinations with the site owner. Avoid a blanket homepage destination when an equivalent page exists.

## Verify after installing the rules

On domains you control, test representative old URLs through the deployed rules and inspect each response's status and Location header through the final page. Include both slash variants, query strings and host variants that your migration must support. Check that the destination content exists and matches the old page's purpose. This CSV does not install rules or test server behavior, wildcard precedence, indexing or rankings.

For a visual structural review, [open the free browser audit](https://redirectatlas.com/app?utm_source=github&utm_medium=referral&utm_campaign=ci_checker&utm_content=readme). We operate RedirectAtlas at RTG Product Labs. Keep client maps and exported reports private.
