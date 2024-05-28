import { useStorage } from "@plasmohq/storage/hook"

import "./styles.css"

import { useState } from "react"
import { defaultSettings } from "~defaults"

const placeholderText = `In publishing and graphic design, Lorem ipsum is a placeholder text commonly used to demonstrate the visual form of a document or a typeface without relying on meaningful content. Lorem ipsum may be used as a placeholder before the final copy is available. It is also used to temporarily replace text in a process called greeking, which allows designers to consider the form of a webpage or publication, without the meaning of the text influencing the design.

Lorem ipsum is typically a corrupted version of De finibus bonorum et malorum, a 1st-century BC text by the Roman statesman and philosopher Cicero, with words altered, added, and removed to make it nonsensical and improper Latin. The first two words themselves are a truncation of dolorem ipsum ("pain itself").

Versions of the Lorem ipsum text have been used in typesetting at least since the 1960s, when it was popularized by advertisements for Letraset transfer sheets. Lorem ipsum was introduced to the digital world in the mid-1980s, when Aldus employed it in graphic and word-processing templates for its desktop publishing program PageMaker. Other popular word processors, including Pages and Microsoft Word, have since adopted Lorem ipsum, as have many LaTeX packages, web content managers such as Joomla! and WordPress, and CSS libraries such as Semantic UI.`

function IndexOptions() {
  const [apiKey, setApiKey] = useStorage("openai-key", "")
  const [baseURL, setBaseURL] = useStorage("openai-baseURL", defaultSettings.baseURL)
  const [model, setModel] = useStorage("openai-model", defaultSettings.model)
  const [prompt, setPrompt] = useStorage("system-prompt", defaultSettings.prompt)
  const [inputTokens, setInputTokens] = useStorage(
    "input-tokens",
    defaultSettings.inputTokens
  )
  const [outputTokens, setOutputTokens] = useStorage(
    "output-tokens",
    defaultSettings.outputTokens
  )
  const [aiThreshold, setAIThreshold] = useStorage(
    "ai-threshold",
    defaultSettings.aiThreshold
  )
  const [inputTokenCost, setInputTokenCost] = useState(0.5) // Per million tokens
  const [outputTokenCost, setOutputTokenCost] = useState(1.5)

  function BaseOptions() {
    return (<fieldset>
      <legend>Options</legend>
      <div className="options-grid">
        <label htmlFor="key">API Key</label>
        <input
          type="password"
          id="key"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)} />
        <label htmlFor="baseURL">Base URL</label>
        <input
          id="baseURL"
          value={baseURL}
          onChange={(e) => setBaseURL(e.target.value)} />
        <label htmlFor="model">Model Name</label>
        <input
          id="model"
          value={model}
          onChange={(e) => setModel(e.target.value)} />
        <label htmlFor="prompt">Prompt</label>
        <textarea
          id="prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)} />
      </div>
      <p className="italic">The model recieves the text of the hovered link and the beginning of the content text.</p>
    </fieldset>)
  }

  function TokenOptions() {
    return (<fieldset>
      <legend>Tokens</legend>
      <div className="options-grid">
        <label htmlFor="input-tokens">Input Tokens</label>
        <input
          id="input-tokens"
          value={inputTokens || 0}
          onChange={(e) => setInputTokens(parseInt(e.target.value))} />
        <label htmlFor="output-tokens">Output Tokens</label>
        <input
          id="output-tokens"
          value={outputTokens || 0}
          onChange={(e) => setOutputTokens(parseInt(e.target.value))} />
        <label htmlFor="summary-thresh">AI Summary Threshold</label>
        <input
          id="summary-thresh"
          value={aiThreshold || 0}
          onChange={(e) => setAIThreshold(parseInt(e.target.value))} />
      </div>
      <p className="italic">
        Some websites have a long description that might be "good enough" as a summary. If the site's description is longer than the threshold, the extension will skip calling the AI for a summary.
      </p>
      <h2 className="text-lg font-semibold">Examples:</h2>
      <p className="italic">
        These examples help you get an idea of what the model will "see". The
        language model may choose to stop summarizing earlier than the maximum
        output tokens.
      </p>
      <p>Input: {placeholderText.slice(0, inputTokens * 3) + "..."}</p>
      <p>Output: {placeholderText.slice(0, outputTokens * 3) + "..."}</p>
      <p>Threshold: {placeholderText.slice(0, aiThreshold) + "..."}</p>
      <p className="italic">
        This extension uses an estimate of ~3 characters per token.
      </p>
    </fieldset>)
  }

  function CostCalculator() {
    return (<fieldset>
      <legend>Cost Calculator</legend>
      <a href="https://openai.com/api/pricing/" className="underline">
        OpenAI pricing
      </a>
      <div className="options-grid">
        <label htmlFor="input-token-cost">Input Token Cost</label>
        <span>
          $
          <input
            id="input-token-cost"
            value={inputTokenCost}
            onChange={(e) => setInputTokenCost(parseFloat(e.target.value))} />
          /1M tokens
        </span>
        <label htmlFor="output-token-cost">Output Token Cost</label>
        <span>
          $
          <input
            id="output-token-cost"
            value={outputTokenCost}
            onChange={(e) => setOutputTokenCost(parseFloat(e.target.value))} />
          /1M tokens
        </span>
      </div>
      <div className="options-grid">
        <p>Input Tokens</p>
        <p>{`(${Math.ceil(prompt.length / 3)} tokens prompt + ${inputTokens} tokens page data + ${Math.ceil(aiThreshold / 3)} tokens page description + ~18 tokens title) * $${inputTokenCost.toFixed(2)} / 1M`}</p>
        <p>Output Tokens</p>
        <p>{`${outputTokens} tokens * $${outputTokenCost.toFixed(2)} / 1M`}</p>
      </div>
      <p>{`= ~$${(((Math.ceil(prompt.length / 3) + inputTokens + Math.ceil(aiThreshold / 3) + 18) * inputTokenCost) / 1e6 + (outputTokens * outputTokenCost) / 1e6).toPrecision(3)} per summarization`}</p>
      <p className="italic">
        This number is an estimate assuming one token roughly equals 3 characters.
        The extension sends the article title and prewritten summary to the summarization
        endpoint, in addition to the chosen amount of article text and system prompt.
      </p>
    </fieldset>)
  }

  return (
    <main className="bg-neutral-800 text-white">
      {BaseOptions()}
      {TokenOptions()}
      {CostCalculator()}
      <a
        href="https://github.com/TetraTsunami/linklooker"
        className="text-blue-500 underline"
      >
        Report bugs or suggest features
      </a>
    </main>
  )
}

export default IndexOptions
