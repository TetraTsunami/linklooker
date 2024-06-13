import { Readability } from "@mozilla/readability";
import parseSiteSpecific from "./services";

export interface Meta {
  title: string,
  description?: string,
  imageUrl?: string
}

const parseHTMLMeta = (doc: Document, url: string) => {
  addBaseElement(doc, url);
  const title = (doc.querySelector('meta[property="og:title"]') as HTMLMetaElement)?.content ||
    doc.querySelector('title')?.textContent;
  const description = (doc.querySelector('meta[property="og:description"]') as HTMLMetaElement)?.content ||
    (doc.querySelector('meta[name="description"]') as HTMLMetaElement)?.content;
  let imageUrl = (doc.querySelector('meta[property="og:image"]') as HTMLMetaElement)?.content ||
      (doc.querySelector('meta[property="og:image:url"]') as HTMLMetaElement)?.content ||
      (doc.querySelector('img') as HTMLImageElement)?.src;
  if (!imageUrl.startsWith("http")) {
    imageUrl = new URL(imageUrl, url).href;
  }
  return {
    title,
    description,
    imageUrl
  } as Meta
}

const addBaseElement = (doc: Document, url: string) => {
  let baseEl = doc.createElement('base'); // https://stackoverflow.com/questions/55232202/optional-baseuri-location-in-domparser
  baseEl.setAttribute('href', url);
  doc.head.append(baseEl);
}

const parseReadability = async (doc: Document) => {
  const documentClone = doc.cloneNode(true);
  // @ts-ignore - Readability wants a document and we're giving it a node, but it doesn't actually matter
  return new Readability(documentClone).parse()
}

// Main entry point for parsing
export const parseAndReply = async (doc: Document, url: string, res: (response?: any) => void) => {
  const meta = parseHTMLMeta(doc, url)
  const readability = await parseReadability(doc)
  const siteSpecific = await parseSiteSpecific(doc, url)
  const data = {
    title: meta.title || readability?.title,
    description: meta.description || readability?.excerpt,
    imageUrl: meta.imageUrl,
    body: siteSpecific.body || readability?.textContent,
    siteName: readability?.siteName,
    ...siteSpecific
  }
  res(data)
}