# x-gov-repos

The repository currently has two purposes.
* Develop a simple way to publish small and medium-sized datasets in a way which is readable for humans and computers alike and doesn't require services or service teams.
* Improve on [previous work](https://github.com/uk-x-gov-software-community/xgov-opensource-repo-scraper)
to publish information about public code repositories.

## Publishing public code repositories

Under the [GDS Service Standard](https://www.gov.uk/service-manual/service-standard),
[point 12](https://www.gov.uk/service-manual/service-standard/point-12-make-new-source-code-open), the code paid for by public money
should be made available for people to reuse and build on.

The [GitHub's government community page](https://government.github.com/community/)
lists hundreds of organisational GitHub accounts which belong to governments or public bodies.
Over a hundred of them are owned by UK Civil Service or Local Authority organisations.
They contain at least 17,000 public source code repositories! And this is not all.
There are many more accounts that don't qualify for GitHub's government community inclusion, but which, nonetheless, contain code paid by public money.

With so much public code, there appears to be very little reuse.
Perhaps it is because it is difficult to list and review all the existing code.
The [xgov-opensource-repo-scraper](https://github.com/uk-x-gov-software-community/xgov-opensource-repo-scraper) helps, but it could be improved.

## Publishing data using static pages

Why not contribute to the existing project?

Eventually, this might be the best move.
However, there are many public datasets that could be created.
One potential reason they don't exist might be the GDS Service Standard.
It requires data to be published with APIs in specific formats, and this often means developing a service.

I think it would be better if we had a simple way to publish small and medium-sized datasets as static pages.

Of course, this is possible right now. Any JSON or CSV file can be hosted on GitHub and made available, but that information is not accessible to humans and not following the guidance for data published for computers.

I think we can do better, and so, at the moment, publishing government repositories is mostly just an excuse to work on static page data publishing.

&nbsp;
# This project

There are multiple elements of this project. Ideally, all should be achieved from a single easy-to-edit data file, like CSV, or perhaps from a collection of such files.

## Publishing data with the Design System

I would like to find a way to publish public datasets easily using the [Design System](https://design-system.service.gov.uk/) and perhaps other user-first design systems.
For this purpose, I have chosen [Eleventy](https://www.11ty.dev/), mostly because of the [ukgov-eleventy-plugin](https://github.com/x-govuk/govuk-eleventy-plugin) provides good support for the latest [GOV.UK Frontend](https://github.com/alphagov/govuk-frontend/releases/tag/v5.1.0).

## Publishing with static APIs

There is [an expectation](https://www.gov.uk/guidance/gds-api-technical-and-data-standards) that the data is published using APIs to help with its reuse. Can a static API be generated like a static HTML page?

## Publishing linked data of public repositories

I would like to publish data as [linked data](https://en.wikipedia.org/wiki/Linked_data), from the same source file.
A number of formats should be supported, including the [CSVW](https://csvw.org/), as this is the official standard recommended by the Civil Service for publishing data.

This will require designing a suitable linked data schema.

## Collecting the repository data

Finally, to have something to publish, even as a proof of concept, we need the data.
The xgov-opensource-repo-scraper has a subset of what I think would be interesting.
I tried extending it, but the [octokat.js library](https://github.com/philschatz/octokat.js) it uses, appears really old and has problems with accessing many newer features of [GitHub API](https://docs.github.com/en/rest).
The [octokit.js](https://github.com/octokit/octokit.js) appears to be the way forward.

The collection of stats about a group of repositories and converting that information into static data might be useful on its own. Perhaps this could turn into a standalone library.

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