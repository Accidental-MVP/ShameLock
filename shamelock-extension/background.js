import { generateShameRoast } from './gemini.js';

let blockedSites = [];

// Initialize blocked sites from storage and listen for changes
function initializeBlockedSites() {
  chrome.storage.local.get("blockedSites", (result) => {
    blockedSites = result.blockedSites || ["youtube.com", "twitter.com", "reddit.com"];
    console.log("Blocked sites initialized:", blockedSites);
  });
}

// Listen for changes to blocked sites
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local' && changes.blockedSites) {
    blockedSites = changes.blockedSites.newValue;
    console.log("Blocked sites updated:", blockedSites);
  }
});

// Initialize blocked sites on startup
initializeBlockedSites();

let timerInterval;
let lastShameTime = 0;
const SHAME_DEBOUNCE = 5000; // 5 seconds between shame logs

// Function to log failure to GitHub
async function logFailure(site, time) {
  console.log("Starting logFailure for", site, "at", time);
  
  const { githubToken, githubUsername } = await chrome.storage.local.get(["githubToken", "githubUsername"]);
  let GITHUB_USERNAME = githubUsername;
  const TOKEN = githubToken;
  const REPO_NAME = "shame-log";
  const date = new Date().toISOString().split("T")[0];
  const FILE_PATH = `failed_logs/FAIL_${date}.md`;
  const newEntry = `- ${time} – Visited ${site}\n`;
  const issueTitle = `Failed to focus: ${site} at ${time}`;
  
  console.log("Generating roast for issue...");
  const issueBody = await generateShameRoast(site, time);
  console.log("Generated roast:", issueBody);

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

  // Check if repo exists
  const repoRes = await fetch(`https://api.github.com/repos/${GITHUB_USERNAME}/${REPO_NAME}`, {
    headers: {
      Authorization: `token ${TOKEN}`,
      Accept: "application/vnd.github.v3+json"
    }
  });

  if (repoRes.status === 404) {
    // Create the repo with custom README
    const readmeResponse = await fetch(chrome.runtime.getURL('README_TEMPLATE.md'));
    const readmeContent = await readmeResponse.text();
    
    await fetch("https://api.github.com/user/repos", {
      method: "POST",
      headers: {
        Authorization: `token ${TOKEN}`,
        Accept: "application/vnd.github.v3+json"
      },
      body: JSON.stringify({
        name: REPO_NAME,
        description: "Autogenerated shame log",
        private: false,
        auto_init: false // Don't initialize with default README
      })
    });

    // Create README.md with our custom content
    await fetch(`https://api.github.com/repos/${GITHUB_USERNAME}/${REPO_NAME}/contents/README.md`, {
      method: "PUT",
      headers: {
        Authorization: `token ${TOKEN}`,
        Accept: "application/vnd.github.v3+json"
      },
      body: JSON.stringify({
        message: "docs: add detailed README",
        content: btoa(unescape(encodeURIComponent(readmeContent)))
      })
    });

    // Create failed_logs directory with .gitkeep
    await fetch(`https://api.github.com/repos/${GITHUB_USERNAME}/${REPO_NAME}/contents/failed_logs/.gitkeep`, {
      method: "PUT",
      headers: {
        Authorization: `token ${TOKEN}`,
        Accept: "application/vnd.github.v3+json"
      },
      body: JSON.stringify({
        message: "chore: initialize failed_logs directory",
        content: btoa(unescape(encodeURIComponent("Directory for daily shame logs")))
      })
    });
  } else if (repoRes.status !== 200) {
    console.error("Failed to check/create repo:", await repoRes.text());
    return;
  }

  // Step 1: Create a GitHub issue
  console.log("Creating GitHub issue with roast...");
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
    console.error("Failed to create issue:", await issueResponse.text());
    return;
  }

  const issueData = await issueResponse.json();
  console.log("Issue created:", issueData.html_url);

  // Step 2: Fetch existing log file or prepare to create it
  const fileRes = await fetch(`https://api.github.com/repos/${GITHUB_USERNAME}/${REPO_NAME}/contents/${FILE_PATH}`, {
    headers: {
      Authorization: `token ${TOKEN}`,
      Accept: "application/vnd.github.v3+json"
    }
  });

  let content = `# FAIL LOG – ${date}\n\n`;
  let sha = null;

  if (fileRes.status === 200) {
    const fileData = await fileRes.json();
    try {
      content = decodeURIComponent(escape(atob(fileData.content)));
      sha = fileData.sha;
    } catch (err) {
      console.error("Failed to decode existing log file:", err);
      return;
    }
  } else if (fileRes.status !== 404) {
    console.error("GitHub file fetch failed:", await fileRes.text());
    return;
  }

  const updatedContent = btoa(unescape(encodeURIComponent(content + newEntry)));

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

  // Notify popup about shame (if it's open)
  try {
    chrome.runtime.sendMessage({
      action: "shameLogged",
      site: site,
      time: time
    }, () => {
      if (chrome.runtime.lastError) {
        // Popup is closed, that's okay
      }
    });
  } catch (e) {
    // Popup is closed, that's okay
  }
}

