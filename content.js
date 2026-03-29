/**
 * Content script — stateless worker: no orchestration; DOM + updates + executing backend steps.
 *
 * Server (same host as API_BASE):
 * - POST /dom/upload — JSON { dom, pageUrl, capturedAt } → object_key (and optional workflow_id)
 * - POST /dom/content — JSON { object_key, page_title, site_url, workflow_id? }
 * - Playback: GET /audio/download?object_key=…
 *
 * Next-step delivery is not polled here; optional background may POST /task/generate and forward APPLY_ACTION.
 *
 * Messages from extension UI / background:
 * - APPLY_ACTION — { element_id?, audio_object_key?, status? }
 * - CS_RENDER_STEP / CS_CLEAR_STEP — side panel onboarding
 * - REQUEST_DOM_SNAPSHOT — optional workflow_id; upload DOM then POST /dom/content; worker sends when status is Awaiting_Dom.
 * - HIGHLIGHT / CLEAR — legacy
 * 
 * 
 * 
 */

const API_BASE = "http://10.101.16.249:5001";

/**
 * Content-script fetch() is subject to the *page* origin and CORS. DOM/API POSTs go through
 * the service worker (BG_DOM_*) instead.
 * @param {string} type
 * @param {Record<string, unknown>} payload
 * @returns {Promise<Record<string, unknown>>}
 */
function sendToBackground(type, payload) {
  return new Promise((resolve) => {
    if (isWorkflowTerminal) {
      resolve({ ok: false, error: "workflow_terminal" });
      return;
    }
    chrome.runtime.sendMessage({ type, payload }, (response) => {
      if (chrome.runtime.lastError) {
        resolve({ ok: false, error: chrome.runtime.lastError.message });
        return;
      }
      resolve(
        response && typeof response === "object"
          ? /** @type {Record<string, unknown>} */ (response)
          : { ok: false, error: "no response" },
      );
    });
  });
}

/** @type {HTMLElement | null} */
let lastHighlighted = null;
/** @type {HTMLAudioElement | null} */
let currentAudio = null;
let isWorkflowTerminal = false;
let terminalStatusLogged = false;

/**
 * @param {unknown} status
 * @returns {string}
 */
function normalizeStatus(status) {
  if (status == null) return "";
  return String(status).trim().toLowerCase().replace(/[\s-]+/g, "_");
}

/**
 * @param {unknown} status
 * @returns {boolean}
 */
function isTerminalStatus(status) {
  const s = normalizeStatus(status);
  return s === "cancelled" || s === "completed";
}

/**
 * @param {unknown} status
 */
function markTerminalIfNeeded(status) {
  if (!isTerminalStatus(status)) return;
  isWorkflowTerminal = true;
  if (!terminalStatusLogged) {
    terminalStatusLogged = true;
    console.log("[Sidekick] Terminal status reached — stopping backend communication.", {
      status: normalizeStatus(status),
    });
  }
}

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
 * Upload raw DOM HTML to storage; response should include `object_key` (and optionally `workflow_id`).
 * @param {string} html
 * @param {string} pageUrl
 * @returns {Promise<{ ok: true, object_key: string | null, workflow_id: string | null } | { ok: false, error: string }>}
 */
async function uploadDomToBackend(html, pageUrl) {
  const data = await sendToBackground("BG_DOM_UPLOAD", {
    dom: html,
    pageUrl,
    capturedAt: new Date().toISOString(),
  });
  if (!data.ok) {
    return {
      ok: false,
      error: typeof data.error === "string" ? data.error : "dom/upload failed",
    };
  }
  if (data.response != null && typeof data.response === "object") {
    console.log("[Sidekick] POST /dom/upload — server response:", data.response);
  }
  return {
    ok: true,
    object_key:
      data.object_key != null
        ? String(data.object_key)
        : data.objectKey != null
          ? String(data.objectKey)
          : null,
    workflow_id:
      data.workflow_id != null
        ? String(data.workflow_id)
        : data.workflowId != null
          ? String(data.workflowId)
          : null,
  };
}

/**
 * Register stored DOM (`object_key` from `/dom/upload`). `workflow_id` included when set.
 * @param {{ object_key: string | null, workflow_id?: string | null, page_title: string, site_url: string }} body
 * @returns {Promise<Record<string, unknown> | null>}
 */
