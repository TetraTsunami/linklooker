import OpenAI from "openai"
import type { ChatCompletionMessageParam } from "openai/resources"

import "./styles.css"

import { useEffect, useRef, useState } from "react"

import { getConfig } from "~defaults"

const Popup = () => {
  const [isDoneLoading, setIsDoneLoading] = useState(false)
  const [title, setTitle] = useState("")
  const [publisher, setPublisher] = useState("")
  const [imageUrl, setImageUrl] = useState("")
  const [description, setDescription] = useState("")
  const [aiSummary, setSummary] = useState("")
  const [imageType, setImageType] = useState("image-cover")
  const imageRef = useRef<HTMLImageElement>(null)

  /**
   * Sets the animation state to "open" when the image has loaded. This is to prevent the popup from opening before the image is ready.
   */
  const imageLoaded = () => {
    setIsDoneLoading(true)
    setImageType(getImageType())
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
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.tabs.sendMessage(tabs[0].id, { name: "DOMInfo" }, (resp) => {
          if (!resp) {
            window.close()
            return
          }
          if (resp.error) throw new Error(resp.error)
          const html = resp.html
          chrome.runtime.sendMessage(
            { name: "parseHTML", target: "background", url: tabs[0].url, html },
            (tagData) => {
              if (tagData.error)
                throw new Error("Error parsing HTML: " + tagData.error)
              if (!tagData.description && !tagData.body && !tagData.image) {
                throw new Error("No data found")
              }
              renderTagPopup(tagData)
              try {
                getOAIData(tagData, setSummary, tagData.title)
              } catch (e) {
                console.warn("Error getting OpenAI completion: ", e)
                setSummary("Error getting summary: " + e)
              }
            }
          )
        })
      })
    } catch (e) {
      setTitle("Error")
      setDescription(() => e)
      setIsDoneLoading(() => true)
    }
  }

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

  useEffect(() => {
    updatePopup()
  }, [])

  return (
    <div
      className={`popup flex flex-col items-center overflow-clip bg-acorn-bg-1 text-base text-white`}>
      {!isDoneLoading && <div className="loader" />}
      <div
        className={`flex flex-col overflow-y-auto max-w-full overscroll-none ${!isDoneLoading && "hidden"}`}
        style={{ "--maxHeight": `700px` } as React.CSSProperties}>
        <img // In Firefox, CSP may block the image if the img tag is created with a src attribute. We can't do {imageUrl && ...} nonsense here.
          onLoad={imageLoaded}
          src={imageUrl} // This is blank initially and reset to be blank occasionally, so it should be fine.
          ref={imageRef}
          className={imageType}
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
            {aiSummary && formatSummary(aiSummary)}
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
