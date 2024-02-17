"use strict";

// Importing the necessary modules
import { Octokit } from "@octokit/rest";
import Promise from "bluebird";
import { writeFile } from "fs/promises";

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const octokit = new Octokit({
    auth: process.env.GITHUB_TOKEN,
});

console.log("\nStarting processing of github repos...");

const getDataForOrg = async (org) => {
    return await octokit.rest.repos.listForOrg({
        org: org,
        type: "public",
        per_page: 2,
    });
};

const getDataForUser = async (user) => {
    return await octokit.rest.repos.listForUser({
        username: user,
        type: "owner",
        per_page: 2,
    });
};

const getData = (type) => {
    if (type === "org") { return getDataForOrg; }
    return getDataForUser;
}

const processAccount = async ({account: account, type: type}) => {
    console.log(`\nProcessing ${account}`);
    sleep(50);

    let data = await getData(type)(account);

    console.log(data);
};

await (async () => {
    let accounts = [
        { account: "uktrade", type: "org" },
        { account: "michalporeba", type: "user" }];

    await Promise.each(accounts, processAccount);
})();

console.log("\nDone!");