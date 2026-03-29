/**
 * Service worker: API routing, workflow status orchestration, tab actions.
 * - BG_TASK_GENERATE — POST /task/generate (non-initial task flow from side panel).
 * - WORKFLOW_STATUS — mirrored SSE / status payloads from side panel; handles Awaiting_Dom → REQUEST_DOM_SNAPSHOT.
 * - BG_FETCH_NEXT_ACTION — POST /task/generate with optional APPLY_ACTION to tab.
 */

const API_BASE = "http://10.101.16.249:5001";
const DOM_REQUEST_TIMEOUT_MS = 10000;

/**
 * @param {string} path
 * @param {Record<string, unknown>} body
 * @param {number} timeoutMs
 * @returns {Promise<{ ok: boolean, status: number, data: Record<string, unknown> }>}
 */
async function postJsonWithTimeout(path, body, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data: isRecord(data) ? data : {} };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * @param {"/dom/upload" | "/dom/content"} path
 * @param {Record<string, unknown>} body
 * @returns {Promise<{ ok: boolean, status: number, data: Record<string, unknown>, error?: string }>}
 */
async function postDomWithRetry(path, body) {
  try {
    const first = await postJsonWithTimeout(path, body, DOM_REQUEST_TIMEOUT_MS);
    if (first.ok) return first;
    if (first.status < 500 && first.status !== 408 && first.status !== 429) return first;
    await new Promise((resolve) => setTimeout(resolve, 500));
    return postJsonWithTimeout(path, body, DOM_REQUEST_TIMEOUT_MS);
  } catch (err) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    try {
      return await postJsonWithTimeout(path, body, DOM_REQUEST_TIMEOUT_MS);
    } catch (retryErr) {
      const msg = retryErr instanceof Error ? retryErr.message : String(retryErr);
      return { ok: false, status: 0, data: {}, error: msg };
    }
  }
}

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
  const p = payload && typeof payload === "object" ? payload : {};
  const wf = p.workflow_id ?? p.workflowId;
  const dk = p.dom_object_key ?? p.domObjectKey;
  const workflowId = wf != null ? String(wf) : undefined;
  const domObjectKey = dk != null ? String(dk) : undefined;
  if (tabId == null) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const resolvedTabId = tabs[0]?.id;
      if (typeof resolvedTabId !== "number") {
        console.warn("[Sidekick] awaiting_dom but no active tab — cannot message content script");
        return;
      }
      console.log("[Sidekick] awaiting_dom → REQUEST_DOM_SNAPSHOT (resolved active tab)", {
        tabId: resolvedTabId,
        workflowId,
      });
      void sendDomSnapshotRequest(resolvedTabId, {
        workflow_id: workflowId,
        dom_object_key: domObjectKey,
      });
    });
    return;
  }
  console.log("[Sidekick] awaiting_dom → REQUEST_DOM_SNAPSHOT", { tabId, workflowId });
  void sendDomSnapshotRequest(tabId, {
    workflow_id: workflowId,
    dom_object_key: domObjectKey,
  });
}

/**
 * @param {number} tabId
 * @returns {Promise<boolean>}
 */
async function isTabReadyForSidekick(tabId) {
  try {
    const response = await chrome.tabs.sendMessage(tabId, { type: "PING_SIDEKICK" });
    return !!(response && typeof response === "object" && response.ok === true);
  } catch {
    return false;
  }
}

/**
 * @param {number} tabId
 * @returns {Promise<boolean>}
 */
async function ensureContentScriptReady(tabId) {
  const alreadyReady = await isTabReadyForSidekick(tabId);
  if (alreadyReady) return true;
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["content.js"],
    });
  } catch (err) {
    console.warn(
      "[Sidekick] content bootstrap failed (tab may be restricted, such as chrome:// pages).",
      err?.message ?? err,
    );
    return false;
  }
  return isTabReadyForSidekick(tabId);
}

/**
 * @param {number} tabId
 * @param {{ workflow_id?: string, dom_object_key?: string }} payload
 */
