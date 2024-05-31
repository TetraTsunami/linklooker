import { Readability } from "@mozilla/readability"
import cssText from "data-text:~contents/styles.css"
import OpenAI from "openai"
import type { ChatCompletionMessageParam } from "openai/resources"
import { useEffect, useRef, useState } from "react"

import { sendToBackground } from "@plasmohq/messaging"
import { Storage } from "@plasmohq/storage"
import type { PlasmoCSConfig } from "plasmo"
import { defaultSettings } from "~defaults"

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

let keyLock = false // using like a state variable, but we don't need to rerender when it changes. Also, needs faster updates than state variables get.
let hoverTarget: Element | undefined = null
let popupTarget: Element | undefined = null // Once the popup is open, this is the target element

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
  const [imageUrl, setImageUrl] = useState("")
  const [description, setDescription] = useState("")
  const [aiSummary, setSummary] = useState("")
  const imageRef = useRef<HTMLImageElement>(null)

  const resetState = async () => {
    await closePopup()
    setTitle("")
    setDescription("")
    setSummary("")
    setPublisher("")
    setImageUrl("")
  }

  const openPopup = async () => {
    popupTarget = hoverTarget
    await resetState()
    movePopup(popupTarget)
    setAnimationState("opening")
    await updatePopup()
  }

  const closePopup = async () => {
    // closePopup can be called while the popup is closed (clicking), immediately after openPopup (error, etc.), and also several times in a short period (scrolling)
    // Case #1: do nothing if the state is already closed
    // Case #2: getting the current state needs to take place inside the update function
    // Case #3: it can't interfere with itself, so we need to assume that "closing" means another instance already set the timeout
    setAnimationState((current) => {
      if (current == "opening" || current == "open") {
        setTimeout(() => setAnimationState("closed"), 300)
        return "closing"
      }
      return current
    })
    await new Promise(r => setTimeout(r, 300));
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
      url = popupTarget.getAttribute("href")
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
    if (!parsed) {
      return {
        title: tags.title,
        description: tags.description,
        image: tags.image,
        body: "",
        siteName: "",
      }
    }
    return {
      title: tags.title || parsed.title,
      description: tags.description || parsed.excerpt,
      image: tags.image,
      body: parsed.textContent || "",
      siteName: parsed.siteName || "",
    }
  }

  /**
   * Uses the OpenAI API to generate a more extensive summary for the given content. Output is appended to the description state.
   * @param tagData The data to generate a summary for
   */
  const getOAIData = async (tagData: { title: string; description: string; body: string; }) => {
    const config = await getConfig()
    if (!tagData.body) { return } // Not much to summarize, innit?
    if (!config.apiKey) { return } // Skip if we don't have an API key
    if (tagData.description && tagData.description.length > config.aiThreshold) { return } // Skip if the description is long enough already
    // Maybe the text of the link is ambiguous and the user wants to know how the content relates
    const linkText = popupTarget.textContent || "Unknown"
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
    setImageUrl(tagData.image.url || "")
    setDescription(tagData.description)
    if (!tagData.image) {
      setAnimationState("open")
    } else {
      setTimeout(() => {
        setAnimationState("open")
      }, 2000) // Wait for image to load
    }
  }

  const updatePopup = async () => {
    try {
      const url = getURL()
      const tagData = await getTagData(url)
      // Title is the only thing we can guarantee will be there. If it's the only thing we have, it's not worth showing
      if (!tagData.description && !tagData.body && !tagData.image) {
        throw new Error("No data found")
      }
      renderTagPopup(tagData)
      try {
        await getOAIData(tagData)
      } catch (e) {
        console.warn("Error getting OpenAI completion: ", e)
        setSummary("Error getting summary: " + e)
      }
    } catch (e) {
      console.error(e)
      resetState()
      popupTarget.classList.add("linklooker-fail")
      setTimeout(() => popupTarget.classList.remove("linklooker-fail"), 1000)
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

  // Summon on releasing shift
  useEffect(() => {
    const callback = async (event: { key: string }) => {
      if ( document.activeElement !== document.body ) return
      keyLock = (event.key !== "Shift")
    }
    window.addEventListener("keydown", callback)
    return () => {
      window.removeEventListener("keydown", callback)
    }
  })

  // Summon on releasing shift
  useEffect(() => {
    const callback = async (event: { key: string }) => {
      if (event.key === "Shift" && hoverTarget && !keyLock) {
        await openPopup()
      }
    }
    window.addEventListener("keyup", callback)
    return () => {
      window.removeEventListener("keyup", callback)
    }
  })

  // Dismiss on scroll (the popup doesn't move with the page)
  useEffect(() => {
    const callback = async (event: { target: Element }) => {
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
    const callback = async (event: { target: Element }) => {
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
    url = popupTarget.getAttribute("href")
  } catch (_) {}

  // If it's got transparency, we don't want to cut it off (could be icon or logo) = use contain. Otherwise, it looks prettier to use cover
  const getImageType = () => {
    if (!imageUrl) {return}
    if (imageRef && imageRef.current) {
      if (Math.abs(imageRef.current.width / imageRef.current.height - 1) < 0.1) return "image-contain"
      if (imageRef.current.width < 100 || imageRef.current.height < 100) return "image-contain"
    }
    return /svg|gif/.test(imageUrl) ? "image-contain" : "image-cover"
  }

  // Position.top is defined only if the popup is anchored to the bottom of an element
  // This means that the popup is expanding towards the bottom of the screen, so maxHeight is the distance before it goes offscreen
  const maxHeight = Math.round(position.top ? window.innerHeight - position.top : window.innerHeight - position.bottom) - 10
  // Shrink the image for tiny popups
  const imageType = getImageType()
  const imageMaxHeight = imageType == "image-contain" ? Math.min(maxHeight / 3, 100) : Math.min(maxHeight / 3, 200)

  return (
    <div
      className={`fixed min-h-[30px] w-[450px] overflow-clip rounded-xl z-10 text-white bg-gray-800/60 backdrop-blur-md text-base shadow-i-lg 
        ${animationState == "closed" || animationState == "closing" ? "hide" : "hover-popup"}`}
      style={{
        top: position.top,
        left: position.left,
        right: position.right,
        bottom: position.bottom,
        display: animationState == "closed" ? "none" : "block"
      }}>
      {animationState == "opening" && <div className="loader" />}
      <div className={`flex flex-col overflow-y-auto overscroll-none ${animationState != "opening" ? "inner-popup" : "none" }`}
      style={{"--maxHeight": `${maxHeight}px`} as React.CSSProperties}>
        <img // In Firefox, CSP may block the image if the img tag is created with a src attribute. We can't do {imageUrl && ...} nonsense here.
          onLoad={() => setAnimationState((current) => current == "opening" ? "open" : current)}
          src={imageUrl} // This is blank initially and reset to be blank occasionally, so it should be fine. 
          ref={imageRef}
          className={imageType}
          style={{"maxHeight": `${imageMaxHeight}px`}}
        />
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
        {publisher && (
        <div className="bg-gray-700/50 px-4 py-3">
          <p className="text-sm text-gray-400">{publisher}</p>
        </div>)}
      </div>
    </div>
  )
}

export default SummaryPopup
