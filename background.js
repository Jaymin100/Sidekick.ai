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
 * @param {Record<string, unknown> | null | undefined} payload
 * @returns {unknown}
 */
function extractStatusFromPayload(payload) {
  if (!payload || typeof payload !== "object") return null;
  const o = /** @type {Record<string, unknown>} */ (payload);
  if ("status" in o) return o.status;
  if ("workflow_status" in o) return o.workflow_status;
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
    console.warn("[Sidekick] Awaiting_Dom but no tabId");
    return;
  }
  const p = payload && typeof payload === "object" ? payload : {};
  const wf = p.workflow_id ?? p.workflowId;
  const dk = p.dom_object_key ?? p.domObjectKey;
  const workflowId = wf != null ? String(wf) : undefined;
  const domObjectKey = dk != null ? String(dk) : undefined;
  chrome.tabs
    .sendMessage(tabId, {
      type: "REQUEST_DOM_SNAPSHOT",
      workflow_id: workflowId,
      dom_object_key: domObjectKey,
    })
    .catch(() => {});
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
    maybeRequestDomSnapshot(tabId, payload);
    sendResponse({ ok: true });
    return false;
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
