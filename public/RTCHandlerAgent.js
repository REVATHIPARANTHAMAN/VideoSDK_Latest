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
        store.setVideoTrackSender(sender); // separating audio and video  ttracks and storing in store.js
      }
      if (track.kind === "audio") {
        store.setAudioTrackSender(sender);
      }
    }
  }
};

export const sendMessageUsingDataChannel = (message) => { // sending application id to agent helper function
  const stringifiedMessage = JSON.stringify(message);
  dataChannel.send(stringifiedMessage);
};

export const sendPreOffer = (callType, calleePersonalCode) => {// pre offcer - to check agent is availavle or not to call for call
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
    store.setCallState(constants.callState.CALL_UNAVAILABLE); // setting the agent as un availa le  coz already one call is connected
    wss.sendPreOffer(data); // to check agent is availavle or not to call for call
  }

  if (                    // dummy function
    callType === constants.callType.CHAT_STRANGER ||
    callType === constants.callType.VIDEO_STRANGER
  ) {
    const data = {
      callType,
      calleePersonalCode,
    };
    store.setCallState(constants.callState.CALL_UNAVAILABLE); // need to remove during code optimization
    wss.sendPreOffer(data);// 
  }
};

export const handlePreOffer = (data) => {// customer to agent handling agent availablility

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
  store.setRemoteUser(calleePersonalCode); //  display data saved to connected urs
  sendPreOfferAnswer(constants.preOfferAnswer.CALL_ACCEPTED); // to set the status as call is accepted or not
};

const rejectCallHandler = (triggeredAction) => { // function to execute after rejecting the calls
  setIncomingCallsAvailable(); // to get the local stream state based on the local stream state call or chat will be initiated
  if (triggeredAction === "timer") { // display popup auto popup  due to timer
    sendPreOfferAnswer(constants.preOfferAnswer.CALL_NOT_ANSWERED);
  } else {
    sendPreOfferAnswer(constants.preOfferAnswer.CALL_REJECTED);
  }
};

const callingDialogRejectCallHandler = () => { // closing the peer connection after the hangup button from agent app/ customer
  const data = {
    connectedUserSocketId: connectedUserDetails.socketId,
  };
  console.log("data in callingDialogRejectCallHandler" + JSON.stringify(data));
  closePeerConnectionAndResetState(); //  closing the peer connection

  wss.sendUserHangedUp(data);
};

const sendPreOfferAnswer = (preOfferAnswer, callerSocketId = null) => { // sending available or not to handle pre offer
  const socketId = callerSocketId
    ? callerSocketId
    : connectedUserDetails.socketId;
  const data = {
    callerSocketId: socketId,
    preOfferAnswer,
  };
  ui.removeAllDialogs(); // 
  wss.sendPreOfferAnswer(data);
};

export const handlePreOfferAnswer = (data) => { //to initiate call in agent app  // will get info that call is initiated
  const { preOfferAnswer } = data;
  console.log("preofferAnswer", data);
  ui.removeAllDialogs();

  if (preOfferAnswer === constants.preOfferAnswer.CALLEE_NOT_FOUND) { //if call is initiated to not found user
    ui.showInfoDialog(preOfferAnswer);
    setIncomingCallsAvailable();
    // show dialog that callee has not been found
  }

  if (preOfferAnswer === constants.preOfferAnswer.CALL_UNAVAILABLE) { // agent is in call for now so he will not be available for next call until this call is completed
    setIncomingCallsAvailable();
    ui.showInfoDialog(preOfferAnswer);
    // show dialog that callee is not able to connect
  }

  if (preOfferAnswer === constants.preOfferAnswer.CALL_REJECTED) { // user rejected the call
    setIncomingCallsAvailable();
    ui.showInfoDialog(preOfferAnswer);
    // show dialog that call is rejected by the callee
  }

  if (preOfferAnswer === constants.preOfferAnswer.CALL_ACCEPTED) { // user accepts the call
    createPeerConnection(); // call initiate function
    sendWebRTCOffer(); // 
  }
};
// webrtc ---- user for actual call connnection and sending videos
// web socket ---- protocol used to define this call should be connect to particular person
const sendWebRTCOffer = async () => { // 
  const offer = await peerConection.createOffer(); // to get the peer connection ice candidate info - 
  await peerConection.setLocalDescription(offer); // passes info that call is initiated // in remote it will do vise versa
  wss.sendDataUsingWebRTCSignaling({ // 
    connectedUserSocketId: connectedUserDetails.socketId, // detatis to send which user is connected
    type: constants.webRTCSignaling.OFFER, 
    offer: offer,
  });
}; // if the call has been initiated from agent to cust we can use the above function ---- not for now

export const handleWebRTCOffer = async (data) => { // whatever info received from send Webrtc it will handle this function
  await peerConection.setRemoteDescription(data.offer); // setting the remote (the user who is calling) offer details
  const answer = await peerConection.createAnswer(); // creating the channel to send the video data
  await peerConection.setLocalDescription(answer); // setting the answer info in local.
  wss.sendDataUsingWebRTCSignaling({ // sending the offer status to client or remote.
    connectedUserSocketId: connectedUserDetails.socketId,
    type: constants.webRTCSignaling.ANSWER,
    answer: answer,
  });
};

export const handleWebRTCAnswer = async (data) => { // dummy function
  await peerConection.setRemoteDescription(data.answer);
};

export const handleWebRTCCandidate = async (data) => { // adding the ice candidate info in the peerconnection object.
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

export const handleHangUp = () => {// sending msg to server that agent is disconnected and resetting those values (eg connected users details)
  const data = {
    connectedUserSocketId: connectedUserDetails.socketId, 
  };

  wss.sendUserHangedUp(data); // data ----> socket id
  closePeerConnectionAndResetState();// 
};

export const handleConnectedUserHangedUp = () => {
  closePeerConnectionAndResetState();
};

const closePeerConnectionAndResetState = () => { // closing the peer connection and updating the user and sending the data to backend abt disconnection
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
      console.log(ex); // once done based on this event onconnectionstatechange() is invoked
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
  setIncomingCallsAvailable();  // 
  connectedUserDetails = null;
};

const checkCallPossibility = (callType) => { // getting call state from store  and checking whether  user is available for call or not
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

const setIncomingCallsAvailable = () => { // send preoffer will check  the store 
  const localStream = store.getState().localStream;
  if (localStream) {
    store.setCallState(constants.callState.CALL_AVAILABLE); // setting the current call status to store
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
