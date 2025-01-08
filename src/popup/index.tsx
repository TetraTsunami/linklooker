import "./styles.css"
import { useEffect, useRef, useState } from "react"
import { formatSummary, getImageType, getOAIData } from "~util"

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
    setImageType(getImageType(imageRef, imageUrl))
  }

  function renderTagPopup(tagData: {
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
      setTitle("Error");
      setDescription(() => e);
      setIsDoneLoading(() => true);
    }
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
