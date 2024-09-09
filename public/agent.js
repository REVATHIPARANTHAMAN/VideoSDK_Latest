import * as webRTCHandler from "./RTCHandlerAgent.js";
import * as socketCon from "./wssAgent.js";
import * as store from "./store.js"
import * as ui from "./uiInteract.js"
webRTCHandler.getLocalPreview(); // to get the local camera(local mobile)

const micButton = document.getElementById("mic_button");
micButton.addEventListener("click", () => {
  const localStream = store.getState().localStream; // store values returning from the state where default values are loaded
  const micEnabled = localStream.getAudioTracks()[0].enabled; // to return the mic value
  localStream.getAudioTracks()[0].enabled = !micEnabled; // 
  if (localStream.getAudioTracks()[0].enabled) {
    store.setMute(true);
  } else {
    store.setMute(false);
  }
  ui.updateMicButton(micEnabled);
});

let URLParams = new URLSearchParams(window.location.search);

const cameraButton = document.getElementById("camera_button");
cameraButton.addEventListener("click", () => {
  const localStream = store.getState().localStream;
  const cameraEnabled = localStream.getVideoTracks()[0].enabled;
  localStream.getVideoTracks()[0].enabled = !cameraEnabled;
  ui.updateCameraButton(cameraEnabled);
});


// const startRecordingButton = document.getElementById("start_recording_button");
// startRecordingButton.addEventListener("click", () => {
//   recordingUtils.startRecording();
//   ui.showRecordingPanel();
// });

// const stopRecordingButton = document.getElementById("stop_recording_button");
// stopRecordingButton.addEventListener("click", () => {
//   recordingUtils.stopRecording();
//   ui.resetRecordingButtons();
// });

// const pauseRecordingButton = document.getElementById("pause_recording_button");
// pauseRecordingButton.addEventListener("click", () => {
//   recordingUtils.pauseRecording();
//   ui.switchRecordingButtons(true);
// });

// const resumeRecordingButton = document.getElementById(
//   "resume_recording_button"
// );
// resumeRecordingButton.addEventListener("click", () => {
//   recordingUtils.resumeRecording();
//   ui.switchRecordingButtons();
// });

// hang up

const hangUpButton = document.getElementById("hang_up_button");
hangUpButton.addEventListener("click", () => {
  webRTCHandler.handleHangUp();
});

const changeCamer = document.querySelector(".dropdown-item");
changeCamer.addEventListener("click", () => {
  console.log(store.getVideoDevices());
});

if (URLParams.get("channel")) {  // channed --- to check whether itt is android or ios
  store.setDevice(URLParams.get("channel"));
}


let dropDown = document.querySelector(".dropdown"); // executing in runtime
let dropDownMenu = document.querySelector(".dropdown-menu");// executing in runtime
let dropdownItem = document.querySelector(".dropdown-item");// executing in runtime
let divider = document.querySelector(".dropdown-divider");// executing in runtime

let previousSelectedVideo = "", previousSelectedAudio = "";

dropDown.addEventListener("click", () => { // UI  selecting camera and mic source
  dropDownMenu.innerHTML = "";
  let selectD = store.getSelectedDevices()
  store.getVideoDevices().forEach((item) => {
    let cloneItem = dropdownItem.cloneNode(true);
    cloneItem.dataset.deviceid = item.deviceId;
    cloneItem.textContent = item.label;
    cloneItem.title = item.label;
    cloneItem.onclick = selectDeviceVideo;
    if (selectD && selectD.video && selectD.video.dataset.deviceid === item.deviceId) {
      cloneItem.style.color = "#1e2125";
      cloneItem.style.backgroundColor = "#e9ecef";
      previousSelectedVideo = cloneItem;
    }
    dropDownMenu.appendChild(cloneItem);
  });

  dropDownMenu.appendChild(divider);

  store.getAudioDevices().forEach((item) => {
    let cloneItem = dropdownItem.cloneNode(true);
    cloneItem.dataset.deviceid = item.deviceId;
    cloneItem.textContent = item.label;
    cloneItem.title = item.label;
    cloneItem.onclick = selectDeviceAudio;
    if (selectD && selectD.audio && selectD.audio.dataset.deviceid === item.deviceId) {
      cloneItem.style.color = "#1e2125";
      cloneItem.style.backgroundColor = "#e9ecef";
      previousSelectedAudio = cloneItem;
    }
    dropDownMenu.appendChild(cloneItem);
  });
})

