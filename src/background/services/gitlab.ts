import type { Parser } from "."

const GitlabParser: Parser = {
  matches: async (doc: Document, url: string) => {
    const siteName = doc.querySelector("meta[property='og:site_name']")?.getAttribute("content")
    return siteName === "GitLab"
  },
  rewrite: async (doc: Document, url: string) => {
    return url.replace("\/-\/.*","") // Link to homepage of repository
  }
}

export default GitlabParser