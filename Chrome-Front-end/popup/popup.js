const DOM_UPLOAD_URL = "http://10.101.16.249:5001/dom/upload";
const AUDIO_DOWNLOAD_URL = "http://10.101.16.249:5001/audio/download";

const statusEl = document.getElementById("status");
const pingBtn = document.getElementById("ping");
const copyDomBtn = document.getElementById("copy-dom");
const audioDownloadBtn = document.getElementById("audio-download");
const audioPlayer = document.getElementById("audio-player");
const spotlightSel = document.getElementById("spotlight-sel");
const spotlightRun = document.getElementById("spotlight-run");
const spotlightClear = document.getElementById("spotlight-clear");

async function getActiveHttpTabId() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return { error: "No active tab." };
  const url = tab.url || "";
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    return { error: "Open a normal http(s) page first." };
  }
  return { tabId: tab.id };
}

/**
 * @param {string} html
 * @param {string} pageUrl
 * @returns {Promise<{ ok: true } | { ok: false, error: string }>}
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
    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Hardcoded GET to fetch audio bytes from the backend.
 * @returns {Promise<{ ok: true, blob: Blob, contentType: string } | { ok: false, error: string }>}
 */
async function requestAudioDownload() {
  try {
    const params = {
      object_key: "b85db0d3-3379-4acc-8ede-1ff6cf0554b1.webm",
    };
    const queryString = new URLSearchParams(params).toString();
    const res = await fetch(`${AUDIO_DOWNLOAD_URL}?${queryString}`, {
      method: "GET",
      headers: { Accept: "audio/*,*/*" },
    });
    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status}` };
    }
    const blob = await res.blob();
    const contentType = res.headers.get("Content-Type") || "application/octet-stream";
    return { ok: true, blob, contentType };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** @type {string | null} */
let lastAudioObjectUrl = null;

pingBtn?.addEventListener("click", async () => {
  if (!statusEl) return;
  statusEl.textContent = "Sendingâ€¦";
  try {
    const response = await chrome.runtime.sendMessage({ type: "PING" });
    statusEl.textContent =
      response?.ok === true ? "Background replied OK." : "Unexpected reply.";
  } catch (e) {
    statusEl.textContent = e instanceof Error ? e.message : "Message failed.";
  }
});

copyDomBtn?.addEventListener("click", async () => {
  if (!statusEl) return;
  statusEl.textContent = "Reading tabâ€¦";
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
      statusEl.textContent = "No active tab.";
      return;
    }
    const url = tab.url || "";
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      statusEl.textContent = "Open a normal http(s) page first.";
      return;
    }
    const res = await chrome.tabs.sendMessage(tab.id, { type: "SK_GET_SERIALIZED_DOM" });
    if (!res?.ok) {
      statusEl.textContent = res?.error || "Snapshot failed. Reload the page.";
      return;
    }
    const html = typeof res.html === "string" ? res.html : "";
    if (!html) {
      statusEl.textContent = "No HTML returned.";
      return;
    }
    await navigator.clipboard.writeText(html);
    const kb = (html.length / 1024).toFixed(1);
    const uploaded = await uploadDomToBackend(html, url);
    statusEl.textContent = uploaded.ok
      ? `Copied full DOM (${kb} KB) and sent to backend. Save as .html if you want.`
      : `Copied full DOM (${kb} KB). Upload failed: ${uploaded.error}`;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    statusEl.textContent =
      msg.includes("Could not establish connection")
        ? "Reload the webpage, then try again."
        : msg;
  }
});

// Playback lives in this popup document; closing the popup stops audio (Chrome tears down the page).
audioDownloadBtn?.addEventListener("click", async () => {
  if (!statusEl || !(audioPlayer instanceof HTMLAudioElement)) return;
  statusEl.textContent = "Loading audio…";
  try {
    const r = await requestAudioDownload();
    if (!r.ok) {
      statusEl.textContent = `Audio failed: ${r.error}`;
      return;
    }
    if (lastAudioObjectUrl) {
      URL.revokeObjectURL(lastAudioObjectUrl);
      lastAudioObjectUrl = null;
    }
    lastAudioObjectUrl = URL.createObjectURL(r.blob);
    audioPlayer.src = lastAudioObjectUrl;
    audioPlayer.load();
    try {
      await audioPlayer.play();
    } catch (playErr) {
      statusEl.textContent =
        playErr instanceof Error ? `Ready: ${playErr.message}` : "Ready — use controls to play.";
      return;
    }
    statusEl.textContent = `Playing (${(r.blob.size / 1024).toFixed(1)} KB).`;
  } catch (e) {
    statusEl.textContent = e instanceof Error ? e.message : String(e);
  }
});

spotlightRun?.addEventListener("click", async () => {
  if (!statusEl) return;
  const sel = spotlightSel?.value?.trim() || "";
  if (!sel) {
    statusEl.textContent = "Enter a CSS selector.";
    return;
  }
  statusEl.textContent = "Spotlightâ€¦";
  try {
    const t = await getActiveHttpTabId();
    if ("error" in t) {
      statusEl.textContent = t.error;
      return;
    }
    const res = await chrome.tabs.sendMessage(t.tabId, {
      type: "SK_SPOTLIGHT",
      selector: sel,
    });
    if (!res?.ok) {
      statusEl.textContent =
        res?.error === "not_found" || res?.error === "no_element"
          ? `No match for: ${sel}`
          : res?.error || "Spotlight failed.";
      return;
    }
    statusEl.textContent = `Spotlight on: ${sel}`;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    statusEl.textContent = msg.includes("Could not establish connection")
      ? "Reload the webpage, then try again."
      : msg;
  }
});

spotlightClear?.addEventListener("click", async () => {
  if (!statusEl) return;
  statusEl.textContent = "Clearingâ€¦";
  try {
    const t = await getActiveHttpTabId();
    if ("error" in t) {
      statusEl.textContent = t.error;
      return;
    }
    await chrome.tabs.sendMessage(t.tabId, { type: "SK_CLEAR_SPOTLIGHT" });
    statusEl.textContent = "Spotlight cleared.";
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    statusEl.textContent = msg.includes("Could not establish connection")
      ? "Reload the webpage, then try again."
      : msg;
  }
});
