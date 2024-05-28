export const defaultSettings = {
  baseURL: "https://api.openai.com/v1/",
  model: "gpt-3.5-turbo",
  prompt:
    "Generate a concise and to the point summary for the following content. Do not begin with 'The article...' or similar. Make sure the summary relates to the context snippet provided.",
  inputTokens: 1000,
  outputTokens: 200,
  aiThreshold: 200,
}