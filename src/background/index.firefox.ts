import { installedHandler } from "./common";
import { parseAndReply } from "./parser";
import { resolveURL } from "./services";

const scrapeHandler = async ({ url }, res: (response?: any) => void) => {
  try {
    let oldUrl = url
    let newUrl = ""
    let doc: Document
    while (oldUrl !== newUrl) {
      oldUrl = newUrl || oldUrl
      const resp = await fetch(oldUrl)
      const html = await resp.text()
      doc = new DOMParser().parseFromString(html, "text/html")
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
    const newUrl = await resolveURL(doc, url)
    if (newUrl) {
      await scrapeHandler({ url: newUrl }, res)
    } else {
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
        res({ error: "Unknown request" })
    }
  } catch (err) {
    console.error(err)
    res({ error: err.message })
  }
  return true
}


// In MV2, we run inside a background page, so we get a DOM that we can manipulate.
browser.runtime.onInstalled.addListener(installedHandler)
browser.runtime.onMessage.addListener(messageHandler)