/* ========================= background.js ========================= */
// Minimal background/service worker. Keeps a default TTL in storage and
// listens to commands from the extension UI (if you add one later).


chrome.runtime.onInstalled.addListener(() => {
chrome.storage.local.set({ tg_sd_default_ttl: 5 }, () => {
console.log('[EXT background] Installed and default TTL set to 5s');
});
});


chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
if (msg && msg.type === 'GET_DEFAULT_TTL') {
chrome.storage.local.get('tg_sd_default_ttl', (res) => {
sendResponse({ ttl: res.tg_sd_default_ttl || 5 });
});
return true; // indicates async sendResponse
}


if (msg && msg.type === 'SET_DEFAULT_TTL') {
chrome.storage.local.set({ tg_sd_default_ttl: msg.ttl }, () => {
sendResponse({ ok: true });
});
return true;
}


// generic log
if (msg && msg.type === 'LOG') {
console.log('[EXT bg LOG]', msg.payload);
sendResponse({ ok: true });
}
});
