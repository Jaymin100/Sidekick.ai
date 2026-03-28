document.addEventListener("DOMContentLoaded", () => {

  // ===== ELEMENTS =====
  const startBtn = document.getElementById("startBtn");
  const cancelBtn = document.getElementById("cancelBtn");
  const sendBtn = document.getElementById("sendBtn");
  const listeningControls = document.getElementById("listeningControls");

  const statusText = document.getElementById("status");

  const onboardingDiv = document.getElementById("onboarding");
  const stepInfo = document.getElementById("stepInfo");

  // ===== STATE =====
  let isListening = false;
  let steps = [];
  let currentStep = 0;
  let transcript = "";

  // ===== 🎤 SPEECH RECOGNITION =====
  const recognition = new webkitSpeechRecognition();
  recognition.lang = "en-US";

  // ===== ▶️ START SPEAKING =====
  startBtn.onclick = () => {
    recognition.start();
    isListening = true;

    startBtn.style.display = "none";
    listeningControls.style.display = "flex";
    cancelBtn.style.display = "inline-block";

    setListening();
  };

  // ===== ❌ CANCEL =====
  cancelBtn.onclick = () => {
    recognition.stop();
    isListening = false;

    startBtn.style.display = "inline-block";
    listeningControls.style.display = "none";
    cancelBtn.style.display = "none";

    resetState();

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, {
          type: "CLEAR"
        });
      }
    });

    setIdle();
  };

  // ===== 📤 SEND BUTTON (REAL BACKEND) =====
  sendBtn.onclick = async () => {
    recognition.stop();
    isListening = false;

    setProcessing();

    console.log("Sending transcript:", transcript);

    try {
      const payload = {
        userIntent: transcript,
        url: window.location.href,
        title: document.title
      };

      console.log("Payload:", payload);

      const response = await fetch("http://localhost:3000/api/v1/tasks/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      console.log("Backend response:", data);

      startOnboarding(data);

    } catch (error) {
      console.error("Backend error:", error);
      statusText.textContent = "Error processing request";
    }
  };

  // ===== 🧠 SPEECH RESULT =====
  recognition.onresult = (event) => {
    transcript = event.results[0][0].transcript;
    console.log("User said:", transcript);
  };

  // ===== 🧭 START ONBOARDING =====
  function startOnboarding(data) {
    if (!data || !data.steps) {
      statusText.textContent = "⚠️ Invalid response";
      return;
    }

    steps = data.steps;
    currentStep = 0;

    setOnboarding();
    showStep();
  }

  // ===== 📍 SHOW STEP =====
  function showStep() {
    const step = steps[currentStep];

    stepInfo.textContent = `Step ${currentStep + 1}: ${step.instruction}`;

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, {
          type: "HIGHLIGHT",
          selector: step.selector
        });
      }
    });
  }

  // ===== 🔁 RESET STATE =====
  function resetState() {
    steps = [];
    currentStep = 0;
    transcript = "";
  }

  // ===== 🔁 STATES =====

  function setIdle() {
    isListening = false;
    statusText.textContent = "Click the button to start";
    onboardingDiv.style.display = "none";
  }

  function setListening() {
    isListening = true;
    statusText.textContent = "Listening...";
  }

  function setProcessing() {
    isListening = false;

    statusText.textContent = "Thinking...";

    startBtn.style.display = "none";
    listeningControls.style.display = "none";
    cancelBtn.style.display = "inline-block";

    onboardingDiv.style.display = "none";
  }

  function setOnboarding() {
    onboardingDiv.style.display = "block";
    statusText.textContent = "Follow the steps below";
  }

  // ===== INIT =====
  setIdle();

});