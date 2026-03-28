chrome.runtime.onMessage.addListener((msg) => {

  if (msg.type === "HIGHLIGHT") {
    const el = document.querySelector(msg.selector);

    if (el) {
      el.style.outline = "3px solid red";
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    } else {
      console.log("Element not found:", msg.selector);
    }
  }

  if (msg.type === "CLEAR") {
    document.querySelectorAll("*").forEach(el => {
      el.style.outline = "";
    });
  }

});