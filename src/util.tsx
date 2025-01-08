import type { MutableRefObject } from "react"
import OpenAI from "openai"
import type { ChatCompletionMessageParam } from "openai/resources"
import { getConfig } from "~defaults"

export function getImageType(
  imageRef: MutableRefObject<HTMLImageElement>,
  imageUrl: string
): "image-contain" | "image-cover" {
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

export function formatSummary(summary: string) {
  const lines = summary.split("\n").map((line) => line.replace(/^\s*-\s*/, ""))
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

export async function getOAIData(
  tagData: {
    title: string
    description: string
    body: string
    forceSummary: boolean
  },
  output: (value: React.SetStateAction<string>) => void,
  context?: string
) {
  const config = await getConfig()
  if (!tagData.body) {
    return
  } // Not much to summarize, innit?
  if (!config.apiKey) {
    return
  } // Skip if we don't have an API key
  if (
    !tagData.forceSummary &&
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
