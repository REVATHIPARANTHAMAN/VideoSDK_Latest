import * as wss from "./wssAgent.js";
import * as constants from "./constants.js";
import * as store from "./store.js";
import * as ui from "./uiInteract.js"
import * as agent from "./agent.js";
import * as recordingUtils from "./recordingUtil.js"

let connectedUserDetails;
let peerConection;
let dataChannel;

const defaultConstraints = { // to enable both the audio and video
  audio: true,
  video: true
};

const configuration = constants.getTurnCred(); // assigning turn server credentials to configuration

export const getLocalPreview = (constraints, trackStatus) => { // to get the mobile video stream
  checkCameraUsage();
  constraints = constraints || defaultConstraints;
  navigator.mediaDevices
    .getUserMedia(constraints)
    .then((stream) => {
      ui.updateLocalVideo(stream); // updating mobile side video from the stream 
      ui.showVideoCallButtons(); // displaying video call button
      store.setCallState(constants.callState.CALL_AVAILABLE); // call state ---> default values of call state
      store.setLocalStream(stream); // displaying device Id and local video 
      if (trackStatus === true) {
        let videoTrack = "", audioTrack = "";
        for (const track of stream.getTracks()) {
          if (track.kind === "video") {
            videoTrack = track;
          }
          if (track.kind === "audio") {
            audioTrack = track;
          }
        }
        if (store.getVideoTrackSender() && videoTrack) {
          store.getVideoTrackSender().replaceTrack(videoTrack);
        }
        if (store.getAudioTrackSender() && audioTrack) {
          store.getAudioTrackSender().replaceTrack(audioTrack);
        }
      }
      store.setMediaDevices(); // to select the type of video and audio devices
    })
    .catch((err) => {
      console.log("error occured when trying to get an access to camera");
      console.log(err);
    });
};

