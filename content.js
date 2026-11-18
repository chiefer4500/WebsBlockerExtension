function enforceBlock() {
  chrome.storage.local.get(["isBlocking", "endTime", "blockedTargets", "blockedDomains"], (data) => {
    if (!data.isBlocking || !data.endTime || data.endTime <= Date.now()) {
      return;
    }

    // Support both variable names from earlier versions of popup.js
    const rawList = data.blockedTargets || data.blockedDomains || [];
    if (rawList.length === 0) return;

    const currentUrl = window.location.href.toLowerCase();

    const matchedTarget = rawList.find(item => {
      const cleanItem = item.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").trim();
      return cleanItem && currentUrl.includes(cleanItem);
    });

    if (matchedTarget) {
      window.stop();

      const cleanTarget = matchedTarget.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").trim();
      const baseDomain = cleanTarget.split("/")[0];
      const isWholeSiteBlocked = rawList.some(item => item.toLowerCase().includes(baseDomain) && !item.includes("/"));

      if (cleanTarget.includes("/") && !isWholeSiteBlocked) {
        window.location.replace("https://" + baseDomain);
      } else {
        document.documentElement.innerHTML = `
          <body style="background:#121212;color:#ffffff;font-family:system-ui,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;margin:0;">
            <h1 style="font-size:32px;margin-bottom:10px;">Blocked for Focus</h1>
            <p style="color:#aaaaaa;font-size:16px;">Timer active. Back to work!</p>
          </body>
        `;
      }
    }
  });
}

enforceBlock();
setInterval(enforceBlock, 500);