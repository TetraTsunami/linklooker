import { useStorage } from "@plasmohq/storage/hook"

import "./styles.css"

import { useState } from "react"

const defaults = {
  baseURL: "https://api.openai.com/v1/",
  model: "gpt-3.5-turbo",
  prompt:
    "Generate a concise and to the point summary for the following content. Do not begin with 'The article...' or similar. Make sure the summary relates to the context snippet provided.",
  inputTokens: 300,
  outputTokens: 100
}

const placeholderText = `In publishing and graphic design, Lorem ipsum is a placeholder text commonly used to demonstrate the visual form of a document or a typeface without relying on meaningful content. Lorem ipsum may be used as a placeholder before the final copy is available. It is also used to temporarily replace text in a process called greeking, which allows designers to consider the form of a webpage or publication, without the meaning of the text influencing the design.

Lorem ipsum is typically a corrupted version of De finibus bonorum et malorum, a 1st-century BC text by the Roman statesman and philosopher Cicero, with words altered, added, and removed to make it nonsensical and improper Latin. The first two words themselves are a truncation of dolorem ipsum ("pain itself").

Versions of the Lorem ipsum text have been used in typesetting at least since the 1960s, when it was popularized by advertisements for Letraset transfer sheets. Lorem ipsum was introduced to the digital world in the mid-1980s, when Aldus employed it in graphic and word-processing templates for its desktop publishing program PageMaker. Other popular word processors, including Pages and Microsoft Word, have since adopted Lorem ipsum, as have many LaTeX packages, web content managers such as Joomla! and WordPress, and CSS libraries such as Semantic UI.`

function IndexOptions() {
  const [apiKey, setApiKey] = useStorage("openai-key", "")
  const [baseURL, setBaseURL] = useStorage("openai-baseURL", defaults.baseURL)
  const [model, setModel] = useStorage("openai-model", defaults.model)
  const [prompt, setPrompt] = useStorage("system-prompt", defaults.prompt)
  const [inputTokens, setInputTokens] = useStorage(
    "input-tokens",
    defaults.inputTokens
  )
  const [outputTokens, setOutputTokens] = useStorage(
    "output-tokens",
    defaults.outputTokens
  )
  const [inputTokenCost, setInputTokenCost] = useState(0.5) // Per million tokens
  const [outputTokenCost, setOutputTokenCost] = useState(1.5)

  return (
    <main className="bg-neutral-800 text-white">
      <fieldset>
        <legend>Options</legend>
        <div className="options-grid">
          <label htmlFor="key">API Key</label>
          <input
            type="password"
            id="key"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
          <label htmlFor="baseURL">Base URL</label>
          <input
            id="baseURL"
            value={baseURL}
            onChange={(e) => setBaseURL(e.target.value)}
          />
          <label htmlFor="model">Model Name</label>
          <input
            id="model"
            value={model}
            onChange={(e) => setModel(e.target.value)}
          />
          <label htmlFor="prompt">Prompt</label>
          <textarea
            id="prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />
        </div>
        <p className="italic">The model recieves the text of the hovered link and the beginning of the content text.</p>
      </fieldset>
      <fieldset>
        <legend>Tokens</legend>
        <div className="options-grid">
          <label htmlFor="input-tokens">Input Tokens</label>
          <input
            id="input-tokens"
            value={inputTokens || 0}
            onChange={(e) => setInputTokens(parseInt(e.target.value))}
          />
          <label htmlFor="output-tokens">Output Tokens</label>
          <input
            id="output-tokens"
            value={outputTokens || 0}
            onChange={(e) => setOutputTokens(parseInt(e.target.value))}
          />
        </div>
        <h2 className="text-lg font-semibold">Examples:</h2>
        <p className="italic">
          These examples help you get an idea of what the model will "see". The
          language model may choose to stop summarizing earlier than the maximum
          output tokens.
        </p>
        <p>Input: {placeholderText.slice(0, inputTokens * 3) + "..."}</p>
        <p>Output: {placeholderText.slice(0, outputTokens * 3) + "..."}</p>
        <p className="italic">
          This extension uses an estimate of ~3 characters per token.
        </p>
      </fieldset>
      <fieldset>
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
              onChange={(e) => setInputTokenCost(parseFloat(e.target.value))}
            />
            /1M tokens
          </span>
          <label htmlFor="output-token-cost">Output Token Cost</label>
          <span>
            $
            <input
              id="output-token-cost"
              value={outputTokenCost}
              onChange={(e) => setOutputTokenCost(parseFloat(e.target.value))}
            />
            /1M tokens
          </span>
        </div>
        <div className="options-grid">
          <p>System Prompt</p>
          <p>{`${Math.ceil(prompt.length / 3)} tokens * $${inputTokenCost.toFixed(2)} / 1M`}</p>
          <p>Input Tokens</p>
          <p>{`${inputTokens} tokens * $${inputTokenCost.toFixed(2)} / 1M`}</p>
          <p>Output Tokens</p>
          <p>{`${outputTokens} tokens * $${outputTokenCost.toFixed(2)} / 1M`}</p>
        </div>
        <p>{`= ~$${(((Math.ceil(prompt.length / 3) + inputTokens) * inputTokenCost) / 1e6 + (outputTokens * outputTokenCost) / 1e6).toPrecision(3)} per summarization`}</p>
        <p className="italic">
          This number is a lower estimate. The extension sends the article title
          and prewritten summary to the summarization endpoint, in addition to
          the article text and system prompt.
        </p>
      </fieldset>
    </main>
  )
}

export default IndexOptions
