/**
 * Content script: capture HTML from the live DOM with noise stripped.
 *
 * Relevant HTML (default): rebuilds a clean tree — no script/style blobs, no head
 * metadata plumbing, no hidden subtrees (computed style + aria-hidden + hidden).
 * Same-origin iframes are included; cross-origin iframes stay as empty tags.
 *
 * Full HTML: raw documentElement.outerHTML (+ doctype) via getFullDOM().
 */

/** Drop these tags entirely (including all descendants). */
const STRIP_TAGS = new Set([
  "script",
  "style",
  "noscript",
  "template",
  "link",
  "meta",
  "base",
]);

/**
 * @returns {string}
 */
function getDoctypePrefix() {
  const dt = document.doctype;
  if (!dt) return "";
  let prefix = `<!DOCTYPE ${dt.name}`;
  if (dt.publicId) prefix += ` PUBLIC "${dt.publicId}"`;
  if (dt.systemId) prefix += ` "${dt.systemId}"`;
  return `${prefix}>\n`;
}

/**
 * @param {Element} el
 * @returns {boolean}
 */
function isHiddenLive(el) {
  if (!(el instanceof Element)) return false;
  if (el.hasAttribute("hidden")) return true;
  if (el.getAttribute("aria-hidden") === "true") return true;
  try {
    const st = window.getComputedStyle(el);
    if (st.display === "none" || st.visibility === "hidden") return true;
    const op = parseFloat(st.opacity);
    if (!Number.isNaN(op) && op === 0) return true;
  } catch {
    return true;
  }
  return false;
}

/**
 * @param {Element} liveEl
 * @returns {Element}
 */
function cloneElementShallow(liveEl) {
  const uri = liveEl.namespaceURI || "http://www.w3.org/1999/xhtml";
  const copy = document.createElementNS(uri, liveEl.tagName);
  for (const attr of [...liveEl.attributes]) {
    try {
      if (attr.namespaceURI) {
        copy.setAttributeNS(attr.namespaceURI, attr.name, attr.value);
      } else {
        copy.setAttribute(attr.name, attr.value);
      }
    } catch {
      try {
        copy.setAttribute(attr.name, attr.value);
      } catch {
        /* skip invalid attrs */
      }
    }
  }
  return copy;
}

/**
 * Build a filtered copy of the subtree rooted at liveEl.
 * @param {Element} liveEl
 * @returns {Element | null}
 */
function buildRelevantTree(liveEl) {
  if (!(liveEl instanceof Element)) return null;

  const tag = liveEl.tagName.toLowerCase();
  if (STRIP_TAGS.has(tag)) return null;
  if (isHiddenLive(liveEl)) return null;

  if (tag === "iframe") {
    const copy = cloneElementShallow(liveEl);
    try {
      const doc = liveEl.contentDocument;
      if (doc?.documentElement) {
        const inner = buildRelevantTree(doc.documentElement);
        if (inner) copy.appendChild(inner);
      }
    } catch {
      /* cross-origin: keep empty iframe shell */
    }
    return copy;
  }

  const copy = cloneElementShallow(liveEl);

  for (const child of liveEl.childNodes) {
    if (child.nodeType === Node.TEXT_NODE) {
      copy.appendChild(document.createTextNode(child.textContent));
    } else if (child.nodeType === Node.ELEMENT_NODE && child instanceof Element) {
      const sub = buildRelevantTree(child);
      if (sub) copy.appendChild(sub);
    }
  }

  return copy;
}

/**
 * @returns {string} Filtered document HTML (relevant content only).
 */
function getRelevantDOM() {
  const root = document.documentElement;
  if (!root) return "";
  const built = buildRelevantTree(root);
  if (!built) return getDoctypePrefix();
  return getDoctypePrefix() + built.outerHTML;
}

/**
 * @returns {string} Unfiltered document HTML.
 */
function getFullDOM() {
  const root = document.documentElement;
  if (!root) return "";
  return getDoctypePrefix() + root.outerHTML;
}

/** Default export for messaging / DevTools — relevant HTML. */
function serializeDOM() {
  return getRelevantDOM();
}

globalThis.getRelevantDOM = getRelevantDOM;
globalThis.getFullDOM = getFullDOM;
globalThis.serializeDOM = serializeDOM;

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "SK_GET_FULL_DOM") {
    try {
      sendResponse({ ok: true, html: getFullDOM(), mode: "full" });
    } catch (e) {
      sendResponse({ ok: false, error: e instanceof Error ? e.message : String(e) });
    }
    return false;
  }

  if (message?.type === "SK_GET_SERIALIZED_DOM" || message?.type === "SK_GET_RELEVANT_DOM") {
    try {
      sendResponse({ ok: true, html: getRelevantDOM(), mode: "relevant" });
    } catch (e) {
      sendResponse({ ok: false, error: e instanceof Error ? e.message : String(e) });
    }
    return false;
  }

  return false;
});
