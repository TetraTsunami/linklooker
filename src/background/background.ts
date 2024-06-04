import type { Meta } from "./parsing";

export const installedHandler = (object) => {
  let internalUrl = chrome.runtime.getURL("tabs/getting-started.html");

  if (object.reason === chrome.runtime.OnInstalledReason.INSTALL) {
    chrome.tabs.create({ url: internalUrl });
  }
};

export const mergeMeta = (tags: Meta, parsed?: any) => {
  // There's some overlap, so we'll return a merged object with only the keys we need
  if (!parsed) {
    return {
      title: tags.title,
      description: tags.description,
      image: tags.image,
      body: "",
      siteName: "",
    };
  }
  return {
    title: tags.title || parsed.title,
    description: tags.description || parsed.excerpt,
    image: tags.image,
    body: parsed.textContent || "",
    siteName: parsed.siteName || "",
  };
};

