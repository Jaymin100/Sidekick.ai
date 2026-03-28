/**
 * Content script: full DOM capture + spotlight overlay (dim page, clear cutout on target).
 * Test from the extension content-script console: sidekickSpotlight(elOrSelector), sidekickClearSpotlight().
 */

const SPOTLIGHT_ROOT_ID = "sidekick-spotlight-root";
const SPOTLIGHT_Z = "2147483646";
const MIN_HOLE = 8;
const PAD = 4;

/** @type {{ root: HTMLElement | null, target: Element | null, raf: number, ac: AbortController | null, ro: ResizeObserver | null }} */
const spotlightState = {
  root: null,
  target: null,
  raf: 0,
  ac: null,
  ro: null,
};

/**
 * @returns {string} Full document HTML.
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

// --- Spotlight overlay (four curtains + ring) ---

function curtainStyle() {
  return [
    "position:fixed",
    "background:rgba(15,23,42,0.55)",
    "pointer-events:none",
    "box-sizing:border-box",
  ].join(";");
}

function syncSpotlightGeometry() {
  const { root, target } = spotlightState;
  if (!root || !target?.isConnected) {
    clearSpotlightInternal();
    return;
  }

  const curtains = root.querySelectorAll("[data-sidekick-curtain]");
  const ring = root.querySelector("[data-sidekick-ring]");
  if (curtains.length !== 4 || !(ring instanceof HTMLElement)) return;

  const [topEl, leftEl, rightEl, bottomEl] = curtains;
  const r = target.getBoundingClientRect();
  const w = window.innerWidth;
  const h = window.innerHeight;

  let left = r.left - PAD;
  let top = r.top - PAD;
  let rw = r.width + PAD * 2;
  let rh = r.height + PAD * 2;
  rw = Math.max(rw, MIN_HOLE);
  rh = Math.max(rh, MIN_HOLE);

  left = Math.max(0, Math.min(left, w - MIN_HOLE));
  top = Math.max(0, Math.min(top, h - MIN_HOLE));

  topEl.style.cssText = `${curtainStyle()};left:0;top:0;width:100%;height:${Math.max(0, top)}px`;
  bottomEl.style.cssText = `${curtainStyle()};left:0;top:${top + rh}px;width:100%;height:${Math.max(0, h - top - rh)}px`;
  leftEl.style.cssText = `${curtainStyle()};left:0;top:${top}px;width:${Math.max(0, left)}px;height:${rh}px`;
  rightEl.style.cssText = `${curtainStyle()};left:${left + rw}px;top:${top}px;width:${Math.max(0, w - left - rw)}px;height:${rh}px`;

  ring.style.cssText = [
    "position:fixed",
    "left:0",
    "top:0",
    "width:0",
    "height:0",
    "pointer-events:none",
    "box-sizing:border-box",
    "border:3px solid #3b82f6",
    "border-radius:10px",
    "box-shadow:0 0 0 2px rgba(59,130,246,0.35),0 0 24px rgba(59,130,246,0.2)",
    `transform:translate(${left}px,${top}px)`,
    `width:${rw}px`,
    `height:${rh}px`,
  ].join(";");
}

function scheduleSpotlightSync() {
  if (spotlightState.raf) return;
  spotlightState.raf = requestAnimationFrame(() => {
    spotlightState.raf = 0;
    syncSpotlightGeometry();
  });
}

function clearSpotlightInternal() {
  if (spotlightState.raf) {
    cancelAnimationFrame(spotlightState.raf);
    spotlightState.raf = 0;
  }
  spotlightState.ro?.disconnect();
  spotlightState.ro = null;
  if (spotlightState.ac) {
    spotlightState.ac.abort();
    spotlightState.ac = null;
  }
  spotlightState.target = null;
  spotlightState.root?.remove();
  spotlightState.root = null;
}

/**
 * Remove spotlight overlay and listeners.
 */
function sidekickClearSpotlight() {
  clearSpotlightInternal();
}

/**
 * @param {Element} targetEl
 */
function mountSpotlight(targetEl) {
  sidekickClearSpotlight();

  const root = document.createElement("div");
  root.id = SPOTLIGHT_ROOT_ID;
  root.setAttribute("data-sidekick-spotlight", "true");
  root.style.cssText = `position:fixed;inset:0;z-index:${SPOTLIGHT_Z};pointer-events:none;margin:0;padding:0;overflow:hidden`;

  for (let i = 0; i < 4; i++) {
    const c = document.createElement("div");
    c.setAttribute("data-sidekick-curtain", String(i));
    root.appendChild(c);
  }
  const ring = document.createElement("div");
  ring.setAttribute("data-sidekick-ring", "true");
  root.appendChild(ring);

  document.documentElement.appendChild(root);
  spotlightState.root = root;
  spotlightState.target = targetEl;

  const ac = new AbortController();
  spotlightState.ac = ac;
  const { signal } = ac;

  window.addEventListener("scroll", scheduleSpotlightSync, { capture: true, passive: true, signal });
  window.addEventListener("resize", scheduleSpotlightSync, { passive: true, signal });

  if (typeof ResizeObserver !== "undefined") {
    spotlightState.ro = new ResizeObserver(() => scheduleSpotlightSync());
    spotlightState.ro.observe(targetEl);
  }

  syncSpotlightGeometry();
}

/**
 * Resolve an Element from a CSS selector string or pass-through Element.
 * @param {string | Element} target
 * @returns {Element | null}
 */
function resolveTarget(target) {
  if (target instanceof Element) return target.isConnected ? target : null;
  if (typeof target === "string" && target.trim()) {
    try {
      const el = document.querySelector(target.trim());
      return el instanceof Element ? el : null;
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Dim the page except around the target element (viewport-relative hole).
 * @param {string | Element} target CSS selector or Element
 * @returns {{ ok: boolean, error?: string }}
 */
function sidekickSpotlight(target) {
  const el = resolveTarget(target);
  if (!el) {
    console.warn("[Sidekick] sidekickSpotlight: no element found");
    return { ok: false, error: "no_element" };
  }
  mountSpotlight(el);
  return { ok: true };
}

globalThis.sidekickSpotlight = sidekickSpotlight;
globalThis.sidekickClearSpotlight = sidekickClearSpotlight;

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (
    message?.type === "SK_GET_SERIALIZED_DOM" ||
    message?.type === "SK_GET_FULL_DOM" ||
    message?.type === "SK_GET_RELEVANT_DOM"
  ) {
    try {
      const html = getFullDOM();
      sendResponse({ ok: true, html, mode: "full" });
    } catch (e) {
      sendResponse({ ok: false, error: e instanceof Error ? e.message : String(e) });
    }
    return false;
  }

  if (message?.type === "SK_CLEAR_SPOTLIGHT") {
    sidekickClearSpotlight();
    sendResponse({ ok: true });
    return false;
  }

  if (message?.type === "SK_SPOTLIGHT") {
    const sel = message.selector;
    if (typeof sel !== "string" || !sel.trim()) {
      sendResponse({ ok: false, error: "invalid_selector" });
      return false;
    }
    const r = sidekickSpotlight(sel);
    sendResponse(r.ok ? { ok: true } : { ok: false, error: r.error || "not_found" });
    return false;
  }

  return false;
});
