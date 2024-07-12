import cssText from "data-text:~contents/styles.css"
import OpenAI from "openai"
import type { ChatCompletionMessageParam } from "openai/resources"
import type { PlasmoCSConfig } from "plasmo"
import { useEffect, useRef, useState } from "react"

import { getConfig } from "~defaults"

export const config: PlasmoCSConfig = {
  matches: ["<all_urls>"],
  exclude_matches: ["*://*.wikipedia.com/*"],
  css: ["./global.css"]
}

export const getStyle = () => {
  const style = document.createElement("style")
  style.textContent = cssText
  return style
}

chrome.runtime.onMessage.addListener((msg, sender, response) => {
  // Get HTML of current page
  if (msg.name === "DOMInfo") {
    try {
      response({ html: document.documentElement.outerHTML })
    } catch (err) {
      response({ error: err.message })
    }
    return true
  }
})

let keyLock = false // using like a state variable, but we don't need to rerender when it changes. Also, needs faster updates than state variables get.
let hoverTarget: Element | undefined = null
let popupTarget: Element | undefined = null // Once the popup is open, this is the target element

const ContentPopup = () => {
  const [position, setPosition] = useState({ top: 0, left: 0 } as {
    top?: number
    left?: number
    right?: number
    bottom?: number
  })
  const [animationState, setAnimationState] = useState(
    "closed" as "closed" | "opening" | "open" | "closing"
  )
  const [title, setTitle] = useState("")
  const [publisher, setPublisher] = useState("")
  const [imageUrl, setImageUrl] = useState("")
  const [description, setDescription] = useState("")
  const [aiSummary, setSummary] = useState("")
  const [imageType, setImageType] = useState("image-cover")
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

  /**
   * Sets the animation state to "open" when the image has loaded. This is to prevent the popup from opening before the image is ready.
   */
  const imageLoaded = () => {
    setAnimationState((current) => (current == "opening" ? "open" : current))
    setImageType(getImageType())
  }

  const closePopup = async () => {
    // closePopup can be called while the popup is closed (clicking), immediately after openPopup (error, etc.), and also several times in a short period (scrolling)
    // Case #1: do nothing if the state is already closed
    // Case #2: getting the current state needs to take place inside the update function
    // Case #3: it can't interfere with itself, so we need to assume that "closing" means another instance already set the timeout
    setAnimationState((current) => {
      if (current == "opening" || current == "open") {
        setTimeout(
          () =>
            setAnimationState((current) => {
              return current == "closing" ? "closed" : current
            }),
          300
        )
        return "closing"
      }
      return current
    })
    await new Promise((r) => setTimeout(r, 300))
  }

  /**
   * Places the popup relative to the target element such that it is visible.
   * @param target The target element to place the popup relative to
   */
  const movePopup = (target: Element) => {
    // Decide where to place
    const WIDTH = 450
    const bounds = target.getBoundingClientRect()
    const vertical = // If the top of the element is above the middle of the screen, place the popup below it. Otherwise, place it above.
      bounds.top < window.innerHeight / 2
        ? { top: bounds.bottom }
        : { bottom: window.innerHeight - bounds.top }
    const horizontal =
      bounds.left + WIDTH < window.innerWidth
        ? { left: bounds.left }
        : { right: 0 }
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
    if (!url.startsWith("http")) {
      url = new URL(url, window.location.href).href
    }
    return url
  }

  const getOAIData = async (
    tagData: {
      title: string
      description: string
      body: string
    },
    output: (value: React.SetStateAction<string>) => void,
    context?: string
  ) => {
    const config = await getConfig()
    if (!tagData.body) {
      return
    } // Not much to summarize, innit?
    if (!config.apiKey) {
      return
    } // Skip if we don't have an API key
    if (
      tagData.description &&
      tagData.description.length > config.aiThreshold
    ) {
      return
    } // Skip if the description is long enough already
    // Maybe the text of the link is ambiguous and the user wants to know how the content relates
    const messages = [
      { role: "system", content: config.prompt },
      {
        role: "user",
        content:
          (context ? `# Context\n${context}\n` : "") +
          `# Content\n${tagData.body.slice(0, config.inputTokens * 3)}[...]\n` +
          `# Summary`
      }
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
      max_tokens: config.outputTokens
    })
    for await (const chunk of stream) {
      if (!chunk.choices[0].delta) continue
      output((prev) => prev + (chunk.choices[0].delta.content || ""))
    }
  }

  const renderTagPopup = (tagData: {
    title: any
    description: string
    imageUrl: string
    siteName: string
  }) => {
    if (!tagData.title && !tagData.description) {
      throw new Error("No data found")
    }
    setTitle(tagData.title)
    setPublisher(tagData.siteName)
    setImageUrl(tagData.imageUrl)
    setDescription(tagData.description)
    if (!tagData.imageUrl) {
      imageLoaded()
    } else {
      setTimeout(() => {
        imageLoaded()
      }, 1500)
    }
  }

  const updatePopup = async () => {
    try {
      const url = getURL()
      // Plasmo doesn't convert `chrome` to `browser` when this component is used in a tab page
      const tagData =
        process.env.PLASMO_BROWSER == "firefox"
          ? await browser.runtime.sendMessage({
              name: "scrape",
              target: "background",
              url
            })
          : await chrome.runtime.sendMessage({
              name: "scrape",
              target: "background",
              url
            })
      if (tagData.error) throw new Error(`Backend error -- ${tagData.error}`)
      // It is not worth showing just a title.
      if (!tagData.description && !tagData.body && !tagData.image) {
        throw new Error("No data found")
      }
      renderTagPopup(tagData)
      try {
        await getOAIData(tagData, setSummary, popupTarget.textContent)
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
      keyLock = event.key !== "Shift"
    }
    window.addEventListener("keydown", callback)
    return () => {
      window.removeEventListener("keydown", callback)
    }
  })

  const isElementEditable = (element) => {
    let value = element.contentEditable
    while (value === "inherit" && element.parentElement) {
      element = element.parentElement
      value = element.contentEditable
    }
    return value === "inherit" || value === "false" ? false : true
  }

  // Summon on releasing shift
  useEffect(() => {
    const callback = async (event: { key: string }) => {
      if (
        !isElementEditable(document.activeElement) && // If there isn't a focused text box (discord, youtube comments)
        event.key === "Shift" &&
        hoverTarget &&
        !keyLock
      ) {
        await openPopup()
      }
    }
    window.addEventListener("keyup", callback)
    return () => {
      window.removeEventListener("keyup", callback)
    }
  })

  // Dismiss on scroll (the popup doesn't move with the page)
  // Dismiss on clicking outside
  useEffect(() => {
    const callback = async (event: { target: Element }) => {
      if (event.target.tagName !== "PLASMO-CSUI") {
        closePopup()
      }
    }
    // @ts-ignore ts(2769)
    window.addEventListener("scroll", callback)
    // @ts-ignore ts(2769)
    document.addEventListener("click", callback)
    return () => {
      // @ts-ignore ts(2769)
      window.removeEventListener("scroll", callback)
      // @ts-ignore ts(2769)
      document.removeEventListener("click", callback)
    }
  })

  // Reposition on window resize
  useEffect(() => {
    const callback = async () => {
      if (popupTarget) {
        movePopup(popupTarget)
      }
    }
    window.addEventListener("resize", callback)
    return () => {
      window.removeEventListener("resize", callback)
    }
  })

  let url = "#"
  try {
    url = popupTarget.getAttribute("href")
  } catch (_) {}

  const formatSummary = (summary: string) => {
    const lines = summary
      .split("\n")
      .map((line) => line.replace(/^\s*-\s*/, ""))
    return (
      <ul className="summary relative flex list-disc flex-col gap-2 pl-4 italic">
        {lines.map((content, i) => (
          <li key={i}>
            {content.split(" ").map((word, i) => (
              <span key={i} className="word">
                {word}{" "}
              </span>
            ))}
          </li>
        ))}
      </ul>
    )
  }

  const getImageType = (): "image-contain" | "image-cover" => {
    if (imageRef && imageRef.current) {
      const height = imageRef.current.naturalHeight
      const width = imageRef.current.naturalWidth
      if (Math.abs(width / height - 1) < 0.1 || width < 100 || height < 100)
        return "image-contain"
    }
    if (!imageUrl) {
      return "image-cover"
    }
    return /svg|gif/.test(imageUrl) ? "image-contain" : "image-cover"
  }

  // Position.top is defined only if the popup is anchored to the bottom of an element
  // This means that the popup is expanding towards the bottom of the screen, so maxHeight is the distance before it goes offscreen
  const maxHeight =
    Math.round(
      position.top
        ? window.innerHeight - position.top
        : window.innerHeight - position.bottom
    ) - 10
  // Shrink the image for tiny popups
  const imageMaxHeight =
    imageType == "image-contain"
      ? Math.min(maxHeight / 3, 100)
      : Math.min(maxHeight / 3, 200)

  return (
    <div
      className={`fixed min-h-[30px] max-w-[100vw] w-[450px] overflow-clip rounded-xl z-10 text-white bg-gray-800/60 backdrop-blur-md text-base shadow-i-lg 
        ${animationState == "closed" || animationState == "closing" ? "hide" : "hover-popup"}`}
      style={{
        top: position.top,
        left: position.left,
        right: position.right,
        bottom: position.bottom,
        display: animationState == "closed" ? "none" : "block"
      }}>
      {animationState == "opening" && <div className="loader" />}
      <div
        className={`flex flex-col overflow-y-auto max-w-full overscroll-none ${animationState != "opening" ? "inner-popup" : "none"}`}
        style={{ "--maxHeight": `${maxHeight}px` } as React.CSSProperties}>
        <img // In Firefox, CSP may block the image if the img tag is created with a src attribute. We can't do {imageUrl && ...} nonsense here.
          onLoad={imageLoaded}
          src={imageUrl} // This is blank initially and reset to be blank occasionally, so it should be fine.
          ref={imageRef}
          className={imageType}
          style={{ maxHeight: `${imageMaxHeight}px` }}
        />
        {(title || description || aiSummary) && (
          <div className="flex flex-col gap-2 px-4 pb-4 pt-2">
            {title && (
              <a href={url} className="text-lg font-bold hover:underline">
                {title}
              </a>
            )}
            {description &&
              description
                .split("\n")
                .map((content, i) => <p key={i}>{content}</p>)}
            {aiSummary && formatSummary(aiSummary)}
          </div>
        )}
        {publisher && (
          <div className="bg-gray-700/50 px-4 py-3">
            <p className="text-sm text-gray-400">{publisher}</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default ContentPopup
