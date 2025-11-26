console.log("[ext] content script loaded");

function injectNow() {
  const s = document.createElement("script");
  s.src = chrome.runtime.getURL("inject.js");
  s.setAttribute("data-injected-by", "tg-ext");
  s.onload = () => {
    console.log("[ext] inject.js injected (stable)");
  };
  (document.head || document.documentElement).appendChild(s);
}

// reinjeta se o Telegram substituir <head> ou <html>
const persistentObserver = new MutationObserver(() => {
  // se o script sumiu -> reinjeta
  const already = document.querySelector('script[data-injected-by="tg-ext"]');
  if (!already) {
    injectNow();
  }
});

// vigia o documento INTEIRO, incluindo troca completa de html/head
persistentObserver.observe(document.documentElement, {
  childList: true,
  subtree: true,
});

// INJEÇÃO INICIAL
injectNow();

