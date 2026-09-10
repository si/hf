const isEmbargoed = (data) => {
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
