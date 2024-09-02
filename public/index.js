import * as webRTCHandler from "./RTCHandler.js";
import * as socketCon from "./wss.js";
import * as constants from "./constants.js"
import * as store from "./store.js"
import * as ui from "./uiInteract.js"
import * as recordingUtils from "./recordingUtil.js"
const socket = io("/");
webRTCHandler.getLocalPreview();
socketCon.registerSocketEvents(socket);

const personalCodeChatButton = document.getElementById(
    "join"
  );

personalCodeChatButton.addEventListener("click", () => {
    const calleePersonalCode = document.getElementById(
      "personal_code_input"
    ).value;
    const callType = constants.callType.VIDEO_PERSONAL_CODE;
  
    webRTCHandler.sendPreOffer(callType, calleePersonalCode);
  });

  const micButton = document.getElementById("mic_button");
micButton.addEventListener("click", () => {
  const localStream = store.getState().localStream;
  const micEnabled = localStream.getAudioTracks()[0].enabled;
  localStream.getAudioTracks()[0].enabled = !micEnabled;
  ui.updateMicButton(micEnabled);
});

const cameraButton = document.getElementById("camera_button");
cameraButton.addEventListener("click", () => {
  const localStream = store.getState().localStream;
  const cameraEnabled = localStream.getVideoTracks()[0].enabled;
  localStream.getVideoTracks()[0].enabled = !cameraEnabled;
  ui.updateCameraButton(cameraEnabled);
});


const startRecordingButton = document.getElementById("start_recording_button");
startRecordingButton.addEventListener("click", () => {
  recordingUtils.startRecording();
  ui.showRecordingPanel();
});

const stopRecordingButton = document.getElementById("stop_recording_button");
stopRecordingButton.addEventListener("click", () => {
  recordingUtils.stopRecording();
  ui.resetRecordingButtons();
});

const pauseRecordingButton = document.getElementById("pause_recording_button");
pauseRecordingButton.addEventListener("click", () => {
  recordingUtils.pauseRecording();
  ui.switchRecordingButtons(true);
});

const resumeRecordingButton = document.getElementById(
  "resume_recording_button"
);
resumeRecordingButton.addEventListener("click", () => {
  recordingUtils.resumeRecording();
  ui.switchRecordingButtons();
});

// hang up

const hangUpButton = document.getElementById("hang_up_button");
hangUpButton.addEventListener("click", () => {
  webRTCHandler.handleHangUp();
});

