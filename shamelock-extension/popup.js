// Update UI elements
const statusEl = document.getElementById("status");
const timerEl = document.getElementById("timer");
const timerText = document.querySelector(".timer-text");
const progressRing = document.querySelector(".timer-ring .progress");
const minutesInput = document.getElementById("minutes");
const startButton = document.getElementById("start");
const stopButton = document.getElementById("stop");
const authButton = document.getElementById("auth");
const timerPresets = document.querySelectorAll(".timer-preset");

// Blocked Sites Management
const newSiteInput = document.getElementById("newSite");
const addSiteButton = document.getElementById("addSite");
const blockedSitesList = document.getElementById("blockedSitesList");

// Set up the progress ring
const circumference = 2 * Math.PI * 54; // 2πr where r=54
progressRing.style.strokeDasharray = `${circumference} ${circumference}`;
progressRing.style.strokeDashoffset = circumference;

// Store timer state
let currentTotalDuration = 0;

// Toast notification system
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  
  // Trigger animation
  setTimeout(() => toast.classList.add('show'), 100);
  
  // Remove after 3 seconds
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Check GitHub connection status on load
chrome.storage.local.get(['githubToken', 'githubUsername'], (result) => {
  if (result.githubToken && result.githubUsername) {
    updateConnectionStatus(true);
  } else {
    updateConnectionStatus(false);
    showToast('Please connect your GitHub account to start a focus session', 'warning');
  }
});

// Check timer state on popup open
chrome.runtime.sendMessage({ action: "getTimerState" }, (response) => {
  if (response && response.isRunning) {
    currentTotalDuration = response.totalDuration;
    updateTimerUI(response.timeLeft, response.totalDuration);
    startButton.style.display = 'none';
    stopButton.style.display = 'block';
    minutesInput.disabled = true;
    timerEl.classList.remove('hidden');
  }
});

function updateConnectionStatus(connected) {
  statusEl.textContent = connected ? "Connected to GitHub" : "Not connected to GitHub";
  statusEl.className = `status ${connected ? 'connected' : 'disconnected'}`;
  authButton.style.display = connected ? 'none' : 'block';
}

