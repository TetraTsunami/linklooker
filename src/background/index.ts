const onInstalled = (object) => {
  let internalUrl = chrome.runtime.getURL("tabs/getting-started.html");
  
  if (object.reason === chrome.runtime.OnInstalledReason.INSTALL) {
      chrome.tabs.create({ url: internalUrl });
  }
}

if (process.env.PLASMO_BROWSER === "firefox") {
  // @ts-ignore
  browser.runtime.onInstalled.addListener(onInstalled)
} else {
  chrome.runtime.onInstalled.addListener(onInstalled);
}