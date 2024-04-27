import cssText from "data-text:~style.css"
import { useEffect, useState } from "react";
import { sendToBackground } from "@plasmohq/messaging"
import { Readability } from "@mozilla/readability";
import OpenAI from 'openai';
import { env } from "process";
 
export const getStyle = () => {
  const style = document.createElement("style")
  style.textContent = cssText
  return style
}

const openai = new OpenAI({
    apiKey: env.OPENAI_API_KEY, 
    dangerouslyAllowBrowser: true, // it is a browser extension so this is fine
  });

let hoverTarget: Element | undefined = null;

const summaryPopup = () => {
    const [position, setPosition] = useState({top: 0, left: 0});
    const [visible, setVisible] = useState(false);
    const [title, setTitle] = useState("");
    const [images, setImages] = useState([]);
    const [description, setDescription] = useState("");
    
    const movePopup = (target: Element) => {
        // position at bottom left of target
        setPosition({
            top: target.getBoundingClientRect().bottom,
            left: target.getBoundingClientRect().left
        })
    }

    const updatePopup = async () => {
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
        setImages([resp.meta.image]);
        setVisible(true);
        // Prepare to send off to OpenAI
        const reader = new Readability(new DOMParser().parseFromString(resp.html, "text/html"))
        const parsed = reader.parse();
        await getOpenAICompletion(parsed.textContent.slice(0, 50), setDescription);

    }

    const getOpenAICompletion = async (input: string, output: React.Dispatch<React.SetStateAction<string>>) => {
        console.log('getting completion');
        const stream = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [{role: "system", content: 'Generate a descriptive short summary for the following web page content, avoiding clickbait, advertising or sensationalism; merely try to concisely summarize the page.'}, { role: "user", content: input }],
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
        <div className={`fixed max-w-[500px] rounded-xl text-white bg-gray-800/50 backdrop-blur-xl p-2 text-base shadow-i-lg ${visible ? "hover-popup" : ""}`}
                style={{top: position.top,left: position.left, display: visible ? "block" : "block", width: "150px", height: "150px"}}>
                {images[0] && <img src={images[0].url} />}
                {title && <h1 className="text-lg font-bold">{title}</h1>}
                {description && <p>{description}</p>}
        </div>
    )
}

console.log('content script loaded!');

export default summaryPopup;