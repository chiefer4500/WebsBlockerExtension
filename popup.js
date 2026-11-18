const startBtn = document.getElementById("startBtn");
const sitesInput = document.getElementById("blockedSites");
const minutesInput = document.getElementById("minutes");
const statusDiv = document.getElementById("status");

let countdownInterval;

chrome.storage.local.get(["blockedTargets", "isBlocking", "endTime"], (data) => {
  if (data.blockedTargets) {
    sitesInput.value = data.blockedTargets.join("\n");
  }
  if (data.isBlocking && data.endTime > Date.now()) {
    lockUI(data.endTime);
  }
});

startBtn.addEventListener("click", async () => {
  // Clean up entries while keeping both whole domains and paths like /shorts
  const targets = sitesInput.value
    .split("\n")
    .map(d => d.trim().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/$/, "").toLowerCase())
    .filter(Boolean);

  const mins = parseInt(minutesInput.value, 10);

  if (targets.length === 0) {
    statusDiv.textContent = "Please enter at least one website or path.";
    return;
  }
  if (isNaN(mins) || mins < 1) {
    statusDiv.textContent = "Please enter a valid number of minutes.";
    return;
  }

  // Block all network requests matching any target (covers main pages, embedded frames, and API calls)
  const rules = targets.map((target, index) => ({
    id: index + 1,
    priority: 1,
    action: { type: "block" },
    condition: {
      urlFilter: `*${target}*`,
      resourceTypes: ["main_frame", "sub_frame", "xmlhttprequest"]
    }
  }));

  const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
  const oldIds = existingRules.map(r => r.id);

  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: oldIds,
    addRules: rules
  });

  // Immediately close/redirect any currently open tabs matching your list
  const openTabs = await chrome.tabs.query({});
  for (const tab of openTabs) {
    if (tab.url) {
      const urlLower = tab.url.toLowerCase();
      const matched = targets.find(t => urlLower.includes(t));
      if (matched) {
        const baseDomain = matched.split("/")[0];
        const isWholeSiteBlocked = targets.includes(baseDomain);
        const redirectUrl = (matched.includes("/") && !isWholeSiteBlocked)
          ? "https://" + baseDomain
          : "about:blank";
        chrome.tabs.update(tab.id, { url: redirectUrl });
      }
    }
  }

  const endTime = Date.now() + mins * 60 * 1000;
  await chrome.alarms.create("focusTimer", { delayInMinutes: mins });
  await chrome.storage.local.set({
    blockedTargets: targets,
    isBlocking: true,
    endTime: endTime
  });

  lockUI(endTime);
});

function lockUI(endTime) {
  sitesInput.disabled = true;
  minutesInput.disabled = true;
  startBtn.disabled = true;
  startBtn.textContent = "Focus Session Active";

  updateTimerDisplay(endTime);
  countdownInterval = setInterval(() => updateTimerDisplay(endTime), 1000);
}

function updateTimerDisplay(endTime) {
  const remainingMs = endTime - Date.now();
  if (remainingMs <= 0) {
    clearInterval(countdownInterval);
    sitesInput.disabled = false;
    minutesInput.disabled = false;
    startBtn.disabled = false;
    startBtn.textContent = "Start Focus Block";
    statusDiv.textContent = "Time's up! Sites unblocked.";
    return;
  }

  const totalSeconds = Math.floor(remainingMs / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  statusDiv.textContent = `Time remaining: ${m}m ${s < 10 ? "0" : ""}${s}s`;
}