import { Readability } from "@mozilla/readability";

export interface Meta {
  title: string,
  description?: string,
  image?: {
    url: string,
    width?: string,
    height?: string
  },
}

const metaFromHTML = (doc: Document, url: string) => {
  addBaseElement(doc, url);
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

const addBaseElement = (doc: Document, url: string) => {
  let baseEl = doc.createElement('base'); // https://stackoverflow.com/questions/55232202/optional-baseuri-location-in-domparser
  baseEl.setAttribute('href', url);
  doc.head.append(baseEl);
}

const getFirstImage = (doc: Document, url: string) => {
  // If we don't have an image handed to us, take the first image in the body of the page
  const img = doc.querySelector('img');

  if (img) {
    var imgObj: { url: string, width?: string, height?: string } = { url: '' };

    const src = (img as HTMLImageElement).src;
    // The src might be relative, so we need to convert it to an absolute URL
    if (src && src.startsWith('http')) {
      imgObj.url = src;
    } else {
      imgObj.url = new URL(src, url).href;
    }

    // Set image width and height properties if respective attributes exist
    if ((img as HTMLImageElement).width) imgObj.width = (img as HTMLImageElement).width.toString();
    if ((img as HTMLImageElement).height) imgObj.height = (img as HTMLImageElement).height.toString();
    return imgObj;
  }
}

const readabilityParse = async (doc: Document) => {
  const reader = new Readability(doc)
  return reader.parse()
}

const mergeMeta = (tags: Meta, parsed?: any) => {
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



export const parseAndReply = async (doc: Document, url: string, res: (response?: any) => void) => {
  const meta = metaFromHTML(doc, url)
  const readability = await readabilityParse(doc)
  res(mergeMeta(meta, readability))
}