import { DOMParser } from 'linkedom';
import { installedHandler } from './background';
import { parseAndReply } from './parsing';
import { resolveURL } from './services';

const scrapeHandler = async ({ url }, res: (response?: any) => void) => {
  let oldUrl = url
  let newUrl = ""
  try {
    let doc: Document
    while (oldUrl !== newUrl) {
      oldUrl = newUrl
      const resp = await fetch(oldUrl)
      const html = await resp.text()
      // @ts-expect-error - linkedom's document is FAKE and missing lots of properties, but we don't care because we don't use them :)
      doc = new DOMParser().parseFromString(html, 'text/html');
      newUrl = await resolveURL(doc, oldUrl) || oldUrl
    }
    await parseAndReply(doc, newUrl, res)
  } catch (err) {
    res({ error: err.message })
  }
}

const parseHTMLHandler = async ({ html, url }, res: (response?: any) => void) => {
  try {
    const doc = new DOMParser().parseFromString(html, "text/html")
    // @ts-expect-error - see above
    const newUrl = await resolveURL(doc, url)
    if (newUrl) {
      await scrapeHandler({ url: newUrl }, res)
    } else {
      // @ts-expect-error - see above
      await parseAndReply(doc, url, res)
    }
  } catch (err) {
    res({ error: err.message })
  }
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