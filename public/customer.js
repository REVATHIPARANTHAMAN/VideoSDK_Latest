import * as webRTCHandler from "./RTCHandler.js";
import * as socketCon from "./wss.js";
import * as constants from "./constants.js"
import * as store from "./store.js"
import * as ui from "./uiInteract.js"
const socket = io("/");
webRTCHandler.getLocalPreview();
socketCon.registerSocketEvents(socket);

// const personalCodeChatButton = document.getElementById(
//   "join"
// );

let URLParams = new URLSearchParams(window.location.search);
if (URLParams.get("user")) {
  const callType = constants.callType.VIDEO_PERSONAL_CODE;
  store.setRemoteUser(URLParams.get("user"));
  webRTCHandler.sendPreOffer(callType, URLParams.get("user"));
}

if (URLParams.get("applicationid")) {
  store.setApplicationId(URLParams.get("applicationid"));
}

if (URLParams.get("channel")) {
  store.setDevice(URLParams.get("channel"));
}

// personalCodeChatButton.addEventListener("click", () => {
//   const calleePersonalCode = document.getElementById(
//     "personal_code_input"
//   ).value;
//   const callType = constants.callType.VIDEO_PERSONAL_CODE;

//   webRTCHandler.sendPreOffer(callType, calleePersonalCode);
// });

// const micButton = document.getElementById("mic_button");
// micButton.addEventListener("click", () => {
//   const localStream = store.getState().localStream;
//   const micEnabled = localStream.getAudioTracks()[0].enabled;
//   localStream.getAudioTracks()[0].enabled = !micEnabled;
//   ui.updateMicButton(micEnabled);
// });

// const cameraButton = document.getElementById("camera_button");
// cameraButton.addEventListener("click", () => {
//   const localStream = store.getState().localStream;
//   const cameraEnabled = localStream.getVideoTracks()[0].enabled;
//   localStream.getVideoTracks()[0].enabled = !cameraEnabled;
//   ui.updateCameraButton(cameraEnabled);
// });

// hang up

const hangUpButton = document.getElementById("hang_up_button");
hangUpButton.addEventListener("click", () => {
  webRTCHandler.handleHangUp();
});

// // switchCamera
// const switchCamera = document.getElementById("screen_sharing_button");
// switchCamera.addEventListener("click", () => {
//   webRTCHandler.switchCamera();
// });