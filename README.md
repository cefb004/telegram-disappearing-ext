# Telegram Web A - SelfDestruct Simulator Extension


This Chrome extension simulates self-destructing photos in Telegram Web A. It is purely visual and local — the images are removed from the chat interface after a timer, but **other users do not see the photos disappear** and the server is not affected.


## Features
- Injects a script into Telegram Web A to simulate self-destructing photos.
- Provides a global function to send images with a timer via the Console (F12).
- Works entirely in the browser, no backend required.
- Supports both remote image URLs and local files (via file picker).


## Files
- `manifest.json` — Chrome extension manifest.
- `content.js` — injects the helper script into the Telegram page.
- `inject.js` — defines the global functions to simulate self-destructing photos.
- `background.js` — optional service worker, stores default TTL and handles messages.


## Usage
1. Load the extension:
- Go to `chrome://extensions/`.
- Enable *Developer mode*.
- Click **Load unpacked** and select the extension folder.


2. Open Telegram Web A: `https://web.telegram.org/`.


3. Open DevTools (F12) and run:


```js
// Send image from URL with a timer in seconds
sendSelfDestruct('https://i.imgur.com/your-image.jpg', 5);


// Or select a local file and set timer (seconds)
sendSelfDestructFromFile(7);
```


4. The image will appear in the chat, start a countdown, and then be removed/replaced with a "This photo has been destroyed" message.


## Notes
- The effect is **local only**; other participants will still see the image.
- Reloading the page restores the state (the extension does not persist images).
