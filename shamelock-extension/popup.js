import { logFailure } from "./github.js";

document.getElementById("auth").addEventListener("click", () => {
  const authWindow = window.open("https://shamelock-server.vercel.app/auth/github", "_blank", "width=500,height=600");



  window.addEventListener("message", (event) => {
    if (event.data?.token) {
      chrome.storage.local.set({ githubToken: event.data.token }, () => {
        alert("Connected to GitHub! You are now officially roastable.");
      });
    }
  });
});

document.getElementById("start").addEventListener("click", () => {
  const minutes = parseInt(document.getElementById("minutes").value);
  chrome.runtime.sendMessage({ action: "startFocus", duration: minutes });
});
