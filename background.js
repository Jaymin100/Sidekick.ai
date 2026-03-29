/**
 * Service worker: API routing, workflow status orchestration, tab actions.
 * - BG_TASK_GENERATE — POST /task/generate (non-initial task flow from side panel).
 * - WORKFLOW_STATUS — mirrored SSE / status payloads from side panel; handles Awaiting_Dom → REQUEST_DOM_SNAPSHOT.
 * - BG_FETCH_NEXT_ACTION — POST /task/generate with optional APPLY_ACTION to tab.
 */

const API_BASE = "http://10.101.16.249:5001";

function enableSidePanelOnActionClick() {
  if (!chrome.sidePanel?.setPanelBehavior) return;
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
}

chrome.runtime.onInstalled.addListener(() => {
  console.log("[Sidekick] background ready");
  enableSidePanelOnActionClick();
});

enableSidePanelOnActionClick();

/**
 * @param {unknown} status
 * @returns {boolean}
 */
function isAwaitingDomStatus(status) {
  if (status == null) return false;
  const s = String(status)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
  return s === "awaiting_dom";
}

/**
 * Unwrap status values that APIs return as objects (e.g. `{ code: "awaiting_dom" }`).
 * @param {unknown} raw
 * @returns {unknown}
 */
function unwrapStatusValue(raw) {
  if (raw == null) return null;
  if (typeof raw !== "object" || Array.isArray(raw)) return raw;
  const o = /** @type {Record<string, unknown>} */ (raw);
  if (typeof o.code === "string" || typeof o.code === "number") return o.code;
  if (typeof o.name === "string") return o.name;
  if (typeof o.value === "string" || typeof o.value === "number") return o.value;
  if ("status" in o) return o.status;
  return raw;
}

/**
 * @param {Record<string, unknown> | null | undefined} payload
 * @returns {unknown}
 */
function extractStatusFromPayload(payload) {
  if (!payload || typeof payload !== "object") return null;
  const o = /** @type {Record<string, unknown>} */ (payload);
  const direct = [
    o.status,
    o.workflow_status,
    o.workflowStatus,
    o.state,
    o.phase,
  ];
  for (const v of direct) {
    if (v !== undefined) return unwrapStatusValue(v);
  }
  const nested = o.data ?? o.workflow ?? o.result;
  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    const n = /** @type {Record<string, unknown>} */ (nested);
    const inner = n.status ?? n.workflow_status ?? n.state;
    if (inner !== undefined) return unwrapStatusValue(inner);
  }
  return null;
}

/**
 * @param {number | undefined} tabId
 * @param {Record<string, unknown> | null | undefined} payload
 */
function maybeRequestDomSnapshot(tabId, payload) {
  const st = extractStatusFromPayload(payload);
  if (!isAwaitingDomStatus(st)) return;
  if (tabId == null) {
    console.warn("[Sidekick] awaiting_dom but no tabId — cannot message content script");
    return;
  }
  const p = payload && typeof payload === "object" ? payload : {};
  const wf = p.workflow_id ?? p.workflowId;
  const dk = p.dom_object_key ?? p.domObjectKey;
  const workflowId = wf != null ? String(wf) : undefined;
  const domObjectKey = dk != null ? String(dk) : undefined;
  console.log("[Sidekick] awaiting_dom → REQUEST_DOM_SNAPSHOT", { tabId, workflowId });
  chrome.tabs
    .sendMessage(tabId, {
      type: "REQUEST_DOM_SNAPSHOT",
      workflow_id: workflowId,
      dom_object_key: domObjectKey,
    })
    .catch((err) => {
      console.warn(
        "[Sidekick] REQUEST_DOM_SNAPSHOT failed (is the Sidekick tab active, and is this page chrome:// or restricted?) ",
        err?.message ?? err,
      );
    });
}

/**
 * @param {unknown} data
 * @returns {data is Record<string, unknown>}
 */
