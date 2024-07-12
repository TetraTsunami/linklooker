import type { Parser } from "."

const GitlabParser: Parser = {
  matches: async (doc: Document, url: string) => {
    const siteName = doc.querySelector("meta[property='og:site_name']")?.getAttribute("content")
    return siteName === "GitLab"
  },
  // GitLab doesn't preview documents statically, and I don't think we're executing JS.
  // This means we need to navigate to the repo homepage to find the README link
  // And then instead of following that, replace /blob/ with /raw/ to get the raw text
  rewrite: async (doc: Document, url: string) => {
    if (url.match("README")) { // If we're already at the README, stop
      return url
    }
    if (url.match(/\/-\//)) { // If we aren't at the root of the repo, go to the root
      return url.replace(/\/-\/.*/,"")
    }
  },
  parse: async (doc: Document, url: string) => {
    // Find the README link and replace /blob/ with /raw/
    const sidebarLinks = doc.querySelectorAll(".project-page-sidebar-block .nav-item a") as NodeListOf<HTMLAnchorElement>
    let readmeUrl = ""
    for (const link of sidebarLinks) {
      if (link.textContent?.match(/readme/i)) {
        readmeUrl = link.href.replace("/blob/", "/raw/")
        break
      }
    }
    if (!readmeUrl) {
      return {}
    }
    const resp = await fetch(readmeUrl)
    const text = await resp.text()
    return {
      body: text,
      siteName: "GitLab"
    }
  }
}

export default GitlabParser