function selectDeviceVideo(event) { // UI for selecting the video -- function to add the selected device in the stream
  event.target.style.color = "#1e2125";
  event.target.style.backgroundColor = "#e9ecef";
  event.stopPropagation();
  if (previousSelectedVideo && previousSelectedVideo.dataset.deviceid !== event.target.dataset.deviceid) {
    previousSelectedVideo.style.removeProperty("color");
    previousSelectedVideo.style.removeProperty("background-color");
  }
  previousSelectedVideo = event.target;
  store.setSelectedDevice({ video: event.target });
  webRTCHandler.getLocalPreview({
    audio: {
      deviceId: store.getSelectedDevices().audio.dataset.deviceid
    },
    video: {
      deviceId: event.target.dataset.deviceid
    }
  }, true);
}

function selectDeviceAudio(event) { //UI for selecting the audio device -- function to add the selected device in the stream
  event.target.style.color = "#1e2125";
  event.target.style.backgroundColor = "#e9ecef";
  event.stopPropagation();
  if (previousSelectedAudio && previousSelectedAudio.dataset.deviceid !== event.target.dataset.deviceid) {
    previousSelectedAudio.style.removeProperty("color");
    previousSelectedAudio.style.removeProperty("background-color");
  }
  previousSelectedAudio = event.target;
  store.setSelectedDevice({ audio: event.target });
  webRTCHandler.getLocalPreview({
    audio: {
      deviceId: event.target.dataset.deviceid
    },
    video: {
      deviceId: store.getSelectedDevices().video.dataset.deviceid
    }
  }, true);
}

const status = document.querySelector("#status"); // to display the status in the initial screen
status.textContent = "Not Connected";

let socket = null;
document.querySelector("#status").textContent = "VC Disconnected"// ---------????
const connect_vc = document.querySelector("#connect_vc")
connect_vc.addEventListener("click", () => {

  if (connect_vc.dataset.status === "disconnected") { // function to check vc is connected or not if disconnected it will connect
    connect_vc.classList.remove("btn-secondary");
    connect_vc.classList.add("btn-success");
    connect_vc.textContent = "Disconnect VC";
    connect_vc.dataset.status = "connected";
    document.querySelector("#status").textContent = "VC Connected";
    socket = io("/"); // to create server connection ---- initialise server connection
    socketCon.registerSocketEvents(socket); // to register events in websockets
    session.start(); // session time out start
  } else {
    connect_vc.classList.add("btn-secondary");
    connect_vc.classList.remove("btn-success");
    connect_vc.textContent = "Connect VC";
    connect_vc.dataset.status = "disconnected";
    document.querySelector("#status").textContent = "VC Disconnected";
    socket.close(); // server close
    session.dispose(); // delete the session
  }
});


// timeout 
export let session = new IdleSessionTimeout(30 * 60 * 1000);
// let session = new IdleSessionTimeout(500);

session.onTimeOut = () => {

  connect_vc.click();
  // here you can call your server to log out the user
  let ringtone = new Audio("./audio/user_disconnect.mp3");
  Swal.fire({
    title: "Session Expired, Please Login Again",
    showDenyButton: false,
    showCancelButton: false,
    confirmButtonText: "Refresh",
    denyButtonText: `Cancel`,
    allowOutsideClick: false,
    didOpen: () => {
      ringtone.play();
    }
  }).then((result) => {
    if (result.isConfirmed) {
      window.location.href = "/agent";
    }
    ringtone.pause();
  });

};
async function close_camera() {
  let camerastatus;
  try {
     camerastatus = document.getElementById("Camera_Status");
      // Request access to the camera
      console.log('inside checkCameraUsage');
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
     // Stop the stream to release the camera
      stream.getTracks().forEach(track => track.stop());
}
catch(error){
console.log("Error in close camera" + error);
}
}

