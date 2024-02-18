"use strict";

const CACHE_PATH = "repo-cache";

import { Octokit } from "@octokit/rest";
import { mkdir, writeFile } from "fs/promises";
import path from 'path';

const octokit = new Octokit({
    auth: process.env.GITHUB_TOKEN,
});

const ensureFolderExists = async (path) => {
    try {
        await mkdir(path, { recursive: true });
    } catch (error) {
        console.error(`Error creating folder ${path}:`, error);
    }
};

const checkRateLimit = async () => {
    try {
        const response = await octokit.rest.rateLimit.get();
        const remaining = response.data.rate.remaining;
        const resetTime = new Date(response.data.rate.reset * 1000);

        console.log(`\nRemaining API calls: ${remaining}`);
        console.log(`Rate limit resets at: ${resetTime}`);

    } catch (error) {
        console.error("Error fetching rate limit information:", error);
    }
}

const getOrgRepositories = async (org) => {
    return await octokit.paginate(octokit.rest.repos.listForOrg, {
        org: org,
        type: "public",
        per_page: 100,
        headers: {
            "X-GitHub-Api-Version": "2022-11-28",
        },
    });
};

const getUserRepositories = async (user) => {
    return await octokit.paginate(octokit.rest.repos.listForUser, {
        username: user,
        type: "owner",
        per_page: 100,
        headers: {
            "X-GitHub-Api-Version": "2022-11-28",
        },
    });
};

const getRepositories = (type, account) => {
    try {
        let getter = (type === "org") ? getOrgRepositories : getUserRepositories;
        return getter(account);
    } catch (error) {
        console.error(`Error fetching repositories for ${type} ${account}!`, error);
    }
    return [];
}

const formatRepositoryDataFor = (account) => (repo) => {
    console.log(` - Repository ${account}/${repo.name}`);
    return {
        account: account,
        name: repo.name,
        url: repo.html_url,
        homepage: repo.homepage,
        owner: repo.owner.login,
        times: {
            created: repo.created_at,
            updated: repo.updated_at,
            pushed: repo.pushed_at,
        },
        properties: {
            isArchived: repo.archived,
            isDisabled: repo.disabled,
            isFork: repo.fork,
            isTemplate: repo.is_template,
            hasIssues: repo.has_issues,
            hasDownloads: repo.has_downloads,
            hasProjects: repo.has_projects,
            hasWiki: repo.has_wiki,
            hasPages: repo.has_pages,
            hasDiscussions: repo.has_discussions,
        },
        license: {
            name: repo.license ? repo.license.name : null,
            url: repo.license ? repo.license.url : null,
        },
        size: repo.size,
        counts: {
            forks: repo.forks_count,
            openIssues: repo.open_issues_count,
            stargazers: repo.stargazers_count,
            watchers: repo.watchers_count,
        },
        topLanguage: repo.language,
        topics: repo.topics,
        blobs: {
            description: repo.description,

        }
    };
}

const processAccount = async ({name, type, include}) => new Promise(async (res) => {
    let repositories = await getRepositories(type, name);
    let filteredRepositories = repositories.filter(r => !include || include.includes(r.name));
    console.log(`\nAccount ${name} has ${filteredRepositories.length} repositories`);

    res(filteredRepositories.map(formatRepositoryDataFor(name)));
});

const cacheRepository = async (repo) => new Promise(async (res, rej) => {
    try {
        let folder = path.join(CACHE_PATH, repo.account);
        await ensureFolderExists(folder);

        const data = JSON.stringify(repo, null, 2);

        let file = path.join(folder, `${repo.name}.json`);
        await writeFile(file, data);

        console.log(`Cached ${repo.account}/${repo.name} in ${file}`);
        res();
    } catch (err) {
        console.error(`Error caching ${repo.account}/${repo.name} to file:`, err);
        rej(err);
    }
});

const cacheRepositories = async (repositories) => {
    console.log("\nCaching repository data in local files...");
    await Promise.allSettled(repositories.map(cacheRepository));
}

console.log("\nStarting processing of github repos...");

await (async () => {
    // sample accounts just for early testing.
    // ultimately most of the accounts should come from the government.github.com
    // with extra additions of non-qualifying accounts. 
    let accounts = [
        { name: "uktrade", type: "org",
            include: [
                "data-workspace", "pg-bulk-ingest", "stream-zip", "stream-unzip",
                "mbtiles-s3-server", "cypress-image-diff", "mobius3", "data-flow"
            ]
        },
        { name: "michalporeba", type: "user",
            include: [
                "odis", "alps-py", "x-gov-repos", "static-data-publishing"
            ]
        }];

    let repositories = ((
        await Promise.allSettled(accounts.map(processAccount)))
        .map(({value}) => value)
        .flat()
    );
    await cacheRepositories(repositories);
})();

console.log("\nDone!");
await checkRateLimit();
console.log();