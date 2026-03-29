const API_BASE = "http://10.101.16.249:5001";

document.addEventListener("DOMContentLoaded", () => {

  // ===== ELEMENTS =====
  const startBtn = document.getElementById("startBtn");
  const cancelBtn = document.getElementById("cancelBtn");
  const sendBtn = document.getElementById("sendBtn");
  const listeningControls = document.getElementById("listeningControls");

  const statusText = document.getElementById("status");
  const onboardingDiv = document.getElementById("onboarding");
  const stepInfo = document.getElementById("stepInfo");
  const taskTitle = document.getElementById("taskTitle");
  const cancelBtnOnboarding = document.getElementById("cancelBtnOnboarding");

  // ===== STATE =====
  let steps = [];
  let currentStep = 0;
  let transcript = "";
  let isListening = false;
  let shouldSaveRecording = true;
  let currentTask = null;

  let mediaRecorder = null;
  let audioChunks = [];
  let uploadPromise = null;
  let recognitionEndResolve = null;

  /** Set from POST /audio/upload response (`object_key` or `objectKey`). */
  let audioObjectKey = null;

  /** @type {EventSource | null} */
  let workflowEventSource = null;

  function closeWorkflowStream() {
    if (workflowEventSource) {
      workflowEventSource.close();
      workflowEventSource = null;
    }
  }

  /**
   * @param {Record<string, unknown>} payload
   */
  function handleWorkflowEvent(payload) {
    console.log("[SSE] workflow update", payload);

    if (Array.isArray(payload.steps) && payload.steps.length > 0) {
      startOnboarding({
        title: typeof payload.title === "string" ? payload.title : currentTask?.title ?? "Task",
        steps: payload.steps,
      });
      return;
    }

    if (
      typeof payload.instruction === "string" &&
      typeof payload.selector === "string"
    ) {
      startOnboarding({
        title: typeof payload.title === "string" ? payload.title : "Task",
        steps: [{ instruction: payload.instruction, selector: payload.selector }],
      });
      return;
    }

    if (typeof payload.status === "string" || typeof payload.status === "number") {
      statusText.textContent = String(payload.status);
    }
    if (typeof payload.message === "string") {
      stepInfo.textContent = payload.message;
    }
  }

  function openWorkflowStream(workflowId) {
    closeWorkflowStream();
    const url = `${API_BASE}/task/${workflowId}/events`;
    workflowEventSource = new EventSource(url);

    workflowEventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        handleWorkflowEvent(payload);
      } catch (e) {
        console.warn("[SSE] bad JSON", e, event.data);
      }
    };

    workflowEventSource.onerror = (err) => {
      console.error("[SSE] error", err);
    };
  }

  // ===== SPEECH RECOGNITION (CROSS-BROWSER) =====
  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;

  let recognition = null;

  if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onstart = () => {
      console.log("[SPEECH] Recognition started");
    };

    recognition.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const segment = event.results[i][0].transcript;

        if (event.results[i].isFinal) {
          transcript += segment + " ";
          console.log("[SPEECH] FINAL:", segment);
        }
      }
      console.log("[SPEECH] Transcript:", transcript);
    };

    recognition.onerror = (event) => {
      console.error("[SPEECH] Error:", event.error);
    };

    recognition.onend = () => {
      console.log("[SPEECH] Recognition ended");

      if (recognitionEndResolve) {
        recognitionEndResolve();
        recognitionEndResolve = null;
      }
    };
  } else {
    console.warn("SpeechRecognition not supported");
  }

  // ===== RECORDING =====
  async function startRecording() {
    console.log("[RECORD] startRecording()");
    transcript = "";
    shouldSaveRecording = true;
    audioObjectKey = null;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      mediaRecorder = new MediaRecorder(stream);
      audioChunks = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunks.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        if (!shouldSaveRecording) {
          console.log("[RECORD] Discarded");
          return;
        }

        const audioBlob = new Blob(audioChunks, { type: "audio/webm" });

        uploadPromise = fetch(`${API_BASE}/audio/upload`, {
          method: "POST",
          body: (() => {
            const fd = new FormData();
            fd.append("file", audioBlob, "recording.webm");
            return fd;
          })(),
        })
          .then(async (res) => {
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
              console.error("[UPLOAD FAIL]", res.status, data);
              audioObjectKey = null;
              throw new Error(data?.error || `HTTP ${res.status}`);
            }
            audioObjectKey =
              data.object_key ?? null;
            if (!audioObjectKey) {
              console.warn("[UPLOAD] Response had no object_key:", data);
            } else {
              console.log("[UPLOAD OK] object_key:", audioObjectKey);
            }
            return data;
          })
          .catch((err) => {
            console.error("[UPLOAD FAIL]", err);
            audioObjectKey = null;
            throw err;
          });
      };

      mediaRecorder.start();

      if (recognition) {
        try {
          recognition.start();
        } catch {
          console.warn("[SPEECH] Already started");
        }
      }

    } catch (err) {
      console.error("[MIC ERROR]", err);
      statusText.textContent = "Microphone access denied";
    }
  }

  function stopRecording() {
    console.log("[STOP] Called");

    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      mediaRecorder.stop();
    }

    if (recognition) {
      try {
        recognition.stop();
      } catch {
        console.warn("[SPEECH] stop failed");
      }
    }
  }

  // ===== START =====
  startBtn.onclick = () => {
    startRecording();

    startBtn.style.display = "none";
    listeningControls.style.display = "flex";
    cancelBtn.style.display = "inline-block";

    statusText.textContent = "Listening... Speak now";
    isListening = true;
  };

  // ===== CANCEL (FULL RESET) =====
  cancelBtn.onclick = () => {
    console.log("[CANCEL] Full cancel");

    shouldSaveRecording = false;

    stopRecording();
    closeWorkflowStream();

    recognitionEndResolve = null;
    uploadPromise = null;
    audioObjectKey = null;

    transcript = "";
    isListening = false;

    resetState();
    clearHighlight();

    startBtn.style.display = "inline-block";
    listeningControls.style.display = "none";
    cancelBtn.style.display = "none";

    setIdle();
  };

  // ===== SEND =====
  sendBtn.onclick = async () => {
    console.log("[SEND BTN] Clicked");

    isListening = false;
    stopRecording();

    // Wait for recognition OR timeout (Edge fix)
    await Promise.race([
      new Promise(resolve => (recognitionEndResolve = resolve)),
      new Promise(resolve => setTimeout(resolve, 1000))
    ]);

    console.log("[SEND] FINAL Transcript:", transcript);

    setProcessing();

    try {
      if (uploadPromise) await uploadPromise;

      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const activeTab = tabs[0];
      const pageUrl = activeTab?.url ?? "";
      const pageTitle = activeTab?.title ?? "";

      const generateBody = {
        site_url: pageUrl,
        page_title: pageTitle,
      };
      if (audioObjectKey) {
        generateBody.object_key = audioObjectKey;
      }

      const res = await fetch(`${API_BASE}/task/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(generateBody),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        statusText.textContent = data?.error ? String(data.error) : `Error ${res.status}`;
        return;
      }

      const workflowId = data.workflow_id ?? data.workflowId;
      const initialStatus = data.status;

      if (initialStatus != null) {
        statusText.textContent = String(initialStatus);
      }

      if (Array.isArray(data.steps) && data.steps.length > 0) {
        startOnboarding(data);
      } else if (!workflowId) {
        statusText.textContent = "Invalid response (no workflow_id or steps)";
        return;
      }

      if (workflowId) {
        currentTask = { ...data, workflow_id: workflowId };
        openWorkflowStream(workflowId);
      }

    } catch (err) {
      console.error("[SEND ERROR]", err);
      statusText.textContent = "Error processing request";
    }
  };

  // ===== NEXT STEP =====
  const nextBtn = document.getElementById("nextBtn");

  nextBtn.onclick = () => {
    currentStep++;

    if (currentStep < steps.length) {
      showStep();
    } else {
      statusText.textContent = "[COMPLETE] Task completed!";
      stepInfo.textContent = "";
      cancelBtn.style.display = "none";
      cancelBtnOnboarding.style.display = "none";
      clearHighlight();
      setTimeout(() => setIdle(), 2000);
    }
  };

  // ===== CANCEL ONBOARDING =====
  cancelBtnOnboarding.onclick = () => {




















    
    resetState();
    clearHighlight();
    setIdle();
  };

  // ===== CONTENT SCRIPT MESSAGES =====
  chrome.runtime.onMessage.addListener((message) => {

    if (message.type === "PANEL_STEP_RENDERED") {
      statusText.textContent = "Interact with highlighted element";
    }

    if (message.type === "PANEL_ELEMENT_NOT_FOUND") {
      statusText.textContent = "[ERROR] Element not found";
    }

    if (message.type === "PANEL_STEP_COMPLETED") {
      statusText.textContent = "[COMPLETE] Step done!";
      setTimeout(() => nextBtn.click(), 500);
    }

    if (message.type === "PANEL_ERROR") {
      statusText.textContent = "[ERROR]";
    }
  });

  // ===== ONBOARDING =====
  function startOnboarding(data) {
    if (!data?.steps) {
      statusText.textContent = "Invalid response";
      return;
    }

    currentTask = data;
    steps = data.steps;
    currentStep = 0;

    setOnboarding();
    showStep();
  }

  function showStep() {
    const step = steps[currentStep];

    stepInfo.textContent =
      `Step ${currentStep + 1} of ${steps.length}: ${step.instruction}`;

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, {
          type: "CS_RENDER_STEP",
          instruction: step.instruction,
          target: step.selector
        }).catch(() => {});
      }
    });
  }

  function clearHighlight() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, {
          type: "CS_CLEAR_STEP"
        }).catch(() => {});
      }
    });
  }

  function resetState() {
    closeWorkflowStream();
    steps = [];
    currentStep = 0;
    transcript = "";
    currentTask = null;
    audioObjectKey = null;
  }

  // ===== UI STATES =====
  function setIdle() {
    statusText.textContent = "Click to start";
    onboardingDiv.style.display = "none";
    cancelBtnOnboarding.style.display = "none";
  }

  function setProcessing() {
    statusText.textContent = "Thinking...";
    listeningControls.style.display = "none";
    cancelBtn.style.display = "inline-block";
    onboardingDiv.style.display = "none";
  }

  function setOnboarding() {
    statusText.textContent = "Follow the steps";
    taskTitle.textContent = currentTask?.title || "Task";
    onboardingDiv.style.display = "block";
    cancelBtnOnboarding.style.display = "inline-block";
  }

  // ===== INIT =====
  setIdle();

});