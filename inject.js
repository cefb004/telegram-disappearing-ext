/* ========================= inject.js ========================= */
// This file runs in page context (so it has access to the page's window and DOM
// as if it were part of the page). It exposes a global function `sendSelfDestruct`
// that you can call from the Console: sendSelfDestruct(imageUrlOrDataUrl, seconds)

(function () {
  if (window.__tg_selfdestruct_installed) return;
  window.__tg_selfdestruct_installed = true;

  console.log('[EXT inject] Self-destruct helper installed.');
  console.log("Usage: sendSelfDestruct(imageUrlOrDataUrl, seconds)\nExample: sendSelfDestruct('https://example.com/pic.jpg', 5)");

  // Default style for our fake message bubble (keeps visual separation)
  const STYLE_ID = 'tg-selfdestruct-style-v1';
  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .tg-sd-msg { display: inline-block; max-width: 60%; margin: 8px 0; border-radius: 12px; background: #e6f3ff; padding: 8px; box-shadow: 0 1px 0 rgba(0,0,0,0.06); }
      .tg-sd-img { max-width: 100%; border-radius: 8px; display:block; }
      .tg-sd-overlay { position: relative; margin-top: 4px; }
      .tg-sd-timer { position: absolute; right: 8px; top: 8px; background: rgba(0,0,0,0.6); color: white; padding: 4px 8px; border-radius: 12px; font-size: 12px; }
      .tg-sd-destroyed { font-style: italic; color: #888; padding: 6px; }
    `;
    document.head.appendChild(style);
  }

  // Utility: find the chat messages container. Telegram Web often uses
  // a div with role='log' or with a class containing 'chat' or 'message-list'.
  function findMessagesContainer() {
    // Try several heuristics (may need adjustment for Web A specifics)
    const candidates = [
      "[role='log']",
      "[data-testid='message-list']",
      ".messages-wrapper",
      ".im_history_messages_peer" // older selectors
    ];
    for (const sel of candidates) {
      const el = document.querySelector(sel);
      if (el) return el;
    }

    // fallback: try to find an element that looks like a message area by heuristics
    const divs = Array.from(document.querySelectorAll('div'));
    for (const d of divs) {
      // quick heuristic: many children and contains at least one <img>
      if (d.children.length > 5 && d.querySelector && d.querySelector('img')) return d;
    }
    return null;
  }

  // Creates and inserts a fake outgoing message with the image and timer.
  // imageSrc can be a remote URL or a data URL.
  function insertTimedImage(imageSrc, seconds) {
    const container = findMessagesContainer();
    if (!container) {
      console.warn('[EXT inject] Could not find messages container. You may need to adapt selectors for Telegram Web A.');
      return null;
    }

    // Create message wrapper
    const wrapper = document.createElement('div');
    wrapper.className = 'tg-sd-msg';

    // Image + overlay
    const overlay = document.createElement('div');
    overlay.className = 'tg-sd-overlay';

    const img = document.createElement('img');
    img.className = 'tg-sd-img';
    img.src = imageSrc;
    img.alt = 'SelfDestruct image';

    const timerBadge = document.createElement('div');
    timerBadge.className = 'tg-sd-timer';
    timerBadge.textContent = `${seconds}s`;

    overlay.appendChild(img);
    overlay.appendChild(timerBadge);
    wrapper.appendChild(overlay);

    // Insert into DOM: append at the end of container so it looks like a new message.
    // We try to scroll into view after insertion.
    container.appendChild(wrapper);
    wrapper.scrollIntoView({behavior: 'smooth', block: 'end'});

    return { wrapper, img, timerBadge };
  }

  // Exposed global function
  window.sendSelfDestruct = async function (imageSrcOrDataUrl, seconds = 5) {
    if (!imageSrcOrDataUrl) {
      console.error('sendSelfDestruct requires an image URL or data URL as first arg');
      return;
    }
    seconds = Number(seconds) || 5;
    if (seconds <= 0) seconds = 1;

    const inserted = insertTimedImage(imageSrcOrDataUrl, seconds);
    if (!inserted) return;

    const { wrapper, timerBadge } = inserted;
    let remaining = seconds;

    // Update UI every second
    const intervalId = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        clearInterval(intervalId);
      }
      timerBadge.textContent = `${Math.max(0, remaining)}s`;
    }, 1000);

    // After TTL, remove image and replace with "destroyed" note
    setTimeout(() => {
      // smooth fade-out
      wrapper.style.transition = 'opacity 300ms ease-out, height 300ms ease-out';
      wrapper.style.opacity = '0.0';
      // after transition remove/replace
      setTimeout(() => {
        const destroyed = document.createElement('div');
        destroyed.className = 'tg-sd-destroyed';
        destroyed.textContent = 'Esta foto foi destruída.';
        try {
          wrapper.replaceWith(destroyed);
        } catch (e) {
          // fallback: remove
          wrapper.remove();
        }
        // notify extension background (optional)
        try {
          window.postMessage({ type: 'TG_SD_DESTROYED' }, '*');
        } catch (e) {}
      }, 300);
    }, seconds * 1000);

    return true;
  };

  // Optional utility: convenience to send a data URL from a file picked via a prompt
  window.sendSelfDestructFromFile = async function (seconds = 5) {
    // Create hidden input
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.style.display = 'none';
    document.body.appendChild(input);

    input.onchange = async (ev) => {
      const file = input.files && input.files[0];
      if (!file) {
        input.remove();
        return;
      }
      const reader = new FileReader();
      reader.onload = function (e) {
        const dataUrl = e.target.result;
        window.sendSelfDestruct(dataUrl, seconds);
        input.remove();
      };
      reader.readAsDataURL(file);
    };

    input.click();
  };

  // Listen for messages from content/background if you want features like "clear all"
  window.addEventListener('message', (ev) => {
    const msg = ev.data;
    if (!msg || typeof msg !== 'object') return;
    if (msg.type === 'EXT_CLEAR_SELFDESTRUCTS') {
      const destroyedNotes = document.querySelectorAll('.tg-sd-msg, .tg-sd-destroyed');
      destroyedNotes.forEach(n => n.remove());
    }
  });
})();
