/**
 * Optional router: POST /task/generate and forward result to a tab as APPLY_ACTION.
 * Request/response JSON must match your server (e.g. selector + audioKey for the next step).
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

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
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
