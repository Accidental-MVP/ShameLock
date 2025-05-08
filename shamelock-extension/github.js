import { generateShameRoast } from "./gemini.js";


function encodeBase64Unicode(str) {
  return btoa(unescape(encodeURIComponent(str)));
}


export async function logFailure(site, time) {
  try {
    const { githubToken, githubUsername } = await new Promise((resolve) => {
      chrome.storage.local.get(["githubToken", "githubUsername"], (result) => resolve(result));
    });

    let GITHUB_USERNAME = githubUsername;
    const TOKEN = githubToken;
    const REPO_NAME = "shame-log";
    const FILE_PATH = "FAIL_LOG.md";
    const date = new Date().toISOString().split("T")[0];
    const newEntry = `- ${date} – Visited ${site} at ${time}\n`;
    const issueTitle = `Failed to focus: ${site} at ${time}`;
    
    console.log("Generating roast for issue...");
    const issueBody = await generateShameRoast(site, time);
    console.log("Roast generated:", issueBody);

    // If username isn't cached, fetch it now
    if (!GITHUB_USERNAME) {
      const userRes = await fetch("https://api.github.com/user", {
        headers: {
          Authorization: `token ${TOKEN}`,
          Accept: "application/vnd.github.v3+json"
        }
      });

      const userData = await userRes.json();
      GITHUB_USERNAME = userData.login;
      chrome.storage.local.set({ githubUsername: GITHUB_USERNAME });
    }

    // Step 1: Create a GitHub issue
    console.log("Creating GitHub issue...");
    const issueResponse = await fetch(`https://api.github.com/repos/${GITHUB_USERNAME}/${REPO_NAME}/issues`, {
      method: "POST",
      headers: {
        Authorization: `token ${TOKEN}`,
        Accept: "application/vnd.github.v3+json"
      },
      body: JSON.stringify({
        title: issueTitle,
        body: issueBody
      })
    });

    if (!issueResponse.ok) {
      const errorText = await issueResponse.text();
      console.error("Failed to create GitHub issue:", errorText);
      throw new Error(`Failed to create GitHub issue: ${errorText}`);
    }

    const issueData = await issueResponse.json();
    console.log("GitHub issue created:", issueData.html_url);

    // Step 2: Fetch FAIL_LOG.md or prepare to create it
    const fileRes = await fetch(`https://api.github.com/repos/${GITHUB_USERNAME}/${REPO_NAME}/contents/${FILE_PATH}`, {
      headers: {
        Authorization: `token ${TOKEN}`,
        Accept: "application/vnd.github.v3+json"
      }
    });

    let content = "# FAIL LOG\n\n";
    let sha = null;

    if (fileRes.status === 200) {
      const fileData = await fileRes.json();
      try {
        content = atob(fileData.content);
        sha = fileData.sha;
      } catch (err) {
        console.error("Failed to decode existing FAIL_LOG.md:", err);
        return;
      }
    } else if (fileRes.status !== 404) {
      console.error("GitHub file fetch failed:", await fileRes.text());
      return;
    }

    const updatedContent = encodeBase64Unicode(content + newEntry);

    await fetch(`https://api.github.com/repos/${GITHUB_USERNAME}/${REPO_NAME}/contents/${FILE_PATH}`, {
      method: "PUT",
      headers: {
        Authorization: `token ${TOKEN}`,
        Accept: "application/vnd.github.v3+json"
      },
      body: JSON.stringify({
        message: `log: failed focus on ${site}`,
        content: updatedContent,
        sha
      })
    });
  } catch (error) {
    console.error("Error in logFailure:", error);
    throw error;
  }
}