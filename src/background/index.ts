const onInstalled = (object) => {
  let internalUrl = chrome.runtime.getURL("tabs/getting-started.html");
  
  if (object.reason === chrome.runtime.OnInstalledReason.INSTALL) {
      chrome.tabs.create({ url: internalUrl });
  }
}
const onClicked = () => {
  chrome.tabs.create({ url: chrome.runtime.getURL("tabs/getting-started.html") });
}

if (process.env.PLASMO_BROWSER === "firefox") {
  browser.runtime.onInstalled.addListener(onInstalled)
  browser.action.onClicked.addListener(onClicked);
} else {
  chrome.runtime.onInstalled.addListener(onInstalled);
  chrome.action.onClicked.addListener(onClicked);
}