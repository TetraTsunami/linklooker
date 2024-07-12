import github from './github';
import gitlab from './gitlab';

const parsers = [github, gitlab];

export interface Parser {
  matches: (doc: Document, url: string) => Promise<boolean>,
  rewrite?: (doc: Document, url: string) => Promise<string>,
  parse?: (doc: Document, url: string) => Promise<{ title?: string, description?: string, imageUrl?: string, body?: string, siteName?: string }>
}

export const resolveURL = async (doc: Document, url: string) => {
  for (const parser of parsers) {
    try {
      if (await parser.matches(doc, url) && parser.rewrite) {
        return await parser.rewrite(doc, url);
      }
    } catch (e) {
      console.error(e);
    }
  }
  return "";
}

export const doCustomParse = async (doc: Document, url: string) => {
  for (const parser of parsers) {
    try {
      if (await parser.matches(doc, url) && parser.parse) {
        const documentClone = doc.cloneNode(true) as Document;
        return await parser.parse(documentClone, url);
      }
    } catch (e) {
      console.error(e);
    }
  }
  return {};
}