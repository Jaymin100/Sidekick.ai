/**
 * Content script — stateless worker: no orchestration; DOM + updates + executing backend steps.
 *
 * Server (same host as API_BASE):
 * - POST /dom/upload — JSON { dom, pageUrl, capturedAt } → object_key (and optional workflow_id)
 * - POST /dom/content — JSON { object_key, page_title, site_url, workflow_id? }
 * - POST /dom/update — JSON { pageUrl, title, timestamp, ...interaction fields }
 * - Playback: GET /audio/download?object_key=…
 *
 * Next-step delivery is not polled here; optional background may POST /task/generate and forward APPLY_ACTION.
 *
 * Messages from extension UI / background:
 * - APPLY_ACTION — { selector?, audioKey? }
 * - CS_RENDER_STEP / CS_CLEAR_STEP — side panel onboarding
 * - REQUEST_DOM_SNAPSHOT — optional workflow_id; upload DOM then POST /dom/content; worker sends when status is Awaiting_Dom.
 * - HIGHLIGHT / CLEAR — legacy
 * 
 * 
 * 
 */

const API_BASE = "http://10.101.16.249:5001";
const DOM_UPLOAD_URL = `${API_BASE}/dom/upload`;
const DOM_CONTENT_URL = `${API_BASE}/dom/content`;

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
 * Upload raw DOM HTML to storage; response should include `object_key` (and optionally `workflow_id`).
 * @param {string} html
 * @param {string} pageUrl
 * @returns {Promise<{ ok: true, object_key: string | null, workflow_id: string | null } | { ok: false, error: string }>}
 */
async function uploadDomToBackend(html, pageUrl) {
  try {
    const res = await fetch(DOM_UPLOAD_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dom: html,
        pageUrl,
        capturedAt: new Date().toISOString(),
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        ok: false,
        error: typeof data?.error === "string" ? data.error : `HTTP ${res.status}`,
      };
    }
    const object_key =
      data.object_key != null
        ? String(data.object_key)
        : data.objectKey != null
          ? String(data.objectKey)
          : null;
    const workflow_id =
      data.workflow_id != null
        ? String(data.workflow_id)
        : data.workflowId != null
          ? String(data.workflowId)
          : null;
    return { ok: true, object_key, workflow_id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Register stored DOM (`object_key` from `/dom/upload`). `workflow_id` included when set.
 * @param {{ object_key: string | null, workflow_id?: string | null, page_title: string, site_url: string }} body
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

  try {
    const res = await fetch(DOM_CONTENT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      const msg = typeof errData?.error === "string" ? errData.error : `HTTP ${res.status}`;
      console.warn("[Sidekick] dom/content", msg);
      return;
    }
  } catch (e) {
    console.warn("[Sidekick] dom/content", e);
  }
}

/**
 * Full DOM capture: upload then register (same sequence as Chrome popup reference).
 * Prefers `workflow_id` from orchestration when provided (e.g. REQUEST_DOM_SNAPSHOT).
 * @param {{ workflow_id?: string, workflowId?: string }} [meta]
 */
async function captureAndRegisterDom(meta = {}) {
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
  await postDomContent({
    object_key: uploaded.object_key,
    workflow_id: wf ?? undefined,
    page_title,
    site_url: pageUrl,
  });
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

  if (message?.type === "REPORT_STEP_DONE") {
    postDomUpdate({ eventType: "step_completed", detail: message.detail ?? null });
    return false;
  }

  return false;
});
