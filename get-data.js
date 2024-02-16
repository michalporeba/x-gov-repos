"use strict";

import Octokat from 'octokat';
import Promise from "bluebird";
import { writeFileSync } from 'fs';

const sleep = ms => new Promise(r => setTimeout(r, ms));

const processRepoFor = (org) => async (repo) => {
    console.log(`Processing ${repo.name}`);
    //console.log('Stats');
    //let stats = repo.stats;
    //console.log(await stats.contributors.fetch());
    //console.log(await stats.commitActivity.fetch());
    // console.log();
    // console.log('Issues');
    // console.log(repo.issues);
    // console.log("labels");
    // console.log(await repo.issues.labels);
    // console.log(await repo.issues);
    console.log('languages');
    console.log(await repo.languages.fetch());
    return {
        org: org,
        name: repo.name,
        url: repo.htmlUrl,
        homepage: repo.homepage,
        owner: repo.owner.login,
        created: repo.createdAt,
        pushed: repo.pushedAt,
        isArchived: repo.archived,
        isFork: repo.fork,
        license: repo.license,
        size: repo.size,
        counts: {
            forks: repo.forksCount,
            openIssues: repo.openIssuesCount,
            stargazers: repo.stargazersCount,
            watchers: repo.watchersCount,
        },
        openIssues: repo.openIssues,
        watchers: repo.watchers,
        language: repo.language
    }
}

const octo = new Octokat({
    acceptHeader: 'application/vnd.github.cannonball-preview+json',
    token: process.env.GITHUB_TOKEN,
});

console.log("Starting");
console.log(process.env.GITHUB_TOKEN);
console.log("");

let org = "uktrade";
let response = await octo.orgs(org).repos.fetch({ per_page: 2 });
sleep(50);

let allRepos = await Promise.mapSeries(response.items, processRepoFor(org));
console.log('all repos');
console.log(allRepos);
console.log('');
console.log('done');


// const formatResult = (result) => {
//   return {
//     owner: result.owner.login,
//     name: result.name,
//     url: result.html.url,
//     archived: result.archived,
//     license: result.license,
//     stargazersCount: result.stargazersCount,
//     // watchersCount: result.watchersCount, // github api appears to be returning the same as the stargazersCount?!
//     language: result.language,
//     forksCount: result.forksCount,
//     openIssuesCount: result.openIssuesCount,
//   };
// };

// const fetchAll = async (org, args) => {
//   let response = await octo.orgs(org).repos.fetch({ per_page: 100 });
//   let aggregate = [response];

//   console.log(`fetched page 1 for ${org}`);
//   let i = 1;
//   await Promise.delay(50); //slow down to appease github rate limiting
//   while (response.nextPage) {
//     i++;
//     response = await response.nextPage();
//     console.log(`fetched page ${i} for ${org}`);
//     await Promise.delay(50); //slow down to appease github rate limiting
//     aggregate.push(response);
//   }
//   return aggregate;
// };

// const allDepartments = yaml.safeLoad(
//   await (
//     await fetch(
//       "https://raw.githubusercontent.com/github/government.github.com/gh-pages/_data/governments.yml"
//     )
//   ).text()
// );

// const UKDepartments = [].concat(
//   allDepartments["U.K. Councils"],
//   allDepartments["U.K. Central"]
// );

// const allReposForAllUKDepartments = await Promise.mapSeries(
//   UKDepartments,
//   fetchAll
// );

// const formattedResults = allReposForAllUKDepartments.flat(2).map(formatResult);
