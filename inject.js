// inject.js (patched) — peerId fixo + hookWebpackAll universal
// RODA NO CONTEXTO DA PÁGINA (acesso direto ao JS do Telegram Web)
(function () {
  const TAG = '[tg-inject]';
  const DEFAULT_CHAT = '5290484794';
  const MODULE_ID_PRIMARY = '41074';
  const MODULE_ID_ALT = '5130';

  function log(...a) { console.log(TAG, ...a); }
  function warn(...a) { console.warn(TAG, ...a); }
  function emitLog(obj) { window.postMessage({ __TG_INJECT_LOG__: obj }, '*'); }

  // tenta extrair connector/request de um módulo
  function tryGetConnectorFromModule(id) {
    try {
      const m = window.__tgInject && window.__tgInject.modules ? window.__tgInject.modules[id] : null;
      if (!m) return null;

      if (typeof m === 'function') {
        try {
          const exported = m();
          if (exported) {
            const c = findConnectorInExport(exported);
            if (c) return c;
          }
        } catch (e) {}
      }

      if (typeof m === 'object') {
        const c = findConnectorInExport(m);
        if (c) return c;
      }
    } catch (e) {}
    return null;
  }

  function findConnectorInExport(obj) {
    try {
      if (!obj || typeof obj !== 'object') return null;
      for (const k of Object.keys(obj)) {
        try {
          const v = obj[k];
          if (!v) continue;
          if (typeof v === 'object' && typeof v.request === 'function') return v;
          if (k.toLowerCase().includes('request') && typeof v === 'function') return { request: v.bind(obj) };
          if (k.toLowerCase().includes('connector') && typeof v === 'object' && typeof v.request === 'function') return v;
        } catch (e) {}
      }
      for (const k of Object.keys(obj)) {
        try {
          const v = obj[k];
          if (typeof v === 'object') {
            for (const k2 of Object.keys(v)) {
              try {
                const v2 = v[k2];
                if (typeof v2 === 'function' && k2.toLowerCase().includes('request')) return { request: v2.bind(v) };
                if (typeof v2 === 'object' && typeof v2.request === 'function') return v2;
              } catch (e) {}
            }
          }
        } catch (e) {}
      }
    } catch (e) {}
    return null;
  }

  // tenta enviar usando connector.request com vários payloads heurísticos
  async function trySendViaConnector(connector, blob, fileName, ttl, chat) {
    if (!connector || typeof connector.request !== 'function') return { ok: false, reason: 'no-request' };
    log('attempting send via connector.request');

    const tryPayloads = [
      { method: 'uploadMedia', params: { file: blob, fileName, ttl, chat } },
      { method: 'sendMedia', params: { file: blob, fileName, ttl, chat } },
      { method: 'sendMessage', params: { media: blob, fileName, ttl, chat } },
      { method: 'upload', params: { file: blob, fileName } },
      { method: 'media.upload', params: { file: blob, fileName } }
    ];

    for (const p of tryPayloads) {
      try {
        const res = connector.request(p.method, p.params);
        if (res && (res.then || res instanceof Promise)) {
          const r = await res;
          log('connector.request returned (promise):', p.method, r);
          return { ok: true, method: p.method, result: r };
        } else {
          log('connector.request returned (sync):', p.method, res);
          return { ok: true, method: p.method, result: res };
        }
      } catch (e) {
        log('connector.request attempt failed for', p.method);
      }
    }
    return { ok: false, reason: 'all-payloads-failed' };
  }

  // fallback: coloca o arquivo em input[type=file] e tenta clicar em send
  function fallbackInputUploadAndClick(blob, fileName, ttl) {
    const inputs = Array.from(document.querySelectorAll('input[type=file]'));
    if (!inputs.length) return { ok: false, reason: 'no-file-input' };
    inputs.sort((a,b) => {
      const rA = a.getBoundingClientRect();
      const rB = b.getBoundingClientRect();
      return (rB.width * rB.height) - (rA.width * rA.height);
    });
    const targetInput = inputs[0];
    const dt = new DataTransfer();
    dt.items.add(new File([blob], fileName || 'photo.jpg', { type: blob.type || 'image/jpeg' }));
    targetInput.files = dt.files;
    targetInput.dispatchEvent(new Event('change', { bubbles: true }));

    setTimeout(() => {
      const selectors = [
        'button[data-testid="send-button"]',
        'button.composer-send',
        'button[title*="Send"]',
        'button[aria-label*="Send"]',
        '.input-send .btn, .tgico-send, .btn-primary',
        'button[type="submit"]'
      ];
      for (const sel of selectors) {
        try {
          const el = document.querySelector(sel);
          if (el) {
            try { el.click(); log('clicked send button via selector', sel); break; } catch(e){}
          }
        } catch(e){}
      }
    }, 300);

    if (ttl) {
      setTimeout(() => {
        try {
          const btns = Array.from(document.querySelectorAll('button'));
          const match = btns.find(b => /self[- ]?destruct|timer|seconds|minutes/i.test(b.innerText) || b.innerText.includes(String(ttl)));
          if (match) { match.click(); log('clicked possible ttl button'); }
        } catch (e) {}
      }, 600);
    }

    return { ok: true, via: 'fallback_input_click' };
  }

  // função central: tenta internal -> fallback
  async function sendDisappearingPhoto({ fileName = 'photo.jpg', dataB64, ttl = 5, chat } = {}) {
    log('sendDisappearingPhoto called', { fileName, ttl, hasData: !!dataB64, chat });

    if (!dataB64) return { status: 'error', message: 'dataB64 missing' };

    const clean = ('' + dataB64).replace(/^data:.+;base64,/, '');
    let binary;
    try {
      binary = atob(clean);
    } catch (err) {
      log('base64 decode failed', err);
      return { status: 'error', message: 'invalid base64' };
    }
    const arr = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i);
    const blob = new Blob([arr], { type: 'image/jpeg' });

    const targetChat = chat || DEFAULT_CHAT;

    // 1) try module-specific connectors
    const connectorCandidates = [];
    const c1 = tryGetConnectorFromModule(MODULE_ID_PRIMARY);
    if (c1) connectorCandidates.push({ id: MODULE_ID_PRIMARY, connector: c1 });
    const c2 = tryGetConnectorFromModule(MODULE_ID_ALT);
    if (c2) connectorCandidates.push({ id: MODULE_ID_ALT, connector: c2 });

    // 2) scan first 500 modules for connectors as fallback
    if (!connectorCandidates.length && window.__tgInject && window.__tgInject.modules) {
      const keys = Object.keys(window.__tgInject.modules).slice(0, 500);
      for (const id of keys) {
        try {
          const c = tryGetConnectorFromModule(id);
          if (c) connectorCandidates.push({ id, connector: c });
          if (connectorCandidates.length >= 3) break;
        } catch (e) {}
      }
    }

    // 3) attempt each connector
    for (const cand of connectorCandidates) {
      try {
        const res = await trySendViaConnector(cand.connector, blob, fileName, ttl, targetChat);
        if (res && res.ok) {
          log('send via internal connector succeeded', cand.id, res);
          return { status: 'ok', via: 'internal_connector', moduleId: cand.id, result: res };
        }
      } catch (e) {
        log('connector invocation error', e);
      }
    }

    // 4) fallback DOM behavior
    const fallback = fallbackInputUploadAndClick(blob, fileName, ttl);
    return { status: 'fallback', result: fallback };
  }

  // abre picker e envia (usa DEFAULT_CHAT se não passar chat)
  function pickAndSendPhoto(ttl = 5, chat) {
    log("pickAndSendPhoto activated. TTL:", ttl);
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.style.display = "none";
    document.body.appendChild(input);
    input.addEventListener("change", function () {
      const file = input.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = function () {
        const base64 = reader.result;
        sendDisappearingPhoto({ fileName: file.name, dataB64: base64, ttl, chat: chat || DEFAULT_CHAT });
      };
      reader.readAsDataURL(file);
      document.body.removeChild(input);
    });
    input.click();
  }

  // expose API
  window.__tgInject = window.__tgInject || {};
  Object.assign(window.__tgInject, {
    sendDisappearingPhoto,
    pickAndSendPhoto,
    DEFAULT_CHAT,
    MODULE_ID_PRIMARY,
    MODULE_ID_ALT,
    modules: {},
    ready: false,
  });

  /* =======================================================================
       HOOK UNIVERSAL — captura todos os chunks webpackChunk*
     ======================================================================= */
  function hookWebpackAll() {
    const names = Object.keys(window).filter(k => k.startsWith("webpackChunk"));
    if (!names.length) {
      warn("Nenhum webpackChunk* detectado ainda");
      return;
    }

    log("hookWebpackAll: encontrando chunks:", names);

    names.forEach(name => {
      try {
        const chunk = window[name];
        // Alguns containers são objetos, outros arrays; lidamos com arrays e objects
        if (!chunk) return;

        // Se for array (padrão webpack chunk), monkeypatch push
        if (Array.isArray(chunk) && typeof chunk.push === 'function') {
          const origPush = chunk.push.bind(chunk);
          chunk.push = (args) => {
            try {
              const modules = args && args[1];
              if (modules) {
                for (const id in modules) {
                  window.__tgInject.modules[id] = modules[id];
                }
                window.__tgInject.ready = true;
              }
            } catch (e) {}
            return origPush(args);
          };
          log("Hook aplicado em (array):", name);
          return;
        }

        // Se for objeto container com .c (webpack 5 runtime), tentar extrair .c
        if (typeof chunk === 'object' && chunk.c && typeof chunk.c === 'object') {
          try {
            for (const id in chunk.c) {
              window.__tgInject.modules[id] = chunk.c[id];
            }
            // também hook em push se existir
            if (typeof chunk.push === 'function') {
              const origPush = chunk.push.bind(chunk);
              chunk.push = (args) => {
                try {
                  const modules = args && args[1];
                  if (modules) {
                    for (const id in modules) {
                      window.__tgInject.modules[id] = modules[id];
                    }
                    window.__tgInject.ready = true;
                  }
                } catch (e) {}
                return origPush(args);
              };
            }
            log("Hook aplicado em (obj container):", name);
          } catch (e) {}
        }
      } catch (e) {}
    });
  }

  // ativa o hook para capturar módulos lazy-loaded
  try {
    hookWebpackAll();
  } catch (e) {
    warn("hookWebpackAll failed", e);
  }

  /* =======================================================================
     SEARCH HELPER
     ======================================================================= */
  window.__tgInject.searchInModules = function (keywords = []) {
    const mods = this.modules;
    const results = [];

    for (const id in mods) {
      try {
        const txt = mods[id].toString();
        for (const kw of keywords) {
          if (txt.includes(kw)) {
            results.push({
              id,
              hit: kw,
              snippet: txt.slice(0, 300)
            });
            break;
          }
        }
      } catch (e) {}
    }

    console.log("[tg-inject] search results:", results);
    return results;
  };

  log('inject ready — use __tgInject.pickAndSendPhoto(ttl) or __tgInject.sendDisappearingPhoto({...})');
  emitLog({ event: 'ready' });

})();

