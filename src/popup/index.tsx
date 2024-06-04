import "./styles.css"

import OpenAI from "openai"
import type { ChatCompletionMessageParam } from "openai/resources"
import { useEffect, useRef, useState } from "react"

import { Storage } from "@plasmohq/storage"

import { defaultSettings } from "~defaults"

const settings = new Storage()

const getConfig = async () => {
  // Grab our config
  const config = {
    apiKey: await settings.get("openai-key"),
    baseURL: (await settings.get("openai-baseURL")) || defaultSettings.baseURL,
    model: (await settings.get("openai-model")) || defaultSettings.model,
    prompt: (await settings.get("system-prompt")) || defaultSettings.prompt,
    inputTokens:
      parseInt(await settings.get("input-tokens")) ||
      defaultSettings.inputTokens,
    outputTokens:
      parseInt(await settings.get("output-tokens")) ||
      defaultSettings.outputTokens,
    aiThreshold:
      parseInt(await settings.get("ai-threshold")) ||
      defaultSettings.aiThreshold
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

  /**
   * Sets the animation state to "open" when the image has loaded. This is to prevent the popup from opening before the image is ready.
   */
  const imageLoaded = () => {
    setIsDoneLoading(true)
  }

  /**
   * Uses the OpenAI API to generate a more extensive summary for the given content. Output is appended to the description state.
   * @param tagData The data to generate a summary for
   */
  const getOAIData = async (tagData: {
    title: string
    description: string
    body: string
  }) => {
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
        content: `Context: ${title}\nContent: "${tagData.body.slice(0, config.inputTokens * 3)}[...]\nSummary:"`
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
      setSummary((prev) => prev + (chunk.choices[0].delta.content || ""))
    }
  }

  const renderTagPopup = (tagData: {
    title: any
    description: string
    image: any
    siteName: string
  }) => {
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
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, { name: "DOMInfo" }, (resp) => {
        try {
          if (!resp) {
            window.close()
            return
          }
          if (resp.error) throw new Error(resp.error)
          const html = resp.html
          chrome.runtime.sendMessage(
            { name: "parseHTML", url: tabs[0].url, html },
            (tagData) => {
              if (tagData.error) throw new Error("Error parsing HTML: " + tagData.error)
              if (!tagData.description && !tagData.body && !tagData.image) {
                throw new Error("No data found")
              }
              renderTagPopup(tagData)
              try {
                getOAIData(tagData)
              } catch (e) {
                console.warn("Error getting OpenAI completion: ", e)
                setSummary("Error getting summary: " + e)
              }
            }
          )
        } catch (e) {
          setDescription(e)
          setIsDoneLoading(true)
        }
      })
    })
  }

  // If it's got transparency, we don't want to cut it off (could be icon or logo) = use contain. Otherwise, it looks prettier to use cover
  const getImageType = () => {
    if (!imageUrl) {
      return
    }
    if (imageRef && imageRef.current) {
      if (Math.abs(imageRef.current.width / imageRef.current.height - 1) < 0.1)
        return "image-contain"
      if (imageRef.current.width < 100 || imageRef.current.height < 100)
        return "image-contain"
    }
    return /svg|gif/.test(imageUrl) ? "image-contain" : "image-cover"
  }

  useEffect(() => {
    updatePopup()
  }, [])

  return (
    <div
      className={`popup flex flex-col items-center overflow-clip bg-acorn-bg-1 text-base text-white`}>
      {!isDoneLoading && <div className="loader" />}
      <div
        className={`flex flex-col overflow-y-auto overscroll-none ${!isDoneLoading && "hidden"}`}
        style={{ "--maxHeight": `700px` } as React.CSSProperties}>
        <img // In Firefox, CSP may block the image if the img tag is created with a src attribute. We can't do {imageUrl && ...} nonsense here.
          onLoad={imageLoaded}
          src={imageUrl} // This is blank initially and reset to be blank occasionally, so it should be fine.
          ref={imageRef}
          className={getImageType()}
        />
        {(title || description || aiSummary) && (
          <div className="flex flex-col gap-2 px-4 pb-4 pt-2">
            {title && (
              <p className="text-lg font-bold hover:underline">{title}</p>
            )}
            {description &&
              description
                .split("\n")
                .map((content, i) => <p key={i}>{content}</p>)}
            {aiSummary && (
              <div className="summary relative flex flex-col gap-2 italic">
                {aiSummary.split("\n").map((content, i) => (
                  <p key={i}>
                    {content.split(" ").map((word, i) => (
                      <span key={i} className="word">
                        {word}{" "}
                      </span>
                    ))}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}
        {publisher && (
          <div className="bg-acorn-bg-2 px-4 py-3">
            <p className="text-sm text-neutral-400">{publisher}</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default Popup
