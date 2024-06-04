export interface Meta {
  title: string,
  description?: string,
  image?: {
    url: string,
    width?: string,
    height?: string
  },
}

export const getFirstImage = (doc: Document, url: string) => {
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