import { logFailure } from "./github.js";

let focusEndTime = null;
const blockedSites = ["youtube.com", "twitter.com", "reddit.com"];

chrome.runtime.onMessage.addListener((request) => {
  if (request.action === "startFocus") {
    const now = Date.now();
    focusEndTime = now + request.duration * 60 * 1000;
    chrome.storage.local.set({ focusEndTime });
  }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (!tab.url || !focusEndTime) return;

  chrome.storage.local.get("focusEndTime", async ({ focusEndTime }) => {
    if (Date.now() < focusEndTime) {
      for (const site of blockedSites) {
        if (tab.url.includes(site)) {
          const failTime = new Date().toLocaleTimeString();
          const siteName = site.split(".")[0];
          await logFailure(siteName, failTime);
        }
      }
    }
  });
});