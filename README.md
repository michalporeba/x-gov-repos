# x-gov-repos
An attempt at republishing data with eleventy

## Setup

```bash
npm init -y
npm install --save-dev @11ty/eleventy @x-govuk/govuk-eleventy-plugin
npx eleventy --serve
```

https://quinndombrowski.com/blog/2022/05/07/hosting-eleventy-on-github-pages/
https://www.rockyourcode.com/how-to-deploy-eleventy-to-github-pages-with-github-actions/


## Data Refresh

To refresh the data, set up `GITHUB_TOKEN` environment variable with your token and then

```bash
node get-data.js
```