// Message handling
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "startFocus") {
    const minutes = message.duration;
    const totalDuration = minutes * 60;
    const endTime = Date.now() + (totalDuration * 1000);
    
    // Store timer state
    chrome.storage.local.set({
      focusEndTime: endTime,
      totalDuration: totalDuration
    });
    
    // Clear any existing timer
    if (timerInterval) {
      clearInterval(timerInterval);
    }
    
    // Start new timer
    timerInterval = setInterval(async () => {
      const { focusEndTime } = await chrome.storage.local.get("focusEndTime");
      if (!focusEndTime) {
        clearInterval(timerInterval);
        return;
      }

      const now = Date.now();
      const timeLeft = Math.max(0, focusEndTime - now);
      
      // Update any open popups (if they exist)
      try {
        chrome.runtime.sendMessage({
          action: "timerUpdate",
          timeLeft: timeLeft
        }, () => {
          if (chrome.runtime.lastError) {
            // Popup is closed, that's okay
          }
        });
      } catch (e) {
        // Popup is closed, that's okay
      }
      
      if (timeLeft === 0) {
        clearInterval(timerInterval);
        chrome.storage.local.remove(["focusEndTime", "totalDuration"]);
        try {
          chrome.runtime.sendMessage({ action: "timerEnd" }, () => {
            if (chrome.runtime.lastError) {
              // Popup is closed, that's okay
            }
          });
        } catch (e) {
          // Popup is closed, that's okay
        }
      }
    }, 1000);
    
    // Create alarm for checking tabs
    chrome.alarms.create("shameCheck", { periodInMinutes: 0.2 });
    
    // Send initial timer state
    sendResponse({ success: true });
  }
  
  if (message.action === "stopFocus") {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    chrome.storage.local.remove(["focusEndTime", "totalDuration"]);
    chrome.alarms.clear("shameCheck");
    try {
      chrome.runtime.sendMessage({ action: "timerEnd" }, () => {
        if (chrome.runtime.lastError) {
          // Popup is closed, that's okay
        }
      });
    } catch (e) {
      // Popup is closed, that's okay
    }
    sendResponse({ success: true });
  }
  
  if (message.action === "getTimerState") {
    chrome.storage.local.get(["focusEndTime", "totalDuration"], (result) => {
      if (result.focusEndTime) {
        sendResponse({
          isRunning: true,
          timeLeft: Math.max(0, result.focusEndTime - Date.now()),
          totalDuration: result.totalDuration
        });
      } else {
        sendResponse({ isRunning: false });
      }
    });
    return true; // Keep the message channel open for async response
  }

  if (message.action === "updateBlockedSites") {
    blockedSites = message.sites;
    console.log("Blocked sites updated via message:", blockedSites);
    sendResponse({ success: true });
  }
});