function formatTime(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function updateProgressRing(timeLeft, totalDuration) {
  const progress = timeLeft / (totalDuration * 1000);
  const offset = circumference * (1 - progress);
  progressRing.style.strokeDashoffset = offset;
}

function updateTimerUI(timeLeft, totalDuration) {
  if (!timerText || !progressRing) return;
  
  timerText.textContent = formatTime(timeLeft);
  const progress = timeLeft / (totalDuration * 1000);
  const offset = circumference * (1 - progress);
  progressRing.style.strokeDashoffset = offset;
}

// GitHub Authentication
authButton.addEventListener("click", () => {
  const authWindow = window.open(
    "https://shamelock-server.vercel.app/auth/github",
    "_blank",
    "width=500,height=600"
  );

  window.addEventListener("message", async (event) => {
    if (event.data?.token) {
      // First save the token
      await chrome.storage.local.set({ githubToken: event.data.token });
      
      // Then fetch the username using the token
      try {
        const response = await fetch("https://api.github.com/user", {
          headers: {
            Authorization: `token ${event.data.token}`,
            Accept: "application/vnd.github.v3+json"
          }
        });
        
        if (!response.ok) {
          throw new Error('Failed to fetch GitHub user');
        }
        
        const userData = await response.json();
        await chrome.storage.local.set({ githubUsername: userData.login });
        
        updateConnectionStatus(true);
        showToast('Successfully connected to GitHub!', 'success');
      } catch (error) {
        console.error('Error fetching GitHub username:', error);
        showToast('Failed to connect to GitHub. Please try again.', 'error');
      }
    }
  });
});

// Timer Preset Selection
timerPresets.forEach(preset => {
  preset.addEventListener("click", () => {
    // Remove active class from all presets
    timerPresets.forEach(p => p.classList.remove('active'));
    // Add active class to clicked preset
    preset.classList.add('active');
    // Set the input value
    minutesInput.value = preset.dataset.minutes;
  });
});

// Start Focus Session
startButton.addEventListener("click", async () => {
  // Check GitHub connection first
  const { githubToken, githubUsername } = await chrome.storage.local.get(['githubToken', 'githubUsername']);
  if (!githubToken || !githubUsername) {
    showToast('Please connect your GitHub account first', 'error');
    return;
  }

  const minutes = parseInt(minutesInput.value);
  
  if (isNaN(minutes) || minutes < 1 || minutes > 120) {
    showToast('Please enter a valid number of minutes (1-120)', 'error');
    return;
  }
  
  chrome.runtime.sendMessage({ action: "startFocus", duration: minutes }, (response) => {
    if (response && response.success) {
      currentTotalDuration = minutes * 60;
      startButton.style.display = 'none';
      stopButton.style.display = 'block';
      minutesInput.disabled = true;
      timerEl.classList.remove('hidden');
      
      // Disable all presets
      timerPresets.forEach(preset => {
        preset.classList.remove('active');
        preset.style.pointerEvents = 'none';
      });

      showToast(`Focus session started for ${minutes} minutes`, 'success');
    }
  });
});

// Stop Focus Session
stopButton.addEventListener("click", () => {
  chrome.runtime.sendMessage({ action: "stopFocus" }, (response) => {
    if (response && response.success) {
      currentTotalDuration = 0;
      timerEl.classList.add('hidden');
      startButton.style.display = 'block';
      stopButton.style.display = 'none';
      minutesInput.disabled = false;
      minutesInput.value = '';
      
      // Re-enable all presets
      timerPresets.forEach(preset => {
        preset.style.pointerEvents = 'auto';
      });

      showToast('Focus session ended', 'info');
    }
  });
});

// Listen for timer updates from background script
chrome.runtime.onMessage.addListener((message) => {
  if (message.action === "timerUpdate") {
    updateTimerUI(message.timeLeft, currentTotalDuration);
  } else if (message.action === "timerEnd") {
    currentTotalDuration = 0;
    timerEl.classList.add('hidden');
    startButton.style.display = 'block';
    stopButton.style.display = 'none';
    minutesInput.disabled = false;
    minutesInput.value = '';
    
    // Re-enable all presets
    timerPresets.forEach(preset => {
      preset.style.pointerEvents = 'auto';
    });

    showToast('Focus session completed! 🎉', 'success');
  } else if (message.action === "shameLogged") {
    showToast(`Shame logged: ${message.site} at ${message.time}`, 'error');
  }
});

// Load saved API key
chrome.storage.local.get("geminiApiKey", (result) => {
  console.log("Loading saved API key:", result);
  // Only set the input value if we have a non-empty key
  if (result.geminiApiKey && result.geminiApiKey.trim().length > 0) {
    document.getElementById("apiKey").value = result.geminiApiKey;
    console.log("API key loaded into input field");
  } else {
    console.log("No API key found in storage, using default key");
    // Clear any existing empty key
    chrome.storage.local.remove("geminiApiKey");
  }
});

// Save API key
document.getElementById("saveApiKey").addEventListener("click", () => {
  const apiKey = document.getElementById("apiKey").value.trim();
  console.log("Attempting to save API key:", apiKey ? "Key provided" : "No key");
  
  // Don't save if the key is empty or just whitespace
  if (!apiKey || apiKey.length === 0) {
    console.log("Empty key detected, removing any saved key");
    // Remove any existing key if user clears the input
    chrome.storage.local.remove("geminiApiKey", () => {
      const button = document.getElementById("saveApiKey");
      const originalText = button.textContent;
      button.textContent = "Using default key";
      button.style.backgroundColor = "#4CAF50";
      setTimeout(() => {
        button.textContent = originalText;
        button.style.backgroundColor = "";
      }, 2000);
    });
    return;
  }

  // Save the key and verify it was saved
  chrome.storage.local.set({ geminiApiKey: apiKey }, () => {
    console.log("API key saved, verifying...");
    
    // Verify the key was saved correctly
    chrome.storage.local.get("geminiApiKey", (result) => {
      console.log("Verification result:", result);
      
      const button = document.getElementById("saveApiKey");
      const originalText = button.textContent;
      
      if (result.geminiApiKey === apiKey) {
        button.textContent = "Saved!";
        button.style.backgroundColor = "#4CAF50";
        showToast("API key saved successfully!", "success");
      } else {
        button.textContent = "Save failed!";
        button.style.backgroundColor = "#ff6b6b";
        showToast("Failed to save API key!", "error");
      }
      
      setTimeout(() => {
        button.textContent = originalText;
        button.style.backgroundColor = "";
      }, 2000);
    });
  });
});

// Timer functionality
let timerInterval;
let endTime;

function updateTimer() {
  const now = Date.now();
  const timeLeft = Math.max(0, endTime - now);
  
  if (timeLeft === 0) {
    clearInterval(timerInterval);
    document.getElementById("timer").textContent = "00:00:00";
    return;
  }
  
  const hours = Math.floor(timeLeft / (1000 * 60 * 60));
  const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);
  
  document.getElementById("timer").textContent = 
    `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

// Check if timer is already running
chrome.runtime.sendMessage({ action: "getTimerState" }, (response) => {
  if (response.isRunning) {
    endTime = Date.now() + response.timeLeft;
    timerInterval = setInterval(updateTimer, 1000);
    updateTimer();
  }
});

// Load and display blocked sites
function loadBlockedSites() {
  chrome.storage.local.get("blockedSites", (result) => {
    const sites = result.blockedSites || ["youtube.com", "twitter.com", "reddit.com"];
    displayBlockedSites(sites);
  });
}

// Display blocked sites in the UI
function displayBlockedSites(sites) {
  blockedSitesList.innerHTML = '';
  sites.forEach(site => {
    const siteItem = document.createElement('div');
    siteItem.className = 'blocked-site-item';
    siteItem.innerHTML = `
      <span>${site}</span>
      <button class="remove-site" data-site="${site}">Remove</button>
    `;
    blockedSitesList.appendChild(siteItem);
  });

  // Add event listeners to remove buttons
  document.querySelectorAll('.remove-site').forEach(button => {
    button.addEventListener('click', (e) => {
      const siteToRemove = e.target.dataset.site;
      removeBlockedSite(siteToRemove);
    });
  });
}

// Add a new blocked site
function addBlockedSite(site) {
  site = site.toLowerCase().trim();
  
  // Basic validation
  if (!site) {
    showToast('Please enter a valid site', 'error');
    return;
  }

  // Remove www. and http(s):// if present
  site = site.replace(/^https?:\/\//, '').replace(/^www\./, '');

  chrome.storage.local.get("blockedSites", (result) => {
    const sites = result.blockedSites || ["youtube.com", "twitter.com", "reddit.com"];
    
    // Check if site is already blocked
    if (sites.includes(site)) {
      showToast('This site is already blocked', 'warning');
      return;
    }

    // Add new site
    sites.push(site);
    chrome.storage.local.set({ blockedSites: sites }, () => {
      displayBlockedSites(sites);
      showToast(`Added ${site} to blocked sites`, 'success');
      newSiteInput.value = '';
      
      // Notify background script about the change
      chrome.runtime.sendMessage({ 
        action: "updateBlockedSites", 
        sites: sites 
      });
    });
  });
}

// Remove a blocked site
function removeBlockedSite(site) {
  chrome.storage.local.get("blockedSites", (result) => {
    const sites = result.blockedSites || ["youtube.com", "twitter.com", "reddit.com"];
    const updatedSites = sites.filter(s => s !== site);
    
    chrome.storage.local.set({ blockedSites: updatedSites }, () => {
      displayBlockedSites(updatedSites);
      showToast(`Removed ${site} from blocked sites`, 'info');
      
      // Notify background script about the change
      chrome.runtime.sendMessage({ 
        action: "updateBlockedSites", 
        sites: updatedSites 
      });
    });
  });
}

// Event Listeners for blocked sites
addSiteButton.addEventListener('click', () => {
  addBlockedSite(newSiteInput.value);
});

newSiteInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    addBlockedSite(newSiteInput.value);
  }
});

// Load blocked sites when popup opens
loadBlockedSites();

// Collapsible sections
document.querySelectorAll('.section-header').forEach(header => {
  header.addEventListener('click', () => {
    const content = document.getElementById(`${header.dataset.section}-content`);
    header.classList.toggle('active');
    content.classList.toggle('active');
  });
});
