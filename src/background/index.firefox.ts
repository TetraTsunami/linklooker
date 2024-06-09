import { installedHandler } from "./background";
import { parseAndReply } from "./parsing";

const scrapeHandler = async ({ url }, res: (response?: any) => void) => {
  const resp = await fetch(url)
  const html = await resp.text();
  const doc = new DOMParser().parseFromString(html, "text/html")
  await parseAndReply(doc, url, res)
}

const parseHTMLHandler = async ({ html, url }, res: (response?: any) => void) => {
  const doc = new DOMParser().parseFromString(html, "text/html")
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
        res({ error: "Unknown request" })
    }
  } catch (err) {
    res({ error: err.message })
  }
  return true
}


// In MV2, we run inside a background page, so we get a DOM that we can manipulate.
browser.runtime.onInstalled.addListener(installedHandler)
browser.runtime.onMessage.addListener(messageHandler)