async function sendDomSnapshotRequest(tabId, payload) {
  const ready = await ensureContentScriptReady(tabId);
  if (!ready) {
    console.warn(
      "[Sidekick] REQUEST_DOM_SNAPSHOT skipped: no content script receiver in target tab.",
    );
    return;
  }
  try {
    await chrome.tabs.sendMessage(tabId, {
      type: "REQUEST_DOM_SNAPSHOT",
      workflow_id: payload.workflow_id,
      dom_object_key: payload.dom_object_key,
    });
  } catch (err) {
    console.warn(
      "[Sidekick] REQUEST_DOM_SNAPSHOT failed after bootstrap.",
      err?.message ?? err,
    );
  }
}

/**
 * @param {unknown} data
 * @returns {data is Record<string, unknown>}
 */
function isRecord(data) {
  return data != null && typeof data === "object" && !Array.isArray(data);
}

/**
 * @param {Record<string, unknown>} data
 * @returns {{ element_id?: string, audio_object_key?: string, status?: string } | null}
 */
function getDemoActionPayload(data) {
  const nextAction =
    data.next_action && typeof data.next_action === "object" && !Array.isArray(data.next_action)
      ? /** @type {Record<string, unknown>} */ (data.next_action)
      : null;

  const rawElement = nextAction?.element_id;
  const rawAudio = nextAction?.audio_object_key;
  const rawStatus = extractStatusFromPayload(data);

  const action = {};
  if (rawElement != null && String(rawElement).trim() !== "") {
    action.element_id = String(rawElement);
  }
  if (rawAudio != null && String(rawAudio).trim() !== "") {
    action.audio_object_key = String(rawAudio);
  }
  if (rawStatus != null && String(rawStatus).trim() !== "") {
    action.status = String(rawStatus);
  }
  return Object.keys(action).length > 0
    ? /** @type {{ element_id?: string, audio_object_key?: string, status?: string }} */ (action)
    : null;
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
    console.log("[SidekickTrace] worker:received_WORKFLOW_STATUS", {
      tabId: tabId ?? null,
      status: payload?.status ?? payload?.workflow_status ?? null,
      workflow_id: payload?.workflow_id ?? payload?.workflowId ?? null,
    });
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
    console.log("[SidekickTrace] worker:BG_DOM_UPLOAD_request", {
      workflow_id: body.workflow_id ?? body.workflowId ?? null,
      pageUrl: body.pageUrl ?? null,
    });
    postDomWithRetry("/dom/upload", body)
      .then((result) => {
        if (!result.ok) {
          sendResponse({
            ok: false,
            error:
              typeof result.data?.error === "string"
                ? result.data.error
                : result.error ?? `HTTP ${result.status}`,
          });
          return;
        }
        const object_key = result.data.object_key != null ? String(result.data.object_key) : null;
        const fallbackObjectKey =
          result.data.objectKey != null ? String(result.data.objectKey) : null;
        const workflow_id =
          result.data.workflow_id != null
            ? String(result.data.workflow_id)
            : result.data.workflowId != null
              ? String(result.data.workflowId)
              : null;
        console.log("[Sidekick] /dom/upload response JSON:", result.data);
        sendResponse({ ok: true, object_key: object_key ?? fallbackObjectKey, workflow_id, response: result.data });
      })
      .catch((e) => {
        sendResponse({ ok: false, error: e instanceof Error ? e.message : String(e) });
      });
    return true;
  }

  if (message?.type === "BG_DOM_CONTENT") {
    const body = message.payload && typeof message.payload === "object" ? message.payload : {};
    console.log("[SidekickTrace] worker:BG_DOM_CONTENT_request", {
      workflow_id: body.workflow_id ?? body.workflowId ?? null,
      object_key: body.object_key ?? body.objectKey ?? null,
      dom_seq: body.dom_seq ?? null,
    });
    postDomWithRetry("/dom/content", body)
      .then((result) => {
        if (!result.ok) {
          const msg =
            typeof result.data?.error === "string"
              ? result.data.error
              : result.error ?? `HTTP ${result.status}`;
          sendResponse({ ok: false, error: msg, response: result.data });
          return;
        }
        console.log("[Sidekick] /dom/content response JSON:", result.data);
        sendResponse({ ok: true, response: result.data });
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
        const action = isRecord(data) ? getDemoActionPayload(data) : null;
        if (tabId != null && action) {
          chrome.tabs.sendMessage(tabId, {
            type: "APPLY_ACTION",
            ...action,
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
