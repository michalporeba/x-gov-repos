import govukEleventyPlugin from '@x-govuk/govuk-eleventy-plugin'

export default function(eleventyConfig) {
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
    return collection.getFilteredByGlob("data/*.md");
  });

  return {
    dataTemplateEngine: 'njk',
    htmlTemplateEngine: 'njk',
    markdownTemplateEngine: 'njk',
    dir: {
      input: 'src',
      layouts: '../node_modules/@x-govuk/govuk-eleventy-plugin/layouts'
    }
  }
};
