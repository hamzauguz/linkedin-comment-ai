chrome.runtime.onInstalled.addListener(() => {
  chrome.tabs.query({ url: ["*://*.linkedin.com/*"] }, (tabs) => {
    for (const tab of tabs) {
      if (tab.id) chrome.tabs.reload(tab.id);
    }
  });
});
