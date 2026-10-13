# Review a Wix-to-Shopify redirect map

An agency moving a shop needs to decide where each old page belongs before installing redirects. This fictional map contains a conflicting product destination, a two-page loop and an extra redirect hop. No customer URLs or files are used.

## Check an agency handover

Before sending a migration map to the person importing it, compare the broken and corrected fixtures. Use Node.js 20 or later. These commands clone the checker and run only fictional URLs:

```sh
git clone https://github.com/mattyjackie/redirectatlas-check.git
cd redirectatlas-check
node cli.mjs --file examples/wix-shopify-before.csv --base https://example.com
node cli.mjs --file examples/wix-shopify-corrected.csv --base https://example.com
```

The first checker command exits with code 1: six rows, four errors, one review and one clear row. Its finding counts are two conflicting-source findings, two loop findings and three chain findings. A row can have more than one finding; finding counts are not row totals. The corrected command exits with code 0: five rows, zero errors, zero review findings and five clear rows.

## Decide the destination, then fix the map

### Choose one product destination

Two rows send `/product-page/linen-shirt` to different pages. In this fictional shop, keep `/products/linen-shirt` and remove the competing collection rule.

### Break the article loop

The old paths `/post/care-guide` and `/journal/care-guide` redirect to each other. Send both directly to the corresponding new article `/blogs/journal/care-guide`.

### Remove the intermediate hop

The old tote path redirects through another old product path. Point both `/product-page/old-tote` and `/product-page/canvas-tote` directly to `/products/canvas-tote`.

The corrected CSV uses Shopify's `Redirect from,Redirect to` headers. Confirm that the intended products and article exist in your own store. A conflict needs an editorial decision; a checker cannot decide which page best serves the old visitor.

## Check client pull requests

Copy the corrected fixture to `redirects.csv` in a private client repository, then use the workflow in the [README](../README.md#check-every-pull-request). Keep `fail_on: errors` while reviewing warnings manually; choose `review` when every warning must be resolved before the handover. Set `base_url` to the source site's origin.

To review a local client file without changing it, run this from the checker folder. Replace the file path and origin with your own values:

```sh
node cli.mjs --file /path/to/redirects.csv --base https://source.example.com
```

The checker reports findings and exits; it does not edit or import the map. Resolve competing destinations with the client, rerun the same check, then hand over the reviewed CSV with a separate plan to test redirects after deployment. Avoid putting private URLs in public issues or reports.

## Try your own map

[Open the free browser audit](https://redirectatlas.com/app?utm_source=github&utm_medium=referral&utm_campaign=ci_checker&utm_content=readme) to inspect up to 1,000 rows without an account. For larger maps, this local checker supports up to 10,000 rows and 4,000,000 UTF-8 bytes, with no dependencies, network requests or telemetry. We operate RedirectAtlas at RTG Product Labs.

These checks inspect exact-map structure. They do not install redirects, certify Shopify import eligibility, fetch pages, check live status or content, evaluate CMS precedence or guarantee rankings. In Shopify, review current redirect restrictions and confirm the old path is eligible before import. After installing the rules, test old URLs, actual HTTP status and final destinations on a domain you control. A clear structural result is one step in that review.

See the [official Shopify URL redirect guidance](https://help.shopify.com/en/manual/online-store/menus-and-links/url-redirect) for current platform restrictions. Keep private maps in private repositories and keep any exported reports private.
