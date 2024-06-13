import { Storage } from "@plasmohq/storage"

export const defaultSettings = {
  baseURL: "https://api.openai.com/v1/",
  model: "gpt-3.5-turbo",
  prompt:
  "Generate a concise and to the point bulleted summary for the following content. Make sure the summary relates to the context snippet provided.",
  inputTokens: 1000,
  outputTokens: 150,
  aiThreshold: 300,
  };
  
const settings = new Storage()
  
export const getConfig = async () => {
  const config = {
    apiKey: await settings.get("openai-key"),
    baseURL: (await settings.get("openai-baseURL")) || defaultSettings.baseURL,
    model: (await settings.get("openai-model")) || defaultSettings.model,
    prompt: (await settings.get("system-prompt")) || defaultSettings.prompt,
    inputTokens: parseInt(await settings.get("input-tokens")) ||
      defaultSettings.inputTokens,
    outputTokens: parseInt(await settings.get("output-tokens")) ||
      defaultSettings.outputTokens,
    aiThreshold: parseInt(await settings.get("ai-threshold")) ||
      defaultSettings.aiThreshold
  }
  return config
}