function isRecord(data) {
  return data != null && typeof data === "object" && !Array.isArray(data);
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "BG_TASK_GENERATE") {
    const payload =
      message.payload && typeof message.payload === "object" ? message.payload : {};
    const tabId =
      typeof message.tabId === "number"
        ? message.tabId
        : typeof message.tab_id === "number"
          ? message.tab_id
          : undefined;

    fetch(`${API_BASE}/task/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          sendResponse({ ok: false, error: `HTTP ${res.status}`, data });
          return;
        }
        if (isRecord(data)) {
          maybeRequestDomSnapshot(tabId, data);
        }
        sendResponse({ ok: true, data });
      })
      .catch((e) => {
        sendResponse({ ok: false, error: e instanceof Error ? e.message : String(e) });
      });

    return true;
  }

  if (message?.type === "WORKFLOW_STATUS") {
    const tabId = typeof message.tabId === "number" ? message.tabId : undefined;
    const payload =
      message.payload && typeof message.payload === "object"
        ? /** @type {Record<string, unknown>} */ (message.payload)
        : null;
    maybeRequestDomSnapshot(tabId, payload);
    sendResponse({ ok: true });
    return false;
  }

  /**
   * DOM API calls from content scripts must not use fetch() in the page — CORS uses the
   * page origin (e.g. google.com). Proxy here so requests use the extension context.
   */
  if (message?.type === "BG_DOM_UPLOAD") {
    const body = message.payload && typeof message.payload === "object" ? message.payload : {};
    fetch(`${API_BASE}/dom/upload`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          sendResponse({
            ok: false,
            error: typeof data?.error === "string" ? data.error : `HTTP ${res.status}`,
          });
          return;
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
        console.log("[Sidekick] /dom/upload response JSON:", data);
        sendResponse({ ok: true, object_key, workflow_id, response: data });
      })
      .catch((e) => {
        sendResponse({ ok: false, error: e instanceof Error ? e.message : String(e) });
      });
    return true;
  }

  if (message?.type === "BG_DOM_CONTENT") {
    const body = message.payload && typeof message.payload === "object" ? message.payload : {};
    fetch(`${API_BASE}/dom/content`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          const msg = typeof data?.error === "string" ? data.error : `HTTP ${res.status}`;
          sendResponse({ ok: false, error: msg, response: data });
          return;
        }
        console.log("[Sidekick] /dom/content response JSON:", data);
        sendResponse({ ok: true, response: data });
      })
      .catch((e) => {
        sendResponse({ ok: false, error: e instanceof Error ? e.message : String(e) });
      });
    return true;
  }

  if (message?.type === "BG_DOM_UPDATE") {
    const body = message.payload && typeof message.payload === "object" ? message.payload : {};
    fetch(`${API_BASE}/dom/update`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
      .then(async (res) => {
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          const msg = typeof errData?.error === "string" ? errData.error : `HTTP ${res.status}`;
          sendResponse({ ok: false, error: msg });
          return;
        }
        sendResponse({ ok: true });
      })
      .catch((e) => {
        sendResponse({ ok: false, error: e instanceof Error ? e.message : String(e) });
      });
    return true;
  }

  if (message?.type === "BG_FETCH_NEXT_ACTION") {
    const tabId = message.tabId ?? sender.tab?.id;
    const payload = message.payload && typeof message.payload === "object" ? message.payload : {};

    fetch(`${API_BASE}/task/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          sendResponse({ ok: false, error: `HTTP ${res.status}`, data });
          return;
        }
        if (isRecord(data)) {
          maybeRequestDomSnapshot(
            tabId != null ? tabId : undefined,
            data,
          );
        }
        if (tabId != null && (data.selector || data.audioKey)) {
          chrome.tabs.sendMessage(tabId, {
            type: "APPLY_ACTION",
            selector: data.selector,
            audioKey: data.audioKey,
          }).catch(() => {});
        }
        sendResponse({ ok: true, data });
      })
      .catch((e) => {
        sendResponse({ ok: false, error: e instanceof Error ? e.message : String(e) });
      });

    return true;
  }

  return false;
});
