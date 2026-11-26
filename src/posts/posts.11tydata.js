// Cloudflare Pages preview builds (any branch other than production) show
// future-dated posts, so an upcoming episode can be checked on its PR preview.
// CF_PAGES_BRANCH is set by Cloudflare on every Pages build; it's unset for
// local builds, so those keep the embargo unless SHOW_FUTURE_POSTS=1.
const PRODUCTION_BRANCH = "main";
const isPreviewBuild =
  process.env.SHOW_FUTURE_POSTS === "1" ||
  (Boolean(process.env.CF_PAGES_BRANCH) &&
    process.env.CF_PAGES_BRANCH !== PRODUCTION_BRANCH);

const isEmbargoed = (data) => {
  if (isPreviewBuild) return false;
  const postDate = new Date(data.date);
  return !Number.isNaN(postDate.getTime()) && postDate.getTime() > Date.now();
};

module.exports = {
  tags: "posts",
  layout: "post",
  eleventyComputed: {
    // Embargo: a post dated in the future is excluded from output entirely
    // (permalink false, so no page is written) and from every collection
    // (eleventyExcludeFromCollections, so it can't be listed/linked from
    // the homepage, /shows/, RSS, etc. with a dead url) until a build runs
    // after its frontmatter `date` has passed. Merging early is safe -
    // nothing publishes until the embargo date, and a scheduled rebuild is
    // what actually crosses that date on a static host (see
    // workers/embargo-rebuild).
    permalink: (data) =>
      isEmbargoed(data) ? false : "/{{ categories | slugify }}/{{ page.fileSlug }}/",
    eleventyExcludeFromCollections: (data) => isEmbargoed(data),
  },
};
