// background.js
// Service worker (manifest v3) — mantemos simples.
// Podemos usar o background para orquestrar, mas neste boilerplate ele só loga.

console.log('[ext-bg] background service worker loaded');

chrome.runtime.onInstalled.addListener(() => {
  console.log('[ext-bg] installed');
});

// exemplo: listener simples para requisições de debug
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || !msg.action) return;
  if (msg.action === 'PING_BG') {
    sendResponse({ ok: true, ts: Date.now() });
  }
  // lembre-se de retornar true se quiser resposta assíncrona
});

