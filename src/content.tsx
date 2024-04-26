import { sendToBackground } from "@plasmohq/messaging"
import { useEffect, useState } from "react";
import cssText from "data-text:~style.css"
 
export const getStyle = () => {
  const style = document.createElement("style")
  style.textContent = cssText
  return style
}

let hoverTarget: Element | undefined = null;

const summaryPopup = () => {
    const [position, setPosition] = useState({top: 0, left: 0});
    const [data, setData] = useState("");
    
    const movePopup = (target: Element) => {
        // position at bottom left of target
        setPosition({
            top: target.getBoundingClientRect().bottom,
            left: target.getBoundingClientRect().left
        })
    }

    const updatePopup = async () => {
        let url = hoverTarget.getAttribute('href');
        if (!url) {
            return;
        }
        setData("Loading...")
        if (url.startsWith('/')) {
            url = window.location.origin + url;
        }
        // Send url to background script to fetch data + summary
        const resp = await sendToBackground({
        name: "scrape",
            body: {
                url
            }
        })
        console.log(resp);
        if (resp.error) {
            setData(`<h1>Error</h1><p>${resp.error}</p>`);
            return;
        }
        setData(`<h1>${resp.meta.title}</h1><p>${resp.meta.description}</p>`);
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
                movePopup(hoverTarget);
                await updatePopup();
            }
        }
        window.addEventListener('keydown', callback);
        return () => {
            window.removeEventListener('keydown', callback);
        }
    })

    return (
        <div className="pointer-events-none fixed max-w-[500px] rounded-lg border border-gray-500 bg-black p-2 text-lg" 
            style={{top: position.top,left: position.left}}>
            {data}
        </div>
    )
}

console.log('content script loaded?');

export default summaryPopup;