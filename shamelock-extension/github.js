export async function logFailure(site, time) {
  const TOKEN = await new Promise((resolve) => {
    chrome.storage.local.get("githubToken", (result) => resolve(result.githubToken));
  });

  const GITHUB_USERNAME = "your-username"; // Replace with your GitHub username
  const REPO_NAME = "shame-log";
  const date = new Date().toISOString().split('T')[0];
  const issueTitle = `Failed to focus: ${site} at ${time}`;
  const issueBody = `Visited ${site} during focus session at ${time}.\nShame.`;

  // Create GitHub Issue
  await fetch(`https://api.github.com/repos/${GITHUB_USERNAME}/${REPO_NAME}/issues`, {
    method: "POST",
    headers: {
      Authorization: `token ${TOKEN}`,
      Accept: "application/vnd.github.v3+json"
    },
    body: JSON.stringify({ title: issueTitle, body: issueBody })
  });

  // Update FAIL_LOG.md
  const path = "FAIL_LOG.md";
  const fileRes = await fetch(`https://api.github.com/repos/${GITHUB_USERNAME}/${REPO_NAME}/contents/${path}`, {
    headers: {
      Authorization: `token ${TOKEN}`,
      Accept: "application/vnd.github.v3+json"
    }
  });

  const fileData = await fileRes.json();
  const content = atob(fileData.content);
  const sha = fileData.sha;
  const newEntry = `- ${date} – Visited ${site} at ${time}\n`;
  const updatedContent = btoa(content + newEntry);

  await fetch(`https://api.github.com/repos/${GITHUB_USERNAME}/${REPO_NAME}/contents/${path}`, {
    method: "PUT",
    headers: {
      Authorization: `token ${TOKEN}`,
      Accept: "application/vnd.github.v3+json"
    },
    body: JSON.stringify({
      message: `log: failed focus on ${site}`,
      content: updatedContent,
      sha: sha
    })
  });
}