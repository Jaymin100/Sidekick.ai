/**
 * MV3 service worker — messaging hub for popup, tabs, and future backend calls.
 * ES module; reload extension after edits.
 */

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === chrome.runtime.OnInstalledReason.INSTALL) {
    console.info("[Sidekick] installed");
  } else if (details.reason === chrome.runtime.OnInstalledReason.UPDATE) {
    console.info("[Sidekick] updated", chrome.runtime.getManifest().version);
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "PING") {
    sendResponse({ ok: true });
    return false;
  }
  return false;
});
