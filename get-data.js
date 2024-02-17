"use strict";

// Importing the necessary modules
import { Octokit } from "@octokit/rest";
import Promise from "bluebird";
import { writeFile } from "fs/promises";

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const octokit = new Octokit({
    auth: process.env.GITHUB_TOKEN,
});


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

const getDataForOrg = async (org) => {
    return await octokit.paginate(octokit.rest.repos.listForOrg, {
        org: org,
        type: "public",
        per_page: 100,
        headers: {
            "X-GitHub-Api-Version": "2022-11-28",
        },
    });
};

const getDataForUser = async (user) => {
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
        let getter = (type === "org") ? getDataForOrg : getDataForUser;
        return getter(account);
        myVar.people = myVar.people.filter( x => x.id === "192");
    } catch (error) {
        console.error(`Error fetching repositories for ${type} ${account}!`, error);
    }
    return [];
}

const processAccount = async ({name, type, include}) => {
    console.log(`\nProcessing ${name}`);
    sleep(50);

    let repositories = await getRepositories(type, name);
    let filteredRepositories = repositories.filter(r => !include || include.includes(r.name));
    console.log(`${name} has ${filteredRepositories.length} repositories.`);

    //console.log(repositories);
};

console.log("\nStarting processing of github repos...");

await (async () => {
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

    await Promise.each(accounts, processAccount);
})();

console.log("\nDone!");
await checkRateLimit();