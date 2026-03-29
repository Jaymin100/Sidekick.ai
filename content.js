/**
 * Content script — stateless worker: no orchestration; DOM + updates + executing backend steps.
 *
 * Server (same host as API_BASE):
 * - POST /dom/content — JSON { dom_object_key, workflow_id, page_title, site_url, html }
 * - POST /dom/update — JSON { pageUrl, title, timestamp, ...interaction fields }
 * - Playback: GET /audio/download?object_key=…
 *
 * Next-step delivery is not polled here; optional background may POST /task/generate and forward APPLY_ACTION.
 *
 * Messages from extension UI / background:
 * - APPLY_ACTION — { selector?, audioKey? }
 * - CS_RENDER_STEP / CS_CLEAR_STEP — side panel onboarding
 * - REQUEST_DOM_SNAPSHOT — optional workflow_id, dom_object_key; POST /dom/content; worker sends when status is Awaiting_Dom.
 * - HIGHLIGHT / CLEAR — legacy
 * 
 * 
 * 
 */

const API_BASE = "http://10.101.16.249:5001";

/** @type {HTMLElement | null} */
let lastHighlighted = null;
/** @type {HTMLAudioElement | null} */
let currentAudio = null;
let inputDebounceTimer = 0;

/**
 * @returns {string} Full document HTML (doctype + documentElement).
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

function serializeDOM() {
  return getFullDOM();
}

globalThis.getFullDOM = getFullDOM;
globalThis.serializeDOM = serializeDOM;

/**
 * @param {{ workflow_id?: string, dom_object_key?: string }} [meta]
 */
async function postDomContent(meta = {}) {
  const body = {
    dom_object_key: meta.dom_object_key ?? null,
    workflow_id: meta.workflow_id ?? null,
    page_title: document.title,
    site_url: location.href,
    html: getFullDOM(),
  };

  try {
    const res = await fetch(`${API_BASE}/dom/content`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) console.warn("[Sidekick] dom/content HTTP", res.status);
  } catch (e) {
    console.warn("[Sidekick] dom/content", e);
  }
}

/**
 * @param {Record<string, unknown>} payload
 */
async function postDomUpdate(payload) {
  try {
    const res = await fetch(`${API_BASE}/dom/update`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pageUrl: location.href,
        title: document.title,
      }),
    });
    if (!res.ok) console.warn("[Sidekick] dom/update HTTP", res.status);
  } catch (e) {
    console.warn("[Sidekick] dom/update", e);
  }
}

function clearHighlight() {
  if (lastHighlighted) {
    lastHighlighted.style.outline = "";
    lastHighlighted = null;
  }
}

/**
 * @param {string} selector
 * @returns {boolean}
 */
function applyMinimalHighlight(selector) {
  clearHighlight();
  let el;
  try {
    el = document.querySelector(selector);
  } catch {
    return false;
  }
  if (!el) return false;
  el.style.outline = "3px solid #2563eb";
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  lastHighlighted = el;
  return true;
}

/**
 * @param {string} audioKey
 */
function playAudioKey(audioKey) {
  if (!audioKey) return;
  try {
    if (currentAudio) {
      currentAudio.pause();
      currentAudio = null;
    }
    const url = `${API_BASE}/audio/download?object_key=${encodeURIComponent(audioKey)}`;
    const audio = new Audio(url);
    currentAudio = audio;
    audio.play().catch((e) => console.warn("[Sidekick] audio play", e));
  } catch (e) {
    console.warn("[Sidekick] audio", e);
  }
}

/**
 * @param {{ selector?: string, audioKey?: string }} action
 */
function applyAction(action) {
  if (action.selector) applyMinimalHighlight(action.selector);
  if (action.audioKey) playAudioKey(action.audioKey);
}

function bindDomUpdateListeners() {
  document.addEventListener(
    "click",
    (e) => {
      const t = e.target;
      postDomUpdate({
        eventType: "click",
        tag: t instanceof Element ? t.tagName : null,
        id: t instanceof Element && t.id ? t.id : null,
        className: t instanceof Element && t.className ? String(t.className).slice(0, 200) : null,
      });
    },
    true,
  );

  document.addEventListener(
    "input",
    (e) => {
      const t = e.target;
      window.clearTimeout(inputDebounceTimer);
      inputDebounceTimer = window.setTimeout(() => {
        postDomUpdate({
          eventType: "input",
          tag: t instanceof Element ? t.tagName : null,
          inputType: t instanceof HTMLInputElement ? t.type : null,
        });
      }, 500);
    },
    true,
  );
}

bindDomUpdateListeners();

function notifyPanelRendered() {
  chrome.runtime.sendMessage({ type: "PANEL_STEP_RENDERED" }).catch(() => {});
}

function notifyPanelNotFound() {
  chrome.runtime.sendMessage({ type: "PANEL_ELEMENT_NOT_FOUND" }).catch(() => {});
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "APPLY_ACTION") {
    applyAction({
      selector: message.selector,
      audioKey: message.audioKey,
    });
    if (sendResponse) sendResponse({ ok: true });
    return false;
  }

  if (message?.type === "CS_RENDER_STEP") {
    const sel = message.target ?? message.selector;
    if (typeof sel === "string" && sel.trim()) {
      const ok = applyMinimalHighlight(sel.trim());
      if (ok) notifyPanelRendered();
      else notifyPanelNotFound();
      if (sendResponse) sendResponse({ ok });
    } else {
      notifyPanelNotFound();
      if (sendResponse) sendResponse({ ok: false, error: "invalid_selector" });
    }
    return false;
  }

  if (message?.type === "CS_CLEAR_STEP") {
    clearHighlight();
    if (currentAudio) {
      currentAudio.pause();
      currentAudio = null;
    }
    if (sendResponse) sendResponse({ ok: true });
    return false;
  }

  if (message?.type === "REQUEST_DOM_SNAPSHOT") {
    const wf = message.workflow_id ?? message.workflowId;
    const dk = message.dom_object_key ?? message.domObjectKey;
    void postDomContent({
      workflow_id: wf != null ? String(wf) : undefined,
      dom_object_key: dk != null ? String(dk) : undefined,
    });
    if (sendResponse) sendResponse({ ok: true });
    return false;
  }

  if (message?.type === "HIGHLIGHT" && typeof message.selector === "string") {
    applyMinimalHighlight(message.selector);
    return false;
  }

  if (message?.type === "CLEAR") {
    clearHighlight();
    if (currentAudio) {
      currentAudio.pause();
      currentAudio = null;
    }
    return false;
  }

  if (message?.type === "REPORT_STEP_DONE") {
    postDomUpdate({ eventType: "step_completed", detail: message.detail ?? null });
    return false;
  }

  return false;
});
