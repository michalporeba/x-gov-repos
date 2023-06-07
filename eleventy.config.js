const govukEleventyPlugin = require('@x-govuk/govuk-eleventy-plugin')

module.exports = function(eleventyConfig) {
  // Register the plugin
  eleventyConfig.addPlugin(govukEleventyPlugin)

  eleventyConfig.addCollection("entities", function(collection) {
    return collection.getFilteredByGlob("src/products/*.md");
  });

  eleventyConfig.addWatchTarget('../govuk-eleventy-plugin/components/')
  eleventyConfig.addWatchTarget('../govuk-eleventy-plugin/lib/')

  return {
    dataTemplateEngine: 'njk',
    htmlTemplateEngine: 'njk',
    markdownTemplateEngine: 'njk',
    dir: {
      // Use layouts from the plugin
      // layouts: 'node_modules/@x-govuk/govuk-eleventy-plugin/layouts'
      layouts: '../govuk-eleventy-plugin/layouts',
      includes: "../govuk-eleventy-plugin/components"
    }
  }
};