import { isProbablyReaderable, Readability } from "@mozilla/readability"
import cssText from "data-text:~contents/styles.css"
import OpenAI from "openai"
import type { ChatCompletionMessageParam } from "openai/resources"
import { useEffect, useState } from "react"

import { sendToBackground } from "@plasmohq/messaging"
import { Storage } from "@plasmohq/storage"
import type { PlasmoCSConfig } from "plasmo"

export const config: PlasmoCSConfig = {
    matches: ["<all_urls>"],
    exclude_matches: ["*://*.wikipedia.com/*", "*://*.google.com/*",  "*://x.com/*"],
}
const defaults = {
  baseURL: "https://api.openai.com/v1/",
  model: "gpt-3.5-turbo",
  prompt:
    "Generate a concise and to the point summary for the following content. Do not begin with 'The article...' or similar. Make sure the summary relates to the context snippet provided.",
  inputTokens: 300,
  outputTokens: 100
}

export const getStyle = () => {
  const style = document.createElement("style")
  style.textContent = cssText
  return style
}

const settings = new Storage()

let hoverTarget: Element | undefined = null

const getConfig = async () => {
  // Grab our config
  const config = {
    apiKey: await settings.get("openai-key"),
    baseURL: (await settings.get("openai-baseURL")) || defaults.baseURL,
    model: (await settings.get("openai-model")) || defaults.model,
    prompt: (await settings.get("system-prompt")) || defaults.prompt,
    inputTokens: (parseInt(await settings.get("input-tokens"))) || defaults.inputTokens,
    outputTokens: (parseInt(await settings.get("output-tokens"))) || defaults.outputTokens,
  }
  return config
}
const summaryPopup = () => {
  const [position, setPosition] = useState({ top: 0, left: 0 } as {
    top?: number
    left?: number
    right?: number
    bottom?: number
  })
  const [isActive, setActive] = useState(false) // Is the user trying to open the popup
  const [isPopupReady, setPopupReady] = useState(false) // Is the popup ready to be displayed
  const [title, setTitle] = useState("")
  const [images, setImages] = useState([])
  const [description, setDescription] = useState("")

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

  const updatePopup = async () => {
    // Validate URL
    const text = hoverTarget.textContent
    let url = hoverTarget.getAttribute("href")
    if (!url || url.startsWith("#") || url.startsWith("javascript")) {
      return
    }
    if (url.startsWith("/")) {
      url = window.location.origin + url
    }
    // Reset state & fetch configuration
    setPopupReady(false)
    setDescription("")
    const config = await getConfig()
    // Fetch basic data & summary
    const resp = await sendToBackground({ name: "scrape", body: { url } })
    if (resp.error) {
      setTitle("Error fetching data")
      setDescription(`${resp.error}`)
      return
    }
    const document = new DOMParser().parseFromString(resp.html, "text/html")
    if (!isProbablyReaderable(document)) return // We can't really do anything with this
    const reader = new Readability(document)
    const parsed = reader.parse()
    // Render popup with basic data
    setTitle(resp.meta.title || parsed.title)
    setDescription("")
    setImages([resp.meta.image])
    setActive(true)
    if (!resp.meta.image) {
      setPopupReady(true)
    } else {
      setTimeout(() => setPopupReady(true), 1000)
    }
    // Use OpenAI API to generate a summary
    const messages = [
      { role: "system", content: config.prompt },
      { role: "user", content: `Context: "${text}"\nContent: "${parsed.textContent.slice(0, config.inputTokens * 3)}"` },
    ] as ChatCompletionMessageParam[]
    await streamOpenAICompletion(messages, setDescription, config).catch((e) =>
      setDescription((prev) => prev + "\n" + "Error fetching data: " + e)
    )
    // Further updates to the popup are handled by the streaming function
  }

  const streamOpenAICompletion = async (
    messages: ChatCompletionMessageParam[],
    output: React.Dispatch<React.SetStateAction<string>>,
    config: { apiKey: string; baseURL: string; model: string, outputTokens: number }
  ) => {
    const openai = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
      dangerouslyAllowBrowser: true // it is a browser extension so this is okay!!
    })

    const stream = await openai.chat.completions.create({
      model: config.model,
      messages: messages,
      stream: true,
      max_tokens: config.outputTokens,
    })
    for await (const chunk of stream) {
      if (!chunk.choices[0].delta) continue
      output((prev) => prev + (chunk.choices[0].delta.content || ""))
    }
  }

  useEffect(() => {
    const callback = (event) => {
      hoverTarget = (event.target as Element).closest("a")
    }
    document.addEventListener("mouseover", callback)
    return () => {
      document.removeEventListener("mouseover", callback)
    }
  })

  useEffect(() => {
    const callback = async (event) => {
      if (event.key === "Control" && hoverTarget) {
        if (!hoverTarget) {
          return
        }
        setActive(false)
        movePopup(hoverTarget)
        await updatePopup()
      }
    }
    window.addEventListener("keydown", callback)
    return () => {
      window.removeEventListener("keydown", callback)
    }
  })

  useEffect(() => {
    const callback = (event) => {
      if (event.target !== hoverTarget) {
        setActive(false)
      }
    }
    window.addEventListener("scroll", callback)
    return () => {
      window.removeEventListener("scroll", callback)
    }
  })

  let url = "#"
  try {
    hoverTarget.getAttribute("href")
  } catch (_) {}

  return (
    <div
      className={`fixed min-h-8 w-[500px] overflow-clip rounded-xl text-white bg-gray-800/60 backdrop-blur-md text-base shadow-i-lg ${isActive && isPopupReady ? "hover-popup" : ""}`}
      style={{
        top: position.top,
        left: position.left,
        right: position.right,
        bottom: position.bottom,
        display: isActive && isPopupReady ? "block" : "none"
      }}>
      {images[0] && (
        <img
          onLoad={() => setPopupReady(true)}
          src={images[0].url}
          className="max-h-[200px] w-full object-cover"
        />
      )}

      <div className="flex flex-col gap-2 px-4 pb-4 pt-2">
        {title && <a href={url} className="text-lg font-bold hover:underline">{title}</a>}
        {description && description.split("\n").map((content, i) => (
            <p key={i}>{content.split(" ").map((word, i) => (
              <span key={i} className="word">{word} </span>
          ))}</p>
        ))}
      </div>
    </div>
  )
}

export default summaryPopup
