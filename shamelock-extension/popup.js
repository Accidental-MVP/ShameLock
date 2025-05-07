document.getElementById('start').addEventListener('click', () => {
  const minutes = parseInt(document.getElementById('minutes').value);
  chrome.runtime.sendMessage({ action: "startFocus", duration: minutes });
});
