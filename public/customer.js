import * as webRTCHandler from "./RTCHandler.js";
import * as socketCon from "./wss.js";
import * as constants from "./constants.js"
import * as store from "./store.js"

const socket = io("/");
webRTCHandler.getLocalPreview(); // to get local video stream 
socketCon.registerSocketEvents(socket);//to register events in websockets

// const personalCodeChatButton = document.getElementById(
//   "join"
// );
checkCameraUsage();
let URLParams = new URLSearchParams(window.location.search); // forming URL
if (URLParams.get("user")) { // user in the URL
  const callType = constants.callType.VIDEO_PERSONAL_CODE;
  store.setRemoteUser(URLParams.get("user")); // sending the User details to backend
  webRTCHandler.sendPreOffer(callType, URLParams.get("user")); // call is initiated using the send preoffer 
}

if (URLParams.get("applicationid")) { // getting application id from URLParams ifthere is no application id passed it will return null
  store.setApplicationId(URLParams.get("applicationid")); // storing the application id value in store
}

if (URLParams.get("channel")) { // getting the channel either ios or android
  store.setDevice(URLParams.get("channel")); // storing the device details 
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
  webRTCHandler.handleHangUp(); // closing the connections after the hangup button
});

// // switchCamera
// const switchCamera = document.getElementById("screen_sharing_button");
// switchCamera.addEventListener("click", () => {
//   webRTCHandler.switchCamera();
// });


async function checkCameraUsage() {
  let camerastatus;
  try {
     camerastatus = document.getElementById("Camera_Status");
      // Request access to the camera
      console.log('inside checkCameraUsage');
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });

      // If we get here, the camera is available and not in use
      console.log('Camera is available and not in use.');
      
      // Send status to the backend
      // await sendCameraStatusToBackend(true);

      // Stop the stream to release the camera
      stream.getTracks().forEach(track => track.stop());
  } catch (error) {

      if (error.name === 'NotAllowedError') {
          console.log('Camera access was denied by the user.');
          camerastatus.textContent = "Camera NotAllowed";
      } else if (error.name === 'NotFoundError') {
          console.log('No camera device found.');
          camerastatus.textContent = "Camera Not available";
      } else if (error.name === 'NotReadableError') {
          console.log('Camera is already in use by another application or tab.');
          camerastatus.textContent = "Camera not readable";
          
          // Send status to the backend
         // await sendCameraStatusToBackend(false);
      } else {
          console.error('Error accessing the camera:', error);
          camerastatus.textContent = "Camera error";
      }
      document.getElementById("status_bar").style.display = "block";
  }
}
async function sendCameraStatusToBackend(isAvailable) {
  try {
      await fetch('/camera-status', {
          method: 'POST',
          headers: {
              'Content-Type': 'application/json'
          },
          body: JSON.stringify({ cameraAvailable: isAvailable })
      });
  } catch (error) {
      console.error('Error sending camera status to backend:', error);
  }
}