export const switchCamera = () => {
  defaultConstraints.video.facingMode.exact = "environment";
  getLocalPreview();
}
const createPeerConnection = () => {
  peerConection = new RTCPeerConnection(configuration); // passing  server config values to peer connection values // web rtc connection initial point

  // dataChannel = peerConection.createDataChannel("chat");

  peerConection.ondatachannel = (event) => { // passing application id from mobile application
    const data = event.channel; // event---> object which is returned after passing appln id 
    data.onopen = () => { // callback after connection is open
      console.log("peer connection is ready to receive data channel messages");
    };

    data.onmessage = (event) => {  // event based callbacks
      const message = JSON.parse(event.data);
      console.log(message);
      window.parent.postMessage(message, '*'); // passing message to browser
    };
  };


  peerConection.onicecandidate = (event) => { // to exchange the peer iinfo 
    if (event.candidate) {
      // send our ice candidates to other peer
      wss.sendDataUsingWebRTCSignaling({     // --------- sending socked id and device id to  another agent from mobile
        connectedUserSocketId: connectedUserDetails.socketId,
        type: constants.webRTCSignaling.ICE_CANDIDATE, // ice candidate ---> agent id / peer id
        candidate: event.candidate,
      });
    }
  };

  peerConection.onconnectionstatechange = (event) => { //  function to display the status inside the call window ------event callback
    console.log(peerConection.connectionState);
    ui.updateStatus(peerConection.connectionState); // to update the call status in the browser // egconnecting intitiating etc
    let state = store.getState(); // returning the state of the connection
    if (peerConection.connectionState === "disconnect" || peerConection.connectionState === "failed") {
      closePeerConnectionAndResetState(); //  closing the web rtc connection 
      ui.updateStatus("disconnected"); //  to display the disconnected status
      wss.sendConnectionStatus({ // updating the connecting status to customer(to save data in db)
        username: state.userName,
        socketId: state.socketId,
        remoteUser: "",
        status: "disconnected"
      });

      try {
        let hangup = document.getElementById("hang_up_button");
        hangup.style.display = "none";
        hangup.disabled = false; //  setting false to set the visibility off when call is not connected to agent initial connection screen
        const connectBtn = document.querySelector("#connect_vc"); // #---> syntax to pass id of the particular btn
        connectBtn.disabled = false; // while user in call  if socket disconnected we will not be able to do any function 
        connectBtn.style.cursor = "pointer";
        if (agent.session) {
          agent.session.start(); // to start session time out
        }
        if (window.location.host === "testing") { //  testing is temp we need to give the URL for recording without https
          recordingUtils.stopRecording(); // to stop recording
          ui.resetRecordingButtons(); // reset the UI for recording button
        }

        window.parent.postMessage({ event: "Waiting For Call" }, '*'); // to display the status in the agent header 
      } catch (ex) {
        console.log(ex);
      }
    }
    if (peerConection && peerConection.connectionState === "connected") { // to execute if the connection state is in connected
      wss.sendConnectionStatus({ // updating the connecting status to customer(java service)
        username: state.userName,
        socketId: state.socketId,
        remoteUser: state.remoteUser,
        status: "connected"
      });
      try { //  when customer disconnected the following function will be executed
        let hangup = document.getElementById("hang_up_button");
        hangup.style.display = "";
        hangup.disabled = false;
        const connectBtn = document.querySelector("#connect_vc");
        connectBtn.disabled = true;
        connectBtn.style.cursor = "not-allowed";
        if (agent.session) {
          agent.session.dispose(); // to dispose the session 
        }
        if (window.location.host === "testing") {
          recordingUtils.startRecording(); // call auto recording
          ui.showRecordingPanel(); // show recording pannel
        }

        window.parent.postMessage({ event: "In Call" }, '*');// to display the status in the agent header 
      } catch (ex) {
        console.log(ex);
      }
    }
  };

  peerConection.ontrack = (event) => { // ------- after connecting webrtc we will be having n number of video/ audio streams  we are getting our video and audio track
    ui.updateRemoteVideo(event.streams[0]);
    store.setRemoteStream(event.streams[0]);
  };

  // add our stream to peer connection
  if (
    connectedUserDetails.callType === constants.callType.VIDEO_PERSONAL_CODE ||
    connectedUserDetails.callType === constants.callType.VIDEO_STRANGER
  ) {
    const localStream = store.getState().localStream;

    if (store.getMute()) { // to mute and unmute the audio
      localStream.getAudioTracks()[0].enabled = true;
    } else {
      localStream.getAudioTracks()[0].enabled = false;
    }
    for (const track of localStream.getTracks()) {
      let sender = peerConection.addTrack(track, localStream);
      if (track.kind === "video") {
        store.setVideoTrackSender(sender);
      }
      if (track.kind === "audio") {
        store.setAudioTrackSender(sender);
      }
    }
  }
};

export const sendMessageUsingDataChannel = (message) => { // need to check why this function is using
  const stringifiedMessage = JSON.stringify(message);
  dataChannel.send(stringifiedMessage);
};

export const sendPreOffer = (callType, calleePersonalCode) => {// need to check why this function is using
  connectedUserDetails = {
    callType,
    socketId: calleePersonalCode,
  };

  if (
    callType === constants.callType.CHAT_PERSONAL_CODE ||
    callType === constants.callType.VIDEO_PERSONAL_CODE
  ) {
    const data = {
      callType,
      calleePersonalCode,
    };
    ui.showCallingDialog(callingDialogRejectCallHandler); // to display the popup of accept and cancel 
    store.setCallState(constants.callState.CALL_UNAVAILABLE); // y we are setting un available????
    wss.sendPreOffer(data); // need to check why this function is using
  }

  if (                    // need to check why this function is using
    callType === constants.callType.CHAT_STRANGER ||
    callType === constants.callType.VIDEO_STRANGER
  ) {
    const data = {
      callType,
      calleePersonalCode,
    };
    store.setCallState(constants.callState.CALL_UNAVAILABLE);// y we are setting un available????
    wss.sendPreOffer(data);// need to check why this function is using??
  }
};

