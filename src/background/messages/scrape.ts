import type { PlasmoMessaging } from "@plasmohq/messaging"
import * as cheerio from 'cheerio';

const handler: PlasmoMessaging.MessageHandler = async (req, res) => {
  try {
    const resp = await fetch(req.body.url)
    const html = await resp.text()
    const meta = parse(html, req.body.url)
    res.send({
      meta,
      html,
    })
  } catch (err) {
    res.send({ error: err.message })
  }
}

interface Meta {
  title: string,
  description?: string,
  image?: {
    url: string,
    width?: string,
    height?: string
  },
}

const parse = (html: string, url: string) => {
  const $ = cheerio.load(html);
  const title = $('meta[property="og:title"]').attr('content') || $('title').text();
  const description = $('meta[property="og:description"]').attr('content') || $('meta[name="description"]').attr('content');
  const ogImage ={
    url: $('meta[property="og:image"]').attr('content') || $('meta[property="og:image:url"]').attr('content'),
    width: $('meta[property="og:image:width"]').attr('content'),
    height: $('meta[property="og:image:height"]').attr('content')
  }
  const image = ogImage.url ? ogImage : (() => {
    // If we don't have an image handed to us, take the first image in the body of the page
    const img = $('img');

    if (img.length) {
      var imgObj = {} as {
        url: string,
        width?: string,
        height?: string
      };
      const src = img.attr('src');
      // The src might be relative, so we need to convert it to an absolute URL
      if (src && src.startsWith('http')) {
        imgObj.url = src;
      } else {
        imgObj.url = new URL(src, url).href;
      }

      // Set image width and height properties if respective attributes exist
      if (img.attr('width')) imgObj.width = img.attr('width');
      if (img.attr('height')) imgObj.height = img.attr('height');
      return imgObj;
    }
  })();
  return {
    title,
    description,
    image,
  } as Meta
}


export default handler