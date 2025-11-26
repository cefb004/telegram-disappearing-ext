/* ========================= content.js ========================= */
// Injects inject.js into the page context so functions live on window and
// can be executed directly from the Console (F12). This keeps our logic
// running as if it were part of the Telegram Web page.


(function () {
try {
const script = document.createElement('script');
script.src = chrome.runtime.getURL('inject.js');
script.id = 'tg-selfdestruct-injector';
script.onload = function () {
console.log('[EXT] inject.js loaded');
this.remove(); // remove script tag after injection to keep DOM clean
};
(document.head || document.documentElement).appendChild(script);
} catch (err) {
console.error('[EXT] Failed to inject script', err);
}


// Optional: listen for messages from inject.js if you want the service
// worker (background) to be able to control timers or clear all messages.
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
if (msg && msg.type === 'EXT_LOG') {
console.log('[EXT background message]', msg.payload);
sendResponse({ok: true});
}


// keep channel open for async
return true;
});
})();
