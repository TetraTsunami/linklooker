const onInstalled = (object) => {
  let internalUrl = chrome.runtime.getURL("tabs/getting-started.html");
  
  if (object.reason === chrome.runtime.OnInstalledReason.INSTALL) {
      chrome.tabs.create({ url: internalUrl });
  }
}
const onClicked = () => {
  chrome.tabs.create({ url: chrome.runtime.getURL("tabs/getting-started.html") });
}

chrome.runtime.onInstalled.addListener(onInstalled);

if (chrome.action != undefined) {
  chrome.action.onClicked.addListener(onClicked);
} else {
  chrome.browserAction.onClicked.addListener(onClicked);
}