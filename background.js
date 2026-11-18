// 1. Lift the block when the timer finishes
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === "focusTimer") {
    const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
    const ruleIds = existingRules.map(rule => rule.id);

    if (ruleIds.length > 0) {
      await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: ruleIds
      });
    }

    await chrome.storage.local.set({
      isBlocking: false,
      endTime: null
    });
  }
});

// 2. Enforce blocking on ALL tab updates (catches whole sites, cached pages, and /shorts)
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  const urlToCheck = changeInfo.url || tab.url;
  if (!urlToCheck || urlToCheck.startsWith("edge://") || urlToCheck.startsWith("about:")) return;

  const data = await chrome.storage.local.get(["isBlocking", "endTime", "blockedTargets"]);
  if (!data.isBlocking || data.endTime <= Date.now() || !data.blockedTargets) return;

  const currentUrl = urlToCheck.toLowerCase();
  const matchedTarget = data.blockedTargets.find(target => currentUrl.includes(target));

  if (matchedTarget) {
    // If the user blocked a specific path (like instagram.com/reels), bounce to the main site (instagram.com)
    // Unless the user ALSO blocked the whole domain (instagram.com), in which case block completely
    const baseDomain = matchedTarget.split("/")[0];
    const isWholeSiteBlocked = data.blockedTargets.includes(baseDomain);

    if (matchedTarget.includes("/") && !isWholeSiteBlocked) {
      chrome.tabs.update(tabId, { url: "https://" + baseDomain });
    } else {
      chrome.tabs.update(tabId, { url: "about:blank" });
    }
  }
});