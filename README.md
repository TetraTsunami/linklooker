<p align="center"><img src="assets/icon.png" width="128" height="128"></p>

# LinkLooker

<a href="https://chromewebstore.google.com/detail/linklooker/madknadnoiflomiheamlcmfbnbmlccik"><img src="https://storage.googleapis.com/web-dev-uploads/image/WlD8wC6g8khYWPJUsQceQkhXSlv1/UV4C4ybeBTsZt43U4xis.png" alt="Chrome Web Store badge" height="58" width="206"></a>
<a href="https://addons.mozilla.org/en-US/firefox/addon/linklooker"><img src="https://github.com/TetraTsunami/linklooker/assets/78718829/12854354-5e31-44a4-8c04-16df212c8a37" alt="Firefox Add-Ons badge" height="58"></a>

## What is it?
This is a browser extension inspired by the hover-to-summarize-link features of some browsers. To use it, hover the cursor over a link and press `shift`.

It grabs the title, publisher-provided summary, and cover image using HTML tags on the targeted page, and it can send a user-configurable amount of the page content to an OpenAI endpoint for further summary (pending configuration of an API key in the settings).

![chrome_9RspIFOUo1](https://github.com/TetraTsunami/linklooker/assets/78718829/17589af9-64af-4b4e-8d7a-964114b697bb)

## How can I build it?
This extension is developed using Plasmo, a framework for building browser extensions. To build this extension, you need to have Node.js and pnpm installed on your machine. Then, you can run the following command to build the extension:

```bash
pnpm install && pnpm build
```

This will create a `./build` folder containing builds for Chrome and Firefox.