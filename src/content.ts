import { Storage } from "@plasmohq/storage"
import { sendToBackground } from "@plasmohq/messaging"


let hoverTarget: Element | undefined = null;


console.log('content script loaded!');


const findPopup = () => {
    if (document.getElementById('max-hover-div')) {
        return;
    }
    const newDiv = document.createElement("div");
    const style = "position: fixed; max-width: 500px; border-radius: 10px; padding: 5px; font-size: 12px; border: 1px solid grey; background-color: black; pointer-events: none;"
    newDiv.setAttribute('style', style);
    newDiv.style.visibility = 'hidden';
    newDiv.id = "max-hover-div"
    return document.body.appendChild(newDiv);
}
let popup = findPopup();
const movePopup = (target: Element) => {
    // position at bottom left of target
    popup.style.top = `${target.getBoundingClientRect().bottom}px`;
    popup.style.left = `${target.getBoundingClientRect().left}px`;
}

const updatePopup = async () => {
    let url = hoverTarget.getAttribute('href');
    if (!url) {
        return;
    }
    popup.innerHTML = `<h1>Loading...</h1>`;
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
        popup.innerHTML = `<h1>Error</h1><p>${resp.error}</p>`;
        return;
    }
    popup.innerHTML = `<h1>${resp.meta.title}</h1><p>${resp.meta.description}</p>`;
}

document.addEventListener('mouseover', (event) => {
    hoverTarget = (event.target as Element).closest('a');
});


window.addEventListener('keydown', async (event) => {
  if (event.key === 'Control' && hoverTarget) {
    if (!hoverTarget) {
        return;
    }
    popup.style.visibility = 'visible';
    movePopup(hoverTarget);
    await updatePopup();
  }
});