export const handlePreOffer = (data) => {// need to check why this function is using

  console.log("handlePreOffer", data);
  const { callType, callerSocketId, calleePersonalCode } = data;

  if (!checkCallPossibility()) { // checking for call connect possibility
    return sendPreOfferAnswer(
      constants.preOfferAnswer.CALL_UNAVAILABLE,
      callerSocketId
    );
  }

  connectedUserDetails = {
    socketId: callerSocketId,
    callType,
  };

  store.setCallState(constants.callState.CALL_UNAVAILABLE);

  if (
    callType === constants.callType.CHAT_PERSONAL_CODE ||
    callType === constants.callType.VIDEO_PERSONAL_CODE
  ) {
    ui.showIncomingCallDialog(callType, acceptCallHandler.bind(this, calleePersonalCode), rejectCallHandler); // displaying the accept cancel button
  }

  if (
    callType === constants.callType.CHAT_STRANGER
  ) {
    createPeerConnection(); // 
    sendPreOfferAnswer(constants.preOfferAnswer.CALL_ACCEPTED);
  }
};

const acceptCallHandler = (calleePersonalCode) => { // function to execute after accepting the call
  createPeerConnection(); // creating connection 
  console.log(calleePersonalCode)
  store.setRemoteUser(calleePersonalCode); // ???
  sendPreOfferAnswer(constants.preOfferAnswer.CALL_ACCEPTED);
};

const rejectCallHandler = (triggeredAction) => { // function to execute after rejecting the calls
  setIncomingCallsAvailable(); // to get the local stream state based on the local stream state call or chat will be initiated
  if (triggeredAction === "timer") {
    sendPreOfferAnswer(constants.preOfferAnswer.CALL_NOT_ANSWERED);
  } else {
    sendPreOfferAnswer(constants.preOfferAnswer.CALL_REJECTED);
  }
};

const callingDialogRejectCallHandler = () => { // function to handle  popup after reject
  const data = {
    connectedUserSocketId: connectedUserDetails.socketId,
  };
  console.log("data in callingDialogRejectCallHandler" + JSON.stringify(data));
  closePeerConnectionAndResetState();

  wss.sendUserHangedUp(data);
};

const sendPreOfferAnswer = (preOfferAnswer, callerSocketId = null) => { // 
  const socketId = callerSocketId
    ? callerSocketId
    : connectedUserDetails.socketId;
  const data = {
    callerSocketId: socketId,
    preOfferAnswer,
  };
  ui.removeAllDialogs();
  wss.sendPreOfferAnswer(data);
};

export const handlePreOfferAnswer = (data) => {
  const { preOfferAnswer } = data;
  console.log("preofferAnswer", data);
  ui.removeAllDialogs();

  if (preOfferAnswer === constants.preOfferAnswer.CALLEE_NOT_FOUND) {
    ui.showInfoDialog(preOfferAnswer);
    setIncomingCallsAvailable();
    // show dialog that callee has not been found
  }

  if (preOfferAnswer === constants.preOfferAnswer.CALL_UNAVAILABLE) {
    setIncomingCallsAvailable();
    ui.showInfoDialog(preOfferAnswer);
    // show dialog that callee is not able to connect
  }

  if (preOfferAnswer === constants.preOfferAnswer.CALL_REJECTED) {
    setIncomingCallsAvailable();
    ui.showInfoDialog(preOfferAnswer);
    // show dialog that call is rejected by the callee
  }

  if (preOfferAnswer === constants.preOfferAnswer.CALL_ACCEPTED) {
    createPeerConnection();
    sendWebRTCOffer();
  }
};

const sendWebRTCOffer = async () => {
  const offer = await peerConection.createOffer();
  await peerConection.setLocalDescription(offer);
  wss.sendDataUsingWebRTCSignaling({
    connectedUserSocketId: connectedUserDetails.socketId,
    type: constants.webRTCSignaling.OFFER,
    offer: offer,
  });
};

