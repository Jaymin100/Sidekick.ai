const statusEl = document.getElementById("status");
const pingBtn = document.getElementById("ping");
const copyDomBtn = document.getElementById("copy-dom");

pingBtn?.addEventListener("click", async () => {
  if (!statusEl) return;
  statusEl.textContent = "Sending…";
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
  statusEl.textContent = "Reading tab…";
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
    statusEl.textContent = `Copied full DOM (${(html.length / 1024).toFixed(1)} KB). Save as .html if you want.`;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    statusEl.textContent =
      msg.includes("Could not establish connection")
        ? "Reload the webpage, then try again."
        : msg;
  }
});