async function postDomContent(body) {
  /** @type {Record<string, string>} */
  const payload = {
    object_key: body.object_key ?? "",
    page_title: body.page_title,
    site_url: body.site_url,
  };
  if (body.workflow_id != null && body.workflow_id !== "") {
    payload.workflow_id = String(body.workflow_id);
  }

  const res = await sendToBackground("BG_DOM_CONTENT", payload);
  if (!res.ok) {
    if (res.error === "workflow_terminal") return null;
    console.warn("[Sidekick] POST /dom/content failed:", res.error ?? "failed", res.response ?? "");
    return null;
  }
  if (res.response != null && typeof res.response === "object") {
    console.log("[Sidekick] POST /dom/content — server response:", res.response);
    return /** @type {Record<string, unknown>} */ (res.response);
  } else {
    console.log("[Sidekick] POST /dom/content — OK (empty or non-JSON body)");
    return {};
  }
}

/**
 * Full DOM capture: upload then register (same sequence as Chrome popup reference).
 * Prefers `workflow_id` from orchestration when provided (e.g. REQUEST_DOM_SNAPSHOT).
 * @param {{ workflow_id?: string, workflowId?: string }} [meta]
 */
async function captureAndRegisterDom(meta = {}) {
  if (isWorkflowTerminal) return;
  const html = getFullDOM();
  const pageUrl = location.href;
  const page_title = document.title;
  const uploaded = await uploadDomToBackend(html, pageUrl);
  if (!uploaded.ok) {
    console.warn("[Sidekick] dom/upload failed:", uploaded.error);
    return;
  }
  if (!uploaded.object_key) {
    console.warn("[Sidekick] dom/upload OK but no object_key — skipping /dom/content.");
    return;
  }
  const wfFromMeta =
    meta.workflow_id != null
      ? String(meta.workflow_id)
      : meta.workflowId != null
        ? String(meta.workflowId)
        : null;
  const wf = wfFromMeta ?? uploaded.workflow_id;
  const contentResponse = await postDomContent({
    object_key: uploaded.object_key,
    workflow_id: wf ?? undefined,
    page_title,
    site_url: pageUrl,
  });
  if (contentResponse) {
    const nextAction =
      contentResponse.next_action &&
      typeof contentResponse.next_action === "object" &&
      !Array.isArray(contentResponse.next_action)
        ? /** @type {Record<string, unknown>} */ (contentResponse.next_action)
        : null;
    applyAction({
      element_id:
        nextAction?.element_id ??
        nextAction?.element ??
        contentResponse.element_id ??
        contentResponse.element,
      audio_object_key:
        nextAction?.audio_object_key ??
        nextAction?.audioKey ??
        contentResponse.audio_object_key ??
        contentResponse.audioKey,
      status: contentResponse.status,
    });
    console.log("[Sidekick] DOM snapshot pipeline finished (/dom/upload then /dom/content).");
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
 * @param {string} audioObjectKey
 */
function playAudioKey(audioObjectKey) {
  if (!audioObjectKey) return;
  try {
    if (currentAudio) {
      currentAudio.pause();
      currentAudio = null;
    }
    const url = `${API_BASE}/audio/download?object_key=${encodeURIComponent(audioObjectKey)}`;
    const audio = new Audio(url);
    currentAudio = audio;
    audio.play().catch((e) => console.warn("[Sidekick] audio play", e));
  } catch (e) {
    console.warn("[Sidekick] audio", e);
  }
}

/**
 * @param {{ element_id?: unknown, audio_object_key?: unknown, status?: unknown, selector?: unknown, audioKey?: unknown }} action
 */
function applyAction(action) {
  markTerminalIfNeeded(action.status);
  const elementId = action.element_id ?? action.selector;
  const audioObjectKey = action.audio_object_key ?? action.audioKey;
  if (typeof elementId === "string" && elementId.trim()) {
    applyMinimalHighlight(elementId.trim());
  }
  if (typeof audioObjectKey === "string" && audioObjectKey.trim()) {
    playAudioKey(audioObjectKey.trim());
  }
}

function notifyPanelRendered() {
  chrome.runtime.sendMessage({ type: "PANEL_STEP_RENDERED" }).catch(() => {});
}

function notifyPanelNotFound() {
  chrome.runtime.sendMessage({ type: "PANEL_ELEMENT_NOT_FOUND" }).catch(() => {});
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "APPLY_ACTION") {
    applyAction(message);
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
    console.log("[Sidekick] REQUEST_DOM_SNAPSHOT — capturing DOM for backend POST");
    void captureAndRegisterDom({
      workflow_id: wf != null ? String(wf) : undefined,
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

  return false;
});
