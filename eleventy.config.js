const govukEleventyPlugin = require('@x-govuk/govuk-eleventy-plugin')
//const govukEleventyPlugin = require('../govuk-eleventy-plugin')

module.exports = function(eleventyConfig) {
  // Register the plugin
  eleventyConfig.addPlugin(govukEleventyPlugin, {
    header: {
      logotype: { text: "Digital Collective" },
      productName: 'Gov Releated Repos',
      search: {
        indexPath: '/search.json',
        label: 'search in the data'
      }
    },
    footer: {
      copyright: {
        text: 'Digital Collective'
      }
    }
  });

  eleventyConfig.addCollection("entities", function(collection) {
    return collection.getFilteredByGlob("src/products/*.md");
  });

  return {
    dataTemplateEngine: 'njk',
    htmlTemplateEngine: 'njk',
    markdownTemplateEngine: 'njk',
    dir: {
      // Use layouts from the plugin
      layouts: 'node_modules/@x-govuk/govuk-eleventy-plugin/layouts'
      //layouts: '../govuk-eleventy-plugin/layouts'
    }
  }
};
