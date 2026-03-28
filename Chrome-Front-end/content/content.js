/**
 * Content script: capture the document’s full HTML from the live DOM.
 * Includes head, scripts, styles, hidden nodes, etc. (whatever is in the DOM).
 *
 * Uses document.documentElement.outerHTML plus <!DOCTYPE> when present.
 * Shadow DOM and cross-origin iframe innards are not included (browser limitation).
 */

/**
 * @returns {string} Full document HTML.
 */
function getFullDOM() {
  const root = document.documentElement;
  if (!root) return "";

  let prefix = "";
  const dt = document.doctype;
  if (dt) {
    prefix = `<!DOCTYPE ${dt.name}`;
    if (dt.publicId) prefix += ` PUBLIC "${dt.publicId}"`;
    if (dt.systemId) prefix += ` "${dt.systemId}"`;
    prefix += ">\n";
  }

  return prefix + root.outerHTML;
}

/** Same as getFullDOM() — handy for DevTools / older snippets. */
function serializeDOM() {
  return getFullDOM();
}

globalThis.getFullDOM = getFullDOM;
globalThis.serializeDOM = serializeDOM;

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (
    message?.type === "SK_GET_SERIALIZED_DOM" ||
    message?.type === "SK_GET_FULL_DOM" ||
    message?.type === "SK_GET_RELEVANT_DOM"
  ) {
    try {
      const html = getFullDOM();
      sendResponse({ ok: true, html, mode: "full" });
    } catch (e) {
      sendResponse({ ok: false, error: e instanceof Error ? e.message : String(e) });
    }
  }
  return false;
});
