import { useStorage } from "@plasmohq/storage/hook"
import "./style.css"

function IndexOptions() {
  const [apiKey, setApiKey] = useStorage("openai-key")
  const [baseURL, setBaseURL] = useStorage("openai-baseURL", "https://api.openai.com/v1")
  const [model, setModel] = useStorage("openai-model", "gpt-3.5-turbo")
  const [prompt, setPrompt] = useStorage("system-prompt", "Generate a descriptive short summary for the following web page content, avoiding clickbait, advertising or sensationalism; merely try to concisely summarize the page.")

  return (
    <div className="w-[512px] bg-gray-800 p-4 text-white"> 
      <h1 className="mb-4 text-xl font-semibold">Options</h1>
      <div id="optionsGrid">
        <label htmlFor="key">API Key</label>
        <input type="password" id="key" value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
        <label htmlFor="baseURL">Base URL</label>
        <input id="baseURL" value={baseURL} onChange={(e) => setBaseURL(e.target.value)} />
        <label htmlFor="model">Model Name</label>
        <input id="model" value={model} onChange={(e) => setModel(e.target.value)} />
        <label htmlFor="prompt">Prompt</label>
        <textarea className="h-32" id="prompt" value={prompt} onChange={(e) => setPrompt(e.target.value)} />
      </div>
    </div>
  )
}

export default IndexOptions