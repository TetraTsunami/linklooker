import type { Parser } from "."

const HNParser: Parser = {
  matches: async (doc: Document, url: string) => {
    const regex = "^https://news.ycombinator.com/item\?"
    return url.match(regex).length > 0
  },
  parse: async (doc: Document, url: string) => {
    const postText = doc.querySelector(".toptext")?.textContent
    const comments = doc.querySelectorAll(".comment-tree > tbody > tr")
    let commentData = []
    for (const comment of comments) {
      commentData.push({
        text: comment.querySelector(".commtext")?.textContent || "",
        indent: comment.querySelector(".ind")?.getAttribute("indent") || 0
      })
    }
    commentData = commentData.filter(({indent}) => indent < 3).slice(0,20)
    return {
      description: postText,
      body: `URL: ${url}\nComments:\n${commentData.reduce((acc, {text, indent}) => acc + " ".repeat(indent) + " - " + text + "\n", "")}`,
      siteName: "Hacker News",
      forceSummary: true
    }
  }
}

export default HNParser