import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';
import { getFirstImage, type Meta } from "./parsing";
import { installedHandler, mergeMeta } from './background';


const metaFromHTML = (html: string, url: string) => {
  const doc = (new JSDOM(html)).window.document
  let baseEl = doc.createElement('base'); // https://stackoverflow.com/questions/55232202/optional-baseuri-location-in-domparser
  baseEl.setAttribute('href', url);
  doc.head.append(baseEl);
  const title = (doc.querySelector('meta[property="og:title"]') as HTMLMetaElement)?.content ||
    doc.querySelector('title')?.textContent;
  const description = (doc.querySelector('meta[property="og:description"]') as HTMLMetaElement)?.content ||
    (doc.querySelector('meta[name="description"]') as HTMLMetaElement)?.content;
  const ogImage = {
    url: (doc.querySelector('meta[property="og:image"]') as HTMLMetaElement)?.content ||
      (doc.querySelector('meta[property="og:image:url"]') as HTMLMetaElement)?.content,
    width: (doc.querySelector('meta[property="og:image:width"]') as HTMLMetaElement)?.content,
    height: (doc.querySelector('meta[property="og:image:height"]') as HTMLMetaElement)?.content
  }
  const image = ogImage.url ? ogImage : getFirstImage(doc, url);
  return {
    title,
    description,
    image,
  } as Meta
}

const readabilityParse = async (html: string) => {
  const document = (new JSDOM(html)).window.document
  const reader = new Readability(document)
  return reader.parse()
}

const scrapeHandler = async ({ url }, res: (response?: any) => void) => {
  const resp = await fetch(url)
  const html = await resp.text();
  const meta = metaFromHTML(html, url)
  const readability = await readabilityParse(html)
  res({
    meta: mergeMeta(meta, readability),
    html,
  })
}

const parseHTMLHandler = async ({ html, url }, res: (response?: any) => void) => {
  const meta = metaFromHTML(html, url)
  const readability = await readabilityParse(html)
  res({
    meta: mergeMeta(meta, readability),
    html,
  })
}

const messageHandler = (req: any, sender, res: (response?: any) => void) => {
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