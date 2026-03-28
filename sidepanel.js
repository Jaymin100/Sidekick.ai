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
  let steps = [];
  let currentStep = 0;
  let transcript = "";
  let isListening = false;
  let shouldSaveRecording = true;

  let mediaRecorder = null;
  let audioChunks = [];
  let uploadPromise = null;
  let recognitionEndResolve = null;

  // ===== SPEECH RECOGNITION =====
  const recognition = new webkitSpeechRecognition();
  recognition.lang = "en-US";
  recognition.continuous = true;
  recognition.interimResults = true;

  recognition.onstart = () => {
    console.log("[SPEECH] Recognition started");
  };

  recognition.onresult = (event) => {
    console.log("[SPEECH] onresult fired - event:", event);
    let interimTranscript = "";
    
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcriptSegment = event.results[i][0].transcript;
      
      if (event.results[i].isFinal) {
        console.log("[SPEECH] FINAL result:", transcriptSegment);
        transcript = transcriptSegment; // Keep latest final result
      } else {
        console.log("[SPEECH] INTERIM result:", transcriptSegment);
        interimTranscript += transcriptSegment;
      }
    }
    
    console.log("[SPEECH] Current transcript:", transcript);
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

  // ===== RECORDING =====
  async function startRecording() {
    console.log("[RECORD] startRecording() called");
    transcript = ""; // Reset transcript
    shouldSaveRecording = true;
    
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    console.log("[RECORD] Microphone access granted");

    mediaRecorder = new MediaRecorder(stream);
    audioChunks = [];

    mediaRecorder.ondataavailable = (e) => {
      audioChunks.push(e.data);
    };

    mediaRecorder.onstop = async () => {
      if (!shouldSaveRecording) {
        console.log("[RECORD] Recording discarded");
        audioChunks = [];
        return;
      }

      const audioBlob = new Blob(audioChunks, { type: "audio/webm" });

      console.log("[RECORD] Audio ready:", audioBlob);

      // Upload to backend
      uploadPromise = (async () => {
        try {
          const formData = new FormData();
          formData.append("file", audioBlob, "recording.webm");

          console.log("[RECORD] Uploading audio to backend...");
          const uploadRes = await fetch("http://10.101.16.249:5001/audio/upload", {
            method: "POST",
            body: formData
          });

          if (!uploadRes.ok) {
            const errorText = await uploadRes.text();
            console.error("[RECORD] Upload error:", errorText);
            throw new Error(`Upload failed: ${uploadRes.status}`);
          }

          const uploadData = await uploadRes.json();
          console.log("[RECORD] Upload successful:", uploadData);
          return uploadData;

        } catch (err) {
          console.error("[RECORD] Upload error:", err.message);
        }
      })();
    };

    mediaRecorder.start();
    console.log("[RECORD] MediaRecorder started");
    
    console.log("[RECORD] Starting speech recognition...");
    recognition.start();
    console.log("[RECORD] Speech recognition.start() called");
  }

  function stopRecording() {
    console.log("[STOP] stopRecording() called");
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      mediaRecorder.stop();
      console.log("[STOP] MediaRecorder stopped");
    }
    console.log("[STOP] Stopping speech recognition...");
    recognition.stop();
    console.log("[STOP] Speech recognition.stop() called");
  }

  // ===== START BUTTON =====
  startBtn.onclick = () => {
    console.log("[START BTN] Clicked");
    startRecording();

    startBtn.style.display = "none";
    listeningControls.style.display = "flex";
    cancelBtn.style.display = "inline-block";

    statusText.textContent = "Listening... Speak now";
    setListening();
  };

  // ===== CANCEL =====
  cancelBtn.onclick = () => {
    console.log("[CANCEL BTN] Clicked");
    shouldSaveRecording = false;
    stopRecording();
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

  // ===== SEND =====
  sendBtn.onclick = async () => {
    console.log("[SEND BTN] Clicked");
    isListening = false;
    stopRecording();

    // Wait for speech recognition to actually complete
    await new Promise(resolve => {
      recognitionEndResolve = resolve;
    });

    console.log("[SEND BTN] FINAL Transcript:", transcript);

    setProcessing();

    try {
      // Wait for audio upload to comp  lete
      if (uploadPromise) {
        const uploadData = await uploadPromise;
        console.log("[SEND] Audio uploaded:", uploadData);
      }

      const payload = {
        userIntent: transcript,
        url: window.location.href,
        title: document.title
      };

      console.log("[SEND] Payload:", payload);

      console.log("[SEND] Connecting to backend...");
      const res = await fetch("http://10.101.16.249:5001/api/v1/tasks/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      console.log("[SEND] Response received:", res.status, res.statusText);

      if (!res.ok) {
        const errorText = await res.text();
        console.error("[SEND] Server error response:", errorText);
        throw new Error(`Server error: ${res.status} ${res.statusText} - ${errorText}`);
      }

      console.log("[SEND] Parsing JSON response...");
      const data = await res.json();
      console.log("[SEND] Response data:", data);
      startOnboarding(data);

    } catch (err) {
      console.error("[SEND] CATCH ERROR:", err.message);
      console.error("[SEND] Full error:", err);
      statusText.textContent = "Error processing request";
    }
  };

  // ===== NEXT BUTTON =====
  const nextBtn = document.getElementById("nextBtn");

  nextBtn.onclick = () => {
    currentStep++;

    if (currentStep < steps.length) {
      showStep();
    } else {
      statusText.textContent = "✅ Task completed";
      onboardingDiv.style.display = "none";
    }
  };

  // ===== ONBOARDING =====
  function startOnboarding(data) {
    if (!data?.steps) {
      statusText.textContent = "Invalid response";
      return;
    }

    steps = data.steps;
    currentStep = 0;

    setOnboarding();
    showStep();
  }

  function showStep() {
    const step = steps[currentStep];

    stepInfo.textContent = `Step ${currentStep + 1}: ${step.instruction}`;

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, {
          type: "CS_RENDER_STEP",
          instruction: step.instruction,
          target: step.selector
        });
      }
    });
  }

  // ===== HELPERS =====
  function clearHighlight() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { type: "CS_CLEAR_STEP" });
      }
    });
  }

  function resetState() {
    steps = [];
    currentStep = 0;
    transcript = "";
  }

  // ===== UI STATES =====
  function setIdle() {
    isListening = false;
    statusText.textContent = "Click to start";
    onboardingDiv.style.display = "none";
  }

  function setProcessing() {
  isListening = false;

  statusText.textContent = "Thinking...";

  // FIX: hide Send button container
  listeningControls.style.display = "none";

  // Keep cancel visible
  cancelBtn.style.display = "inline-block";

  onboardingDiv.style.display = "none";
}

  function setOnboarding() {
    statusText.textContent = "Follow the steps";
    onboardingDiv.style.display = "block";
  }

  function setListening() {
    isListening = true;
    onboardingDiv.style.display = "none";
  }

  // ===== INIT =====
  setIdle();

});