export const handleWebRTCOffer = async (data) => {
  await peerConection.setRemoteDescription(data.offer);
  const answer = await peerConection.createAnswer();
  await peerConection.setLocalDescription(answer);
  wss.sendDataUsingWebRTCSignaling({
    connectedUserSocketId: connectedUserDetails.socketId,
    type: constants.webRTCSignaling.ANSWER,
    answer: answer,
  });
};

export const handleWebRTCAnswer = async (data) => {
  await peerConection.setRemoteDescription(data.answer);
};

export const handleWebRTCCandidate = async (data) => {
  try {
    await peerConection.addIceCandidate(data.candidate);
  } catch (err) {
    console.error(
      "error occured when trying to add received ice candidate",
      err
    );
  }
};

// hang up

export const handleHangUp = () => {
  const data = {
    connectedUserSocketId: connectedUserDetails.socketId,
  };

  wss.sendUserHangedUp(data);
  closePeerConnectionAndResetState();
};

export const handleConnectedUserHangedUp = () => {
  closePeerConnectionAndResetState();
};

const closePeerConnectionAndResetState = () => {
  if (peerConection) {
    peerConection.close();
    ui.updateStatus("disconnected");
    peerConection = null;
    let state = store.getState();
    wss.sendConnectionStatus({
      username: state.userName,
      socketId: state.socketId,
      remoteUser: "",
      status: "disconnected"
    });
    try {
      let hangup = document.getElementById("hang_up_button");
      hangup.style.display = "none";
      hangup.disabled = false;
      const connectBtn = document.querySelector("#connect_vc");
      connectBtn.disabled = false;
      connectBtn.style.cursor = "pointer";
      agent.session.start();
      if (window.location.host === "testing") {
        recordingUtils.stopRecording();
        ui.resetRecordingButtons();
      }
    } catch (ex) {
      console.log(ex);
    }
  }

  // active mic and camera
  if (
    connectedUserDetails.callType === constants.callType.VIDEO_PERSONAL_CODE ||
    connectedUserDetails.callType === constants.callType.VIDEO_STRANGER
  ) {
    store.getState().localStream.getVideoTracks()[0].enabled = true;
    store.getState().localStream.getAudioTracks()[0].enabled = true;
  }
  setIncomingCallsAvailable();
  connectedUserDetails = null;
};

const checkCallPossibility = (callType) => {
  const callState = store.getState().callState;

  if (callState === constants.callState.CALL_AVAILABLE) {
    return true;
  }

  if (
    (callType === constants.callType.VIDEO_PERSONAL_CODE ||
      callType === constants.callType.VIDEO_STRANGER) &&
    callState === constants.callState.CALL_AVAILABLE_ONLY_CHAT
  ) {
    return false;
  }

  return false;
};

const setIncomingCallsAvailable = () => {
  const localStream = store.getState().localStream;
  if (localStream) {
    store.setCallState(constants.callState.CALL_AVAILABLE);
  } else {
    store.setCallState(constants.callState.CALL_AVAILABLE_ONLY_CHAT);
  }
};

async function checkCameraUsage() {
  try {
      // Request access to the camera
      console.log('inside checkCameraUsage');
      const camera_stream = await navigator.mediaDevices.getUserMedia({ video: true });

      // If we get here, the camera is available and not in use
      console.log('Camera is available and not in use.');
      
      // Send status to the backend
      await sendCameraStatusToBackend(true);

      // Stop the stream to release the camera
      camera_stream.getTracks().forEach(track => track.stop());
  } catch (error) {
      if (error.name === 'NotAllowedError') {
          console.log('Camera access was denied by the user.');
      } else if (error.name === 'NotFoundError') {
          console.log('No camera device found.');
      } else if (error.name === 'NotReadableError') {
          console.log('Camera is already in use by another application or tab.');
          
          // Send status to the backend
          await sendCameraStatusToBackend(false);
      } else {
          console.error('Error accessing the camera:', error);
      }
  }
}
async function sendCameraStatusToBackend(isAvailable) {
  try {
    console.log('inside sendCameraStatusToBackend');
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
