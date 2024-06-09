import { DOMParser } from 'linkedom';
import { installedHandler } from './background';
import { parseAndReply } from './parsing';

const scrapeHandler = async ({ url }, res: (response?: any) => void) => {
  const resp = await fetch(url)
  const html = await resp.text();
  const doc = new DOMParser().parseFromString(html, 'text/html');
  // @ts-expect-error - linkedom's document is FAKE and missing lots of properties, but we don't care because we don't use them :)
  await parseAndReply(doc, url, res)
}

const parseHTMLHandler = async ({ html, url }, res: (response?: any) => void) => {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  // @ts-expect-error - see above
  await parseAndReply(doc, url, res)
}

const messageHandler = (req: any, sender, res: (response?: any) => void) => {
  if (req.target !== "background") {
    return false;
  }
  try {
    switch (req.name) {
      case "scrape":
        scrapeHandler(req, res)
        break;
      case "parseHTML":
        parseHTMLHandler(req, res)
        break;
      default:
        return;
    }
  } catch (err) {
    res({ error: err.message })
  }
  return true
}

chrome.runtime.onInstalled.addListener(installedHandler);
chrome.runtime.onMessage.addListener(messageHandler)