// Function to inject shame message
async function injectShameMessage(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        // Remove any existing shame message
        const existingShame = document.getElementById('shamelock-shame');
        if (existingShame) {
          existingShame.remove();
        }

        // Create and inject the shame message
        const shameDiv = document.createElement('div');
        shameDiv.id = 'shamelock-shame';
        shameDiv.style.cssText = `
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          background: rgba(0, 0, 0, 0.95);
          color: #ff4444;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          font-size: 32px;
          text-align: center;
          z-index: 2147483647;
          padding: 20px;
          box-sizing: border-box;
          animation: fadeIn 0.3s ease-out;
        `;

        // Add keyframes for animation
        const style = document.createElement('style');
        style.textContent = `
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
        `;
        document.head.appendChild(style);

        shameDiv.innerHTML = `
          <h1 style="margin-bottom: 20px; font-size: 48px; text-shadow: 0 0 10px rgba(255, 68, 68, 0.5);">🚨 STOP WASTING TIME 🚨</h1>
          <p style="font-size: 24px; margin-bottom: 30px; color: #fff;">This site is blocked during your focus session.</p>
          <p style="font-size: 18px; color: #888;">Your shame has been logged to GitHub.</p>
        `;

        // Prevent scrolling and interaction with the page
        document.body.style.overflow = 'hidden';
        document.body.style.position = 'fixed';
        document.body.style.width = '100%';
        document.body.style.height = '100%';

        document.body.appendChild(shameDiv);

        // Play alarm sound
        const audio = new Audio(chrome.runtime.getURL('sounds/alarm.mp3'));
        audio.volume = 0.5;
        audio.play().catch(e => console.log("Could not play audio:", e));
      }
    });
  } catch (e) {
    console.error("Failed to inject shame message:", e);
  }
}

// Check a URL and log failure if it's bad
async function checkTab(url, tabId) {
  const { focusEndTime, lastShamePerTab = {} } = await chrome.storage.local.get([
    "focusEndTime",
    "lastShamePerTab"
  ]);
  if (!focusEndTime || Date.now() > focusEndTime) return;

  for (const site of blockedSites) {
    if (url.includes(site)) {
      const now = Date.now();
      const last = lastShamePerTab[tabId] || 0;

      const COOLDOWN = 5000; // 5 seconds per tab
      if (now - last < COOLDOWN) return; // already shamed recently

      // Save this tab's shame time
      lastShamePerTab[tabId] = now;
      await chrome.storage.local.set({ lastShamePerTab });

      const failTime = new Date().toLocaleTimeString();
      const siteName = site.split(".")[0];

      // Continue with full shame protocol
      await logFailure(siteName, failTime);

      // Inject shame message
      await injectShameMessage(tabId);

      // Notification
      chrome.notifications.create({
        type: "basic",
        iconUrl: chrome.runtime.getURL("icons/skull_lock_128.png"),
        title: "👿 Shame Detected",
        message: `You opened ${siteName}. Logging this disaster.`,
        priority: 2
      });

      break;
    }
  }
}

// Listen for completed page loads
chrome.webNavigation.onCompleted.addListener(({ tabId }) => {
  chrome.tabs.get(tabId, (tab) => {
    if (tab && tab.url) {
      checkTab(tab.url, tabId);
    }
  });
});

// Respond to alarms (runs in background even after popup dies)
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === "shameCheck") {
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      if (tab.url) {
        // Just check and block, don't log
        const { focusEndTime } = await chrome.storage.local.get("focusEndTime");
        if (!focusEndTime || Date.now() > focusEndTime) continue;

        for (const site of blockedSites) {
          if (tab.url.includes(site)) {
            // Inject full-screen shame message
            await injectShameMessage(tab.id);
            break;
          }
        }
      }
    }
  }
});
