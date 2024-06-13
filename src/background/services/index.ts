import github from './github';
const parsers = [github];

export interface Parser {
  matches: (doc: Document, url: string) => Promise<boolean>,
  parse: (node: Node, url: string) => Promise<{ title?: string, description?: string, imageUrl?: string, body?: string, siteName?: string }>
}

const parseSiteSpecific = async (doc: Document, url: string) => {
  for (const parser of parsers) {
    try {
      if (await parser.matches(doc, url)) {
        const documentClone = doc.cloneNode(true);
        return await parser.parse(documentClone, url);
      }
    } catch (e) {
      console.error(e);
    }
  }
  return {};
}

export default parseSiteSpecific;