// 11ty Plugins
const syntaxHighlight = require("@11ty/eleventy-plugin-syntaxhighlight");
const pluginRss = require("@11ty/eleventy-plugin-rss");
const eleventySass = require("@11tyrocks/eleventy-plugin-sass-lightningcss");
const eleventyGoogleFonts = require("eleventy-google-fonts");

// Helper packages
const slugify = require("slugify");
const markdownIt = require("markdown-it");
const markdownItAnchor = require("markdown-it-anchor");

module.exports = function (eleventyConfig) {
  eleventyConfig.addPlugin(syntaxHighlight);
  eleventyConfig.addPlugin(pluginRss);
  eleventyConfig.addPlugin(eleventySass);
  eleventyConfig.addPlugin(eleventyGoogleFonts);

  eleventyConfig.addPassthroughCopy("./src/fonts");
  eleventyConfig.addPassthroughCopy("./src/img");
  eleventyConfig.addPassthroughCopy("./src/favicon.png");
  eleventyConfig.addPassthroughCopy('./src/_redirects');

  eleventyConfig.addShortcode("year", () => `${new Date().getFullYear()}`);

  // Add a simple slugify filter for templates
  eleventyConfig.addFilter('slugifyString', (value) =>
    slugify(value || '', { lower: true, strict: true, remove: /["']/g })
  );

  eleventyConfig.addFilter('categoryFilter', function(collection, category) {
    if (!category) return collection;
      const filtered = collection.filter(item => item.data.category == category)
      return filtered;
  });

  // ICS Calendar filters
  eleventyConfig.addFilter('dateToRfc3339', function(date) {
    return new Date(date).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  });

  eleventyConfig.addFilter('escapeIcs', function(str) {
    if (!str) return '';
    return str
      .replace(/\\/g, '\\\\')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t');
  });

  eleventyConfig.addFilter('stripHtml', function(str) {
    if (!str) return '';
    return str.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  });
  
  // Authors collection grouped by frontmatter `author`
  eleventyConfig.addCollection('authors', (collectionApi) => {
    const posts = collectionApi.getFilteredByTag('posts');
    const authorToPosts = new Map();

    for (const item of posts) {
      const authorName = item.data.author;
      if (!authorName) continue;
      const normalizedName = String(authorName).trim();
      const existingPosts = authorToPosts.get(normalizedName) || [];
      existingPosts.push(item);
      authorToPosts.set(normalizedName, existingPosts);
    }

    return Array.from(authorToPosts.entries())
      .map(([name, items]) => ({
        name,
        slug: slugify(name, { lower: true, strict: true, remove: /["']/g }),
        items,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  });
  
  /* Markdown Overrides */
  let markdownLibrary = markdownIt({
    html: true,
  }).use(markdownItAnchor, {
    permalink: markdownItAnchor.permalink.ariaHidden({
      class: "tdbc-anchor",
      space: false,
    }),
    level: [1, 2, 3],
    slugify: (str) =>
      slugify(str, {
        lower: true,
        strict: true,
        remove: /[""]/g,
      }),
  });
  eleventyConfig.setLibrary("md", markdownLibrary);

  return {
    dir: {
      input: "src",
      output: "public",
      layouts: "_layouts",
    },
  };
};
