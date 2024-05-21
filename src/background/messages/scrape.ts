import type { PlasmoMessaging } from "@plasmohq/messaging"
import * as cheerio from 'cheerio';

const handler: PlasmoMessaging.MessageHandler = async (req, res) => {
  try {
    const resp = await fetch(req.body.url)
    const html = await resp.text()
    const meta = parse(html)
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
const shorthandProperties = {
  "image": "image:url",
  "video": "video:url",
  "audio": "audio:url"
}

const keyBlacklist = [
  '__proto__',
  'constructor',
  'prototype'
]

const parse = (html: string): Meta => {
  // Subset of open-graph parser (https://github.com/samholmes/node-open-graph/blob/master/index.js)
  const $ = cheerio.load(html);
  // Check for xml namespace

  let namespace,
    $html = $('html');

  if ($html.length) {
    var attribKeys = Object.keys($html[0].attribs);

    attribKeys.some(function (attrName) {
      var attrValue = $html.attr(attrName);

      if (attrValue.toLowerCase() === 'http://opengraphprotocol.org/schema/'
        && attrName.substring(0, 6) == 'xmlns:') {
        namespace = attrName.substring(6);
        return false;
      }
    })
  }
  namespace = namespace || "og";

  var meta = {},
    metaTags = $('meta');

  metaTags.each(function () {
    var element = $(this),
      propertyAttr = element.attr('property');

    // If meta element isn't an "og:" property, skip it
    if (!propertyAttr || propertyAttr.substring(0, namespace.length) !== namespace)
      return;

    var property = propertyAttr.substring(namespace.length + 1),
      content = element.attr('content');

    // If property is a shorthand for a longer property,
    // Use the full property
    property = shorthandProperties[property] || property;


    var key, tmp,
      ptr = meta,
      keys = property.split(':', 4);

    // we want to leave one key to assign to so we always use references
    // as long as there's one key left, we're dealing with a sub-node and not a value

    while (keys.length > 1) {
      key = keys.shift();

      if (keyBlacklist.includes(key)) continue

      if (Array.isArray(ptr[key])) {
        // the last index of ptr[key] should become
        // the object we are examining.
        tmp = ptr[key].length - 1;
        ptr = ptr[key];
        key = tmp;
      }

      if (typeof ptr[key] === 'string') {
        // if it's a string, convert it
        ptr[key] = { '': ptr[key] };
      } else if (ptr[key] === undefined) {
        // create a new key
        ptr[key] = {};
      }

      // move our pointer to the next subnode
      ptr = ptr[key];
    }

    // deal with the last key
    key = keys.shift();

    if (ptr[key] === undefined) {
      ptr[key] = content;
    } else if (Array.isArray(ptr[key])) {
      ptr[key].push(content);
    } else {
      ptr[key] = [ptr[key], content];
    }
  });

  // Fallbacks for title and image
  if (!meta.hasOwnProperty('title')) {
    meta['title'] = $('title').text();
  }

  // TODO: could be an array of images instead
  if (!meta.hasOwnProperty('image')) {
    const img = $('img');

    if (img.length) {
      var imgObj = {} as {
        url: string,
        width?: string,
        height?: string
      };
      imgObj.url = $('img').attr('src');

      // Set image width and height properties if respective attributes exist
      if ($('img').attr('width'))
        imgObj.width = $('img').attr('width');
      if ($('img').attr('height'))
        imgObj.height = $('img').attr('height');

      meta['image'] = imgObj;
    }

  }

  return meta as Meta;

}


export default handler