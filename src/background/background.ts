export const installedHandler = (object) => {
  let internalUrl = chrome.runtime.getURL("tabs/getting-started.html");

  if (object.reason === chrome.runtime.OnInstalledReason.INSTALL) {
    chrome.tabs.create({ url: internalUrl });
  }
};