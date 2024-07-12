import { DOMParser } from 'linkedom';
import { installedHandler } from './common';
import { addBaseElement, parseAndReply } from './parser';
import { resolveURL } from './services';

const scrapeHandler = async ({ url }, res: (response?: any) => void) => {
  try {
    let oldUrl = url
    let newUrl = ""
    let doc: Document
    while (oldUrl !== newUrl) {
      oldUrl = newUrl || oldUrl
      const resp = await fetch(oldUrl, { credentials: 'include' })
      const html = await resp.text()
      // @ts-expect-error - linkedom's document is FAKE and missing lots of properties, but we don't care because we don't use them :)
      doc = new DOMParser().parseFromString(html, 'text/html');
      addBaseElement(doc, url);
      newUrl = await resolveURL(doc, oldUrl) || oldUrl
    }
    await parseAndReply(doc, newUrl, res)
  } catch (err) {
    console.error(err)
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
    console.error(err)
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
    console.error(err)
    res({ error: err.message })
  }
  return true
}

chrome.runtime.onInstalled.addListener(installedHandler);
chrome.runtime.onMessage.addListener(messageHandler)