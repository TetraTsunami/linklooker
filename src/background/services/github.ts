import type { Parser } from "."

const GithubParser: Parser = {
  matches: async (doc: Document, url: string) => {
    const regex = "^https://github.com/*"
    if (!url.match(regex)) return false
    const path = new URL(url).pathname.split("/") // ["", "user", "repo", ...]
    return path.length >= 3
  },
  parse: async (node: Node, url: string) => {
    const path = new URL(url).pathname.split("/") // ["", "user", "repo", ...]
    const data = await fetch(`https://api.github.com/repos/${path[1]}/${path[2]}/readme`).then(res => res.json())
    const decoded = atob(data.content)
    return {
      body: `URL: ${url}\nREADME: ${decoded}`,
      siteName: "Github",
    }
  }
}

export default GithubParser