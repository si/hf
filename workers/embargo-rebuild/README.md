# embargo-rebuild worker

Static builds only happen when something pushes to Cloudflare Pages, so a
post merged with a future `date` in its frontmatter (see
`src/posts/posts.11tydata.js`) stays unbuilt forever unless a rebuild
happens after that date passes. This Worker's only job is to trigger that
rebuild on a schedule.

## One-time setup

1. In the Cloudflare Pages project (`housefinesse`), go to
   **Settings -> Builds & deployments -> Deploy hooks** and create a hook,
   e.g. "Embargo rebuild", pointed at the production branch. Copy the URL.
2. From the repo root:
   ```
   cd workers/embargo-rebuild
   wrangler secret put PAGES_DEPLOY_HOOK_URL
   # paste the deploy hook URL when prompted
   wrangler deploy
   ```

The Worker fires hourly and POSTs to the deploy hook, which triggers a
fresh Pages build/deploy from the current head of the production branch -
picking up any post whose embargo date has since passed. No code change is
needed to adjust the cadence; edit `crons` in `wrangler.toml` and redeploy.
