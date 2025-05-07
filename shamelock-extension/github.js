function encodeBase64Unicode(str) {
  return btoa(unescape(encodeURIComponent(str)));
}


export async function logFailure(site, time) {
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
  const issueBody = `Visited ${site} during focus session at ${time}.\nShame.`;

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
  await fetch(`https://api.github.com/repos/${GITHUB_USERNAME}/${REPO_NAME}/issues`, {
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
}