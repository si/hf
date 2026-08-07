# Repo notes for Claude

## Show notes workflow (House Finesse episodes)

- Episode posts live at `src/posts/<year>/<date>-hf<num>-with-<dj>.md`. Follow the front matter and section conventions of the most recent existing post for the same DJ/format.
- Cover art (`coverImage` front matter, e.g. `HFxxx_with_DJName.jpeg`) usually can't be added directly — artwork typically arrives as a pasted image in chat, not a file on disk. When that happens:
  - Push the post/branch and open the PR as normal, referencing the expected image filename in front matter. Default the extension to `.jpeg` — files exported/uploaded from Canva land as `.jpeg`, not `.jpg`, and Si can't rename the extension on upload.
  - Give Si a direct link to the GitHub "Upload files" web view for that branch/path, so he can drop the image in himself, e.g.:
    `https://github.com/si/hf/upload/<branch-name>/src/img/cover-images`
  - Once he confirms the upload, pull the branch and check the actual filename committed — update `coverImage` in the post's front matter to match exactly, don't assume the extension.

### Finding cover art in Canva

- All of a season's episode artwork lives in one Canva file named `HF<season> Artwork` (e.g. "HF26 Artwork") — not a separate file per episode. Find it with `search-designs` (query the season number, e.g. "HF26").
- Each week's episode is one page within that file, not a whole design. To find the right page for a given episode number:
  - Use `read-design` with `filter.fields: ["design_content"]` and narrow `filter.page_indices` (binary-search a few indices at a time — the full unfiltered dump is one giant blob without page boundaries, so it's unreliable for pinpointing a page).
  - Match on the episode number/date/DJ text baked into the page, e.g. `hf335`, `love sensation`, `335`.
- Once the page index is confirmed, export just that page: `export-design` with `format: {type: "jpg", pages: [<index>]}` — export as `jpg`, not `png`. Note the file Canva actually hands back (and what Si ends up uploading) is a `.jpeg`, so reference `coverImage: "....jpeg"` in front matter, not `.jpg`. The returned download URL is short-lived (single-digit hours) — get it to Si (or download it) promptly.
- The export URL is served from `export-download.canva.com`, which this session's sandboxed network egress does not allow direct `curl`/`Bash` access to (403 from the proxy). Don't try to route around it — hand Si the URL directly, or use the Canva MCP tools only.

## PR previews

- Netlify and Cloudflare Pages both auto-deploy a preview on every push to a PR and post/update a comment with the links — no need to construct these URLs manually, just read them off the latest bot comment on the PR.
  - Netlify preview pattern: `https://deploy-preview-<PR#>--housefinesse.netlify.app`
  - Cloudflare Pages branch preview pattern: `https://claude-<branch-name-slug>.house-finesse.pages.dev` (also a per-deploy preview URL with a random hash, which changes every push — the branch preview URL is the stable one to hand to Si)
- If subscribed to PR activity, these bot comments arrive as webhook events on every push — routine "processing"/"build in progress" updates need no action; only act once a deploy fails or is needed for something (e.g. confirming a fix actually resolved a rendering issue).
