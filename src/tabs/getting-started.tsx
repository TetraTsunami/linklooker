import { useEffect, useState } from "react"
import "./styles.css"
import icon from "data-base64:/assets/icon.png"
import { useStorage } from "@plasmohq/storage/hook"

import ContentPopup from "../contents/index"

function FakePopup() {
  const [animationState, setAnimationState] = useState("opening")
  useEffect(() => {
    setTimeout(() => setAnimationState("open"), 800)
  })
  return (
    <div className="hover-popup mx-auto min-h-8 w-[600px] overflow-hidden rounded-xl bg-gray-800/60 text-base text-white shadow-i-sm backdrop-blur-md">
      {animationState == "opening" && <div className="loader" />}
      {animationState == "open" && (
        <div className="inner-popup flex flex-col" style={{"--maxHeight": "500px"} as React.CSSProperties}>
          <img className="image-contain" src={icon} />
          <div className="flex flex-col gap-2 px-4 pb-4 pt-2">
            <h1 className="mb-4 text-4xl font-bold">Welcome to LinkLooker!</h1>
            <p>
              LinkLooker is a browser extension that helps you preview links before you click on them. Hover over almost any link to see a preview of the content behind it!
            </p>
            <div className="summary relative flex flex-col gap-2 italic">
              <p>
                If you configure an OpenAI API key, you can also get an AI-generated summary of the content!
              </p>
            </div>
          </div>
          <div className="w-full bg-gray-700/50 p-4 pt-3">
            <p className="text-sm text-gray-400">Brought to you by <a href="https://tsuni.dev">Tsuni</a></p>
          </div>
        </div>
      )}
    </div>
  )
}

function BaseOptions() {
  const [apiKey, setApiKey] = useStorage("openai-key", "")

  return (<fieldset>
    <legend>Options</legend>
    <div className="options-grid">
      <label htmlFor="key">OpenAI API Key</label>
      <input
        type="password"
        id="key"
        value={apiKey}
        onChange={(e) => setApiKey(e.target.value)} />
    </div>
    <p className="italic">The model recieves the text of the hovered link and the beginning of the content text.</p>
  </fieldset>)
}

const APIGuide = () => (
  <details className="w-full overflow-hidden">
    <summary className="text-xl font-semibold">How Do I Get An API Key??</summary>
    <ol className="flex list-decimal flex-col items-start gap-3 ps-[40px]">
      <li>Go to <a className="text-blue-400 underline" href="https://platform.openai.com/signup">OpenAI's website</a> and sign up for an account.</li>
      <img className="rounded-xl shadow-i-sm" src="https://cloud.tsuni.dev/f/fa86976461b14a71aaaf/?dl=1" alt="OpenAI API key creation modal with red markers indicating steps to access it" />
      <li>Once you're logged in, go to the <a className="text-blue-400 underline" href="https://platform.openai.com/account/api-keys">API keys page</a>.</li>
      <li>Click the "Create New Secret Key" button.</li>
      <li>Give your key a name and click "Create".</li>
      <li>Copy the key and paste it into the input above.</li>
    </ol>
  </details>
)


function GettingStartedPage() {
  const [animationState, setAnimationState] = useState("opening")
  useEffect(() => {
    setTimeout(() => setAnimationState("open"), 1600)
  })
  return (
    <main
      className="min-h-screen bg-neutral-800 text-lg text-white">
      <ContentPopup />
      <div className="container mx-auto flex flex-col items-center gap-12 p-4">
        <div className="h-[340px]">
          <FakePopup />
        </div>
        {animationState == "open" && <div className="inner-popup flex flex-col items-center gap-16" 
          style={{"--maxHeight": "10000px"} as React.CSSProperties}>
          <section className="flex flex-col items-center gap-4">
            <h1 className="text-4xl font-semibold">First Things First...</h1>
            <p>This extension works much better once it's configured.</p>
            <BaseOptions />
            <APIGuide />
          </section>
          <section className="flex max-w-prose flex-col items-center gap-4">
            <h1 className="text-4xl font-semibold">How Does It Work?</h1>
            <p>Most websites already provide titles, cover images, and descriptions for their pages. Usually, you only see them when you post a link on social media, like Discord or Twitter. This extension uses that information to create a popup when you hover over a link. If you add an OpenAI API key, this extension also extracts some of the article text on the page, and sends that to OpenAI for further summary. You can always tell the difference between the description provided by the page and the AI's description by the different styles of text in the popup.</p>
          </section>
          <section className="flex max-w-prose flex-col items-center gap-4">
            <h1 className="text-4xl font-semibold">Try It Out!</h1>
            <p>Here are some pages to try out the extension on (you can use it here, or open the pages yourself):</p>
            <p>Hover over the links with your mouse, and press the SHIFT key on your keyboard.</p>
            <ul className="flex list-disc flex-col gap-2">
              <li><a className="text-blue-400 underline hover:animate-pulse" href="https://www.theverge.com/2019/5/21/18634195/t-mobile-sprint-merger-conditions-access-coverage">An article with lots of links</a></li>
              <li><a className="text-blue-400 underline hover:animate-pulse" href="https://www.visitmadison.com/things-to-do/attractions/">Things to do in Madison, WI</a></li>
              <li><a className="text-blue-400 underline hover:animate-pulse" href="https://en.wikipedia.org/wiki/Tetra">A wikipedia page</a></li>
            </ul>
          </section>
          <section className="flex max-w-prose flex-col items-center gap-4">
            <h1 className="text-4xl font-semibold">Need Help?</h1>
            <p>This extension doesn't work on PDFs, links to different sections of the current page, or while you're on Wikipedia (they already have popups). Also, there are a lot more options available in the <a className="cursor-pointer text-blue-400 underline" onClick={() => chrome.runtime.openOptionsPage()}>settings</a> page of this extension.</p>
            <p>If you have any questions or need help, feel free to open an issue on <a className="text-blue-400 underline" href="https://github.com/TetraTsunami/linklooker/issues">Github</a>!</p>
          </section>
        </div>}
      </div>
    </main>
  )
}
 
export default GettingStartedPage