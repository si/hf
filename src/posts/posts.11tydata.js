module.exports = {
  tags: "posts",
  layout: "post",
  eleventyComputed: {
    // Embargo: a post dated in the future is excluded from output entirely
    // (and therefore from collections/RSS too) until a build runs after
    // its frontmatter `date` has passed. Merging early is safe - nothing
    // publishes until the embargo date, and a scheduled rebuild is what
    // actually crosses that date on a static host (see workers/embargo-rebuild).
    permalink: (data) => {
      const postDate = new Date(data.date);
      if (!Number.isNaN(postDate.getTime()) && postDate.getTime() > Date.now()) {
        return false;
      }
      return "/{{ categories | slugify }}/{{ page.fileSlug }}/";
    },
  },
};
