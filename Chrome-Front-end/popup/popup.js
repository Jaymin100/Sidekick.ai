const DOM_UPLOAD_URL = "http://10.101.16.249:5001/dom/upload";
const DOM_CONTENT_URL = "http://10.101.16.249:5001/dom/content";
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
      data.object_key != null ? String(data.object_key) : data.objectKey != null ? String(data.objectKey) : null;
    const workflow_id = "hi"
     
    return { ok: true, object_key, workflow_id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Register stored DOM (`object_key` from `/dom/upload`). `workflow_id` is optional and omitted when unset.
 * @param {{ object_key: string | null, workflow_id?: string | null, page_title: string, site_url: string }} body
 */
async function postDomContent(body) {
  /** @type {Record<string, string>} */
  const payload = {
    "object_key": body.object_key ?? "",
    "page_title": body.page_title,
    "site_url": body.site_url,
    "workflow_id": "123"
  };


  const res = await fetch(DOM_CONTENT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    const msg = typeof errData?.error === "string" ? errData.error : `HTTP ${res.status}`;
    throw new Error(msg);
  }

  const resData = await res.json();
  alert(JSON.stringify(resData));
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
    if (!uploaded.ok) {
      statusEl.textContent = `Copied full DOM (${kb} KB). Upload failed: ${uploaded.error}`;
      return;
    }
    const page_title = tab.title ?? "";
    if (!uploaded.object_key) {
      statusEl.textContent = `Copied full DOM (${kb} KB). Upload OK but no object_key — skipping /dom/content.`;
      return;
    }
    try {
      await postDomContent({
        object_key: uploaded.object_key,
        workflow_id: uploaded.workflow_id,
        page_title,
        site_url: url,
      });
      statusEl.textContent = `Copied full DOM (${kb} KB), uploaded, and registered at /dom/content.`;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      statusEl.textContent = `DOM uploaded (${kb} KB) but /dom/content failed: ${msg}`;
    }
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
