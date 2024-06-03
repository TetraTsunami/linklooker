import { Readability } from "@mozilla/readability"
import "./styles.css"
import OpenAI from "openai"
import type { ChatCompletionMessageParam } from "openai/resources"
import { useEffect, useRef, useState } from "react"

import { sendToBackground } from "@plasmohq/messaging"
import { Storage } from "@plasmohq/storage"
import { defaultSettings } from "~defaults"

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

const Popup = () => {
  const [isDoneLoading, setIsDoneLoading] = useState(false)
  const [title, setTitle] = useState("")
  const [publisher, setPublisher] = useState("")
  const [imageUrl, setImageUrl] = useState("")
  const [description, setDescription] = useState("")
  const [aiSummary, setSummary] = useState("")
  const imageRef = useRef<HTMLImageElement>(null)

  const resetState = async () => {
    setTitle("")
    setDescription("")
    setSummary("")
    setPublisher("")
    setImageUrl("")
  }

  /**
   * Sets the animation state to "open" when the image has loaded. This is to prevent the popup from opening before the image is ready.
   */
  const imageLoaded = () => {
    setIsDoneLoading(true)
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
    const messages = [
      { role: "system", content: config.prompt },
      { role: "user", content: `Context: ${title}\nContent: "${tagData.body.slice(0, config.inputTokens * 3)}[...]\nSummary:"` },
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
      imageLoaded()
    } else {
      setTimeout(() => {
        imageLoaded()
      }, 1500)
    }
  }

  const updatePopup = async () => {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      try {
        const url = tabs[0].url
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
        window.close();
      }
    })
  }

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
  // Shrink the image for tiny popups
  // const imageType = getImageType()

  useEffect(() => {
    updatePopup()
  }, [])

  return (
    <div
      className={`popup flex flex-col items-center overflow-clip bg-acorn-bg-1 text-base text-white`}>
      {!isDoneLoading && <div className="loader" />}
      <div className={`flex flex-col overflow-y-auto overscroll-none ${isDoneLoading ? "inner-popup" : "hidden" }`}
      style={{"--maxHeight": `700px`} as React.CSSProperties}>
        <img // In Firefox, CSP may block the image if the img tag is created with a src attribute. We can't do {imageUrl && ...} nonsense here.
          onLoad={imageLoaded}
          src={imageUrl} // This is blank initially and reset to be blank occasionally, so it should be fine. 
          ref={imageRef}
          className={getImageType()}
        />
        {(title || description || aiSummary) && (
        <div className="flex flex-col gap-2 px-4 pb-4 pt-2">
          {title && <p className="text-lg font-bold hover:underline">{title}</p>}
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

export default Popup
