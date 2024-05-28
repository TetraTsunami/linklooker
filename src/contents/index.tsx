import { Readability } from "@mozilla/readability"
import cssText from "data-text:~contents/styles.css"
import OpenAI from "openai"
import type { ChatCompletionMessageParam } from "openai/resources"
import { useEffect, useRef, useState } from "react"

import { sendToBackground } from "@plasmohq/messaging"
import { Storage } from "@plasmohq/storage"
import type { PlasmoCSConfig } from "plasmo"

export const config: PlasmoCSConfig = {
    matches: ["<all_urls>"],
    exclude_matches: ["*://*.wikipedia.com/*"],
    css: ["./global.css"],
  }
  
export const getStyle = () => {
  const style = document.createElement("style")
  style.textContent = cssText
  return style
}

const defaultSettings = {
  baseURL: "https://api.openai.com/v1/",
  model: "gpt-3.5-turbo",
  prompt:
    "Generate a concise and to the point summary for the following content. Do not begin with 'The article...' or similar. Make sure the summary relates to the context snippet provided.",
  inputTokens: 300,
  outputTokens: 100,
  aiThreshold: 300,
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

const settings = new Storage()

let hoverTarget: Element | undefined = null

const getConfig = async () => {
  // Grab our config
  const config = {
    apiKey: await settings.get("openai-key"),
    baseURL: (await settings.get("openai-baseURL")) || defaultSettings.baseURL,
    model: (await settings.get("openai-model")) || defaultSettings.model,
    prompt: (await settings.get("system-prompt")) || defaultSettings.prompt,
    inputTokens: (parseInt(await settings.get("input-tokens"))) || defaultSettings.inputTokens,
    outputTokens: (parseInt(await settings.get("output-tokens"))) || defaultSettings.outputTokens,
    aiThreshold: (parseInt(await settings.get("ai-threshold"))) || defaultSettings.aiThreshold,
  }
  return config
}

const SummaryPopup = () => {
  const [position, setPosition] = useState({ top: 0, left: 0 } as {
    top?: number
    left?: number
    right?: number
    bottom?: number
  })
  const [animationState, setAnimationState] = useState("closed" as "closed" | "opening" | "open" | "closing")
  const [title, setTitle] = useState("")
  const [publisher, setPublisher] = useState("")
  const [image, setImage] = useState({
    url: "",
    width: "",
    height: "",
  })
  const [description, setDescription] = useState("")
  const [aiSummary, setSummary] = useState("")
  const imageRef = useRef<HTMLImageElement>(null)

  const resetState = async () => {
    if (animationState != "closed") {
      await closePopup()
    }
    setTitle("")
    setDescription("")
    setSummary("")
    setPublisher("")
    setImage({ url: "", width: "", height: "" })
  }

  const openPopup = async () => {
    await resetState()
    movePopup(hoverTarget)
    setAnimationState("opening")
    await updatePopup()
  }

  const closePopup = async () => {
    if (animationState == "closed" || animationState == "closing") return
    setAnimationState("closing")
    return new Promise((resolve) => setTimeout(() => {
      setAnimationState("closed")
      resolve(null)
    }, 300))
  }

  /**
   * Places the popup relative to the target element such that it is visible.
   * @param target The target element to place the popup relative to
   */
  const movePopup = (target: Element) => {
    // Decide where to place
    const bounds = target.getBoundingClientRect()
    const vertical =
      bounds.top < window.innerHeight / 2
        ? { top: bounds.bottom }
        : { bottom: window.innerHeight - bounds.top }
    const horizontal =
      bounds.right < window.innerWidth / 2
        ? { left: bounds.left }
        : { right: window.innerWidth - bounds.right }
    setPosition({ ...vertical, ...horizontal })
  }

  /**
   * Get the URL destination of the target link
   * @param target A link
   * @returns A URL
   * @throws If the URL cannot be found, or this element cannot handle the URL
   */
  const getURL = () => {
    let url = ""
    try {
      url = hoverTarget.getAttribute("href")
    } catch (_) {
      throw new Error("No URL found")
    }
    if (!url || url.startsWith("#") || url.startsWith("javascript")) {
      throw new Error("Invalid URL")
    }
    if (url.startsWith("/")) {
      url = window.location.origin + url
    }
    return url
  }

  /**
   * Fetches the "structural" data of a webpage.
   * This includes its title and description (OpenGraph/Head tags), and parsed body text content (Readability.js)
   * @param url The URL of the webpage
   * @returns An object containing the meta data and parsed content {meta, readability}
   */
  const getTagData = async (url: string) => {
    const resp = await sendToBackground({ name: "scrape", body: { url } })
    if (resp.error) {
      throw new Error(resp.error)
    }
    const document = new DOMParser().parseFromString(resp.html, "text/html")
    const reader = new Readability(document)
    const parsed = reader.parse()
    const tags = resp.meta as Meta // Data from html tags
    // There's some overlap, so we'll return a merged object with only the keys we need
    return {
      title: tags.title || parsed.title,
      description: tags.description || parsed.excerpt,
      image: tags.image,
      body: parsed.textContent,
      siteName: parsed.siteName,
    }
  }

  /**
   * Uses the OpenAI API to generate a more extensive summary for the given content. Output is appended to the description state.
   * @param tagData The data to generate a summary for
   */
  const getOAIData = async (tagData: { title: string; description: string; body: string; }) => {
    const config = await getConfig()
    if (tagData.description.length > config.aiThreshold) { return } // Skip if the description is long enough already
    if (!config.apiKey) { return } // Skip if we don't have an API key
    // Maybe the text of the link is ambiguous and the user wants to know how the content relates
    const linkText = hoverTarget ? hoverTarget.textContent : "Unknown"
    const messages = [
      { role: "system", content: config.prompt },
      { role: "user", content: `Context: "${linkText}"\nContent: "${tagData.body.slice(0, config.inputTokens * 3)}[...]\nSummary:"` },
    ] as ChatCompletionMessageParam[]
    const openai = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
      dangerouslyAllowBrowser: true // It is a browser extension, so this is okay
    })

    const stream = await openai.chat.completions.create({
      model: config.model,
      messages: messages,
      stream: true,
      max_tokens: config.outputTokens,
    })
    for await (const chunk of stream) {
      if (!chunk.choices[0].delta) continue
      setSummary((prev) => prev + (chunk.choices[0].delta.content || ""))
    }
  }

  const renderTagPopup = (tagData: { title: any; description: string; image: any; siteName: string }) => {
    if (!tagData.title && !tagData.description) {
      throw new Error("No data found")
    }
    setTitle(tagData.title)
    setPublisher(tagData.siteName)
    setImage({
      "url": "",
      "width": "",
      "height": "",
      ...tagData.image
    })
    setDescription(tagData.description)
    if (!tagData.image) {
      setAnimationState("open")
    } else {
      setTimeout(() => {
        setAnimationState("open")
      }, 1000) // Wait for image to load
    }
  }

  const updatePopup = async () => {
    try {
      const url = getURL()
      const tagData = await getTagData(url)
      renderTagPopup(tagData)
      try {
        await getOAIData(tagData)
      } catch (e) {
        console.warn("Error getting OpenAI completion: ", e)
      }
    } catch (e) {
      console.error(e)
      resetState()
      hoverTarget.classList.add("linklooker-fail")
      setTimeout(() => hoverTarget.classList.remove("linklooker-fail"), 1000)
    }
  }

  // Update the target when hovering over a link
  useEffect(() => {
    const callback = (event: { target: Element }) => {
      hoverTarget = (event.target as Element).closest("a")
    }
    // @ts-ignore ts(2769)
    document.addEventListener("mouseover", callback)
    return () => {
      // @ts-ignore ts(2769)
      document.removeEventListener("mouseover", callback)
    }
  })

  // Summon on pressing shift
  useEffect(() => {
    const callback = async (event: { key: string }) => {
      if (event.key === "Shift" && hoverTarget) {
        await openPopup()
      }
    }
    window.addEventListener("keydown", callback)
    return () => {
      window.removeEventListener("keydown", callback)
    }
  })

  // Dismiss on scroll (the popup doesn't move with the page)
  useEffect(() => {
    const callback = (event: { target: Element }) => {
      if (event.target.tagName !== "PLASMO-CSUI") {
        closePopup()
      }
    }
    // @ts-ignore ts(2769)
    window.addEventListener("scroll", callback)
    return () => {
      // @ts-ignore ts(2769)
      window.removeEventListener("scroll", callback)
    }
  })

  // Dismiss on clicking outside
  useEffect(() => {
    const callback = (event: { target: Element }) => {
      if (event.target.tagName !== "PLASMO-CSUI") {
        closePopup()
      }
    }
    // @ts-ignore ts(2769)
    document.addEventListener("click", callback)
    return () => {
      // @ts-ignore ts(2769)
      document.removeEventListener("click", callback)
    }
  })

  let url = "#"
  try {
    url = hoverTarget.getAttribute("href")
  } catch (_) {}

  // If it's got transparency, we don't want to cut it off (could be icon or logo) = use contain. Otherwise, it looks prettier to use cover
  const getImageType = () => {
    if (!image || !image.url) {return}
    if (imageRef && imageRef.current && imageRef.current.width < 100 && imageRef.current.height < 100) {
      return "image-contain"
    }
    if (image.url.includes("png") || image.url.includes("svg") || image.url.includes("gif")) {
      return "image-contain"
    }
    return "image-cover"
  }

  const maxHeight = position.top > window.innerHeight / 2 ? position.top : window.innerHeight - position.top

  return (
    <div
      className={`fixed min-h-8 w-[450px] overflow-clip rounded-xl text-white bg-gray-800/60 backdrop-blur-md text-base shadow-i-lg 
        ${animationState == "closed" || animationState == "closing" ? "hide" : "hover-popup"}`}
      style={{
        top: position.top,
        left: position.left,
        right: position.right,
        bottom: position.bottom,
        display: animationState == "closed" ? "none" : "block"
      }}>
      {animationState == "opening" && <div className="loader" />}
      {animationState != "opening" && (
      <div className="inner-popup flex flex-col overflow-y-auto"
      style={{"--maxHeight": `${maxHeight - 80}px`} as React.CSSProperties}>
        {image.url && (
          <img
            onLoad={() => setAnimationState("open")}
            src={image.url}
            ref={imageRef}
            className={getImageType()}
          />
        )}
        {(title || description || aiSummary) && (
        <div className="flex flex-col gap-2 px-4 pb-4 pt-2">
          {title && <a href={url} className="text-lg font-bold hover:underline">{title}</a>}
          {description && description.split("\n").map((content, i) => (
            <p key={i}>
              {content}
            </p>
          ))}
          {aiSummary && (
            <div className="summary relative flex flex-col gap-2 italic">
              {aiSummary.split("\n").map((content, i) => (
                <p key={i}>
                  {content.split(" ").map((word, i) => (
                    <span key={i} className="word">{word} </span>
                  ))}
                </p>
              ))}
            </div>
          )}
        </div>)}
      </div>)}
      {publisher && animationState != "opening" && <div className="w-full bg-gray-700/50 px-4 py-3">
        <p className="text-sm text-gray-400">{publisher}</p>
      </div>}
    </div>
  )
}

export default SummaryPopup
