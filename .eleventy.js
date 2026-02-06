// 11ty Plugins
const syntaxHighlight = require("@11ty/eleventy-plugin-syntaxhighlight");
const pluginRss = require("@11ty/eleventy-plugin-rss");
const eleventySass = require("@11tyrocks/eleventy-plugin-sass-lightningcss");
const eleventyGoogleFonts = require("eleventy-google-fonts");

// Helper packages
const slugify = require("slugify");
const markdownIt = require("markdown-it");
const markdownItAnchor = require("markdown-it-anchor");

const VIP_BANNER_DEFAULTS = {
  message:
    "Join the VIP Club for early access, high-quality downloads and private chats with the residents.",
  ctaText: "Join the VIP Club",
  ctaHref: "https://housefinesse.com/club",
};

const escapeHtml = (value = "") =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const escapeAttribute = (value = "") =>
  escapeHtml(value).replace(/"/g, "&quot;");

const vipBannerShortcode = (
  message = VIP_BANNER_DEFAULTS.message,
  ctaText = VIP_BANNER_DEFAULTS.ctaText,
  ctaHref = VIP_BANNER_DEFAULTS.ctaHref
) => {
  const safeMessage =
    typeof message === "string" && message.trim().length > 0
      ? escapeHtml(message)
      : escapeHtml(VIP_BANNER_DEFAULTS.message);

  const safeCtaText =
    typeof ctaText === "string" && ctaText.trim().length > 0
      ? escapeHtml(ctaText)
      : escapeHtml(VIP_BANNER_DEFAULTS.ctaText);

  const safeCtaHref =
    typeof ctaHref === "string" && ctaHref.trim().length > 0
      ? escapeAttribute(ctaHref)
      : escapeAttribute(VIP_BANNER_DEFAULTS.ctaHref);

  return `<aside class="vip-banner" aria-label="VIP Club promotion">
  <div class="vip-banner__inner">
    <p class="vip-banner__eyebrow">VIP Club</p>
    <p class="vip-banner__message">${safeMessage}</p>
    <a class="vip-banner__cta tdbc-button" href="${safeCtaHref}">${safeCtaText}</a>
  </div>
</aside>`;
};

module.exports = function (eleventyConfig) {
  eleventyConfig.addPlugin(syntaxHighlight);
  eleventyConfig.addPlugin(pluginRss);
  eleventyConfig.addPlugin(eleventySass);
  // Disable Google Fonts fetching when running in offline environments
  if (!process.env.ELEVENTY_OFFLINE) {
    eleventyConfig.addPlugin(eleventyGoogleFonts);
  }

  eleventyConfig.addPassthroughCopy("./src/fonts");
  eleventyConfig.addPassthroughCopy("./src/img");
  eleventyConfig.addPassthroughCopy("./src/favicon.png");
  eleventyConfig.addPassthroughCopy('./src/_redirects');

  eleventyConfig.addShortcode("year", () => `${new Date().getFullYear()}`);
  eleventyConfig.addShortcode("vipBanner", vipBannerShortcode);
  eleventyConfig.addNunjucksShortcode("vipBanner", vipBannerShortcode);
  eleventyConfig.addLiquidShortcode("vipBanner", vipBannerShortcode);

  // Add a simple slugify filter for templates
  eleventyConfig.addFilter('slugifyString', (value) =>
    slugify(value || '', { lower: true, strict: true, remove: /["']/g })
  );

  eleventyConfig.addFilter('categoryFilter', function(collection, category) {
    if (!category) return collection;
    const filtered = collection.filter(item => item.data.category == category)
    return filtered;
  });

  eleventyConfig.addFilter("formatDate", function (dateObj, format = "dd-LL-yyyy") {
    if (!dateObj) {
      return "";
    }

    const date = new Date(dateObj);

    if (Number.isNaN(date.getTime())) {
      return "";
    }

    const pad = (value) => String(value).padStart(2, "0");
    const tokens = {
      yyyy: String(date.getUTCFullYear()),
      LL: pad(date.getUTCMonth() + 1),
      dd: pad(date.getUTCDate()),
    };

    return format.replace(/yyyy|LL|dd/g, (token) => tokens[token] ?? token);
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

  eleventyConfig.addFilter('webcalUrl', function(url) {
    if (!url) return '';
    return url.replace(/^https?:\/\//, '');
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
