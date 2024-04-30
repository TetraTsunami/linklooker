import cssText from "data-text:~style.css"
import { useEffect, useState } from "react";
import { sendToBackground } from "@plasmohq/messaging"
import { Readability } from "@mozilla/readability";
import OpenAI from 'openai';
import type { ChatCompletionMessageParam } from "openai/resources";
import { Storage } from "@plasmohq/storage";
 
export const getStyle = () => {
  const style = document.createElement("style")
  style.textContent = cssText
  return style
}

const settings = new Storage()

let hoverTarget: Element | undefined = null;

const summaryPopup = () => {
    const [position, setPosition] = useState({top: 0, left: 0} as {top?: number, left?: number, right?: number, bottom?: number});
    const [visible, setVisible] = useState(false);
    const [title, setTitle] = useState("");
    const [images, setImages] = useState([]);
    const [imageLoaded, setImageLoaded] = useState(false);
    const [description, setDescription] = useState("");
    
    const movePopup = (target: Element) => {
        // Decide where to place
        const bounds = target.getBoundingClientRect();
        const vertical = bounds.top < window.innerHeight / 2 ? {top: bounds.bottom} : {bottom: window.innerHeight - bounds.top}
        const horizontal = bounds.right < window.innerWidth / 2 ? {left: bounds.left} : {right: window.innerWidth - bounds.right}
        setPosition({...vertical, ...horizontal});
    }

    const updatePopup = async () => {
        setImageLoaded(false);
        let url = hoverTarget.getAttribute('href');
        if (!url || url.startsWith('#') || url.startsWith('javascript')) {
            return;
        }
        if (url.startsWith('/')) {
            url = window.location.origin + url;
        }
        setDescription("")
        // Send url to background script to fetch data + summary
        const resp = await sendToBackground({
        name: "scrape",
            body: {
                url
            }
        })
        // Basic data obtained, fill in popup
        if (resp.error) {
            setTitle("Error fetching data");
            setDescription(`${resp.error}`);
            return;
        }
        setTitle(resp.meta.title);
        setDescription(resp.meta.description + "\n");
        setImages([resp.meta.image]);
        setVisible(true);
        // Prepare to send off to OpenAI
        const reader = new Readability(new DOMParser().parseFromString(resp.html, "text/html"))
        const parsed = reader.parse();
        const messages = [{role: "system", content: 'Generate a descriptive short summary for the following web page content, avoiding clickbait, advertising or sensationalism; merely try to concisely summarize the page.'}, { role: "user", content: parsed.textContent.slice(0, 50) }, { role: "assistant", content: resp.meta.description}] as ChatCompletionMessageParam[];
        await streamOpenAICompletion(messages, setDescription).catch((e) => setDescription((prev) => prev + "\n" + "Error fetching data: " + e));

    }

    const streamOpenAICompletion = async (messages: ChatCompletionMessageParam[], output: React.Dispatch<React.SetStateAction<string>>) => {
        const openai = new OpenAI({
            apiKey: await settings.get("openai-api"),
            dangerouslyAllowBrowser: true, // it is a browser extension so this is fine
        });
        
        const stream = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: messages,
            stream: true,
            max_tokens: 50 
        });
        for await (const chunk of stream) {
            if (!chunk.choices[0].delta) continue;
            output((prev) => prev + chunk.choices[0].delta.content);
        }
    }

    useEffect(() => {
        const callback = (event) => {
            hoverTarget = (event.target as Element).closest('a');
        }
        document.addEventListener('mouseover', callback);
        return () => {
            document.removeEventListener('mouseover', callback);
        }
    })

    useEffect(() => {
        const callback = async (event) => {
            if (event.key === 'Control' && hoverTarget) {
                if (!hoverTarget) {
                    return;
                }
                setVisible(false);
                movePopup(hoverTarget);
                await updatePopup();
            }
        }
        window.addEventListener('keydown', callback);
        return () => {
            window.removeEventListener('keydown', callback);
        }
    })

    useEffect(() => {
        const callback = (event) => {
            if (event.target !== hoverTarget) {
                setVisible(false);
            }
        }
        window.addEventListener('scroll', callback);
        return () => {
            window.removeEventListener('scroll', callback);
        }
    })

    return (
        <div className={`fixed min-h-8 w-[500px] overflow-clip rounded-xl text-white bg-gray-800/60 backdrop-blur-md text-base shadow-i-lg ${visible && imageLoaded ? "hover-popup" : ""}`}
                style={{top: position.top, left: position.left, right: position.right, bottom: position.bottom, display: visible && imageLoaded ? "block" : "block"}}>
                {images[0] && <img onLoad={() => setImageLoaded(true)} src={images[0].url} className="max-h-[200px] w-full object-cover"/>}
                {title && <h1 className="px-4 py-2 text-lg font-bold">{title}</h1>}
                {description && (
                    <div className="flex flex-col gap-2 px-4 pb-4">
                        {description.split("\n").map((content) => (<p key={content.slice(0, 10)}>{content}</p>))}
                    </div>
                )}
        </div>
    )
}

console.log('content script loaded!');

export default summaryPopup;