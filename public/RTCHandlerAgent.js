import * as wss from "./wssAgent.js";
import * as constants from "./constants.js";
import * as store from "./store.js";
import * as ui from "./uiInteract.js"
import * as agent from "./agent.js";
import * as recordingUtils from "./recordingUtil.js"

let connectedUserDetails;
let peerConection;
let dataChannel;

const defaultConstraints = {
  audio: true,
  video: true
};

const configuration = constants.getTurnCred();

export const getLocalPreview = (constraints, trackStatus) => {
  constraints = constraints || defaultConstraints;
  navigator.mediaDevices
    .getUserMedia(constraints)
    .then((stream) => {
      ui.updateLocalVideo(stream);
      ui.showVideoCallButtons();
      store.setCallState(constants.callState.CALL_AVAILABLE);
      store.setLocalStream(stream);
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
      store.setMediaDevices();
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
  peerConection = new RTCPeerConnection(configuration);

  // dataChannel = peerConection.createDataChannel("chat");

  peerConection.ondatachannel = (event) => {
    const data = event.channel;
    data.onopen = () => {
      console.log("peer connection is ready to receive data channel messages");
    };

    data.onmessage = (event) => {
      const message = JSON.parse(event.data);
      console.log(message);
      window.parent.postMessage(message, '*');
    };
  };


  peerConection.onicecandidate = (event) => {
    if (event.candidate) {
      // send our ice candidates to other peer
      wss.sendDataUsingWebRTCSignaling({
        connectedUserSocketId: connectedUserDetails.socketId,
        type: constants.webRTCSignaling.ICE_CANDIDATE,
        candidate: event.candidate,
      });
    }
  };

  peerConection.onconnectionstatechange = (event) => {
    console.log(peerConection.connectionState);
    ui.updateStatus(peerConection.connectionState);
    let state = store.getState();
    if (peerConection.connectionState === "disconnect" || peerConection.connectionState === "failed") {
      closePeerConnectionAndResetState();
      ui.updateStatus("disconnected");
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
        if (agent.session) {
          agent.session.start();
        }
        if (window.location.host === "testing") {
          recordingUtils.stopRecording();
          ui.resetRecordingButtons();
        }

        window.parent.postMessage({ event: "Waiting For Call" }, '*');
      } catch (ex) {
        console.log(ex);
      }
    }
    if (peerConection && peerConection.connectionState === "connected") {
      wss.sendConnectionStatus({
        username: state.userName,
        socketId: state.socketId,
        remoteUser: state.remoteUser,
        status: "connected"
      });
      try {
        let hangup = document.getElementById("hang_up_button");
        hangup.style.display = "";
        hangup.disabled = false;
        const connectBtn = document.querySelector("#connect_vc");
        connectBtn.disabled = true;
        connectBtn.style.cursor = "not-allowed";
        if (agent.session) {
          agent.session.dispose();
        }
        if (window.location.host === "testing") {
          recordingUtils.startRecording();
          ui.showRecordingPanel();
        }

        window.parent.postMessage({ event: "In Call" }, '*');
      } catch (ex) {
        console.log(ex);
      }
    }
  };

  peerConection.ontrack = (event) => {
    ui.updateRemoteVideo(event.streams[0]);
    store.setRemoteStream(event.streams[0]);
  };

  // add our stream to peer connection
  if (
    connectedUserDetails.callType === constants.callType.VIDEO_PERSONAL_CODE ||
    connectedUserDetails.callType === constants.callType.VIDEO_STRANGER
  ) {
    const localStream = store.getState().localStream;

    if (store.getMute()) {
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

export const sendMessageUsingDataChannel = (message) => {
  const stringifiedMessage = JSON.stringify(message);
  dataChannel.send(stringifiedMessage);
};

export const sendPreOffer = (callType, calleePersonalCode) => {
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
    ui.showCallingDialog(callingDialogRejectCallHandler);
    store.setCallState(constants.callState.CALL_UNAVAILABLE);
    wss.sendPreOffer(data);
  }

  if (
    callType === constants.callType.CHAT_STRANGER ||
    callType === constants.callType.VIDEO_STRANGER
  ) {
    const data = {
      callType,
      calleePersonalCode,
    };
    store.setCallState(constants.callState.CALL_UNAVAILABLE);
    wss.sendPreOffer(data);
  }
};

export const handlePreOffer = (data) => {

  console.log("handlePreOffer", data);
  const { callType, callerSocketId, calleePersonalCode } = data;

  if (!checkCallPossibility()) {
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
    ui.showIncomingCallDialog(callType, acceptCallHandler.bind(this, calleePersonalCode), rejectCallHandler);
  }

  if (
    callType === constants.callType.CHAT_STRANGER
  ) {
    createPeerConnection();
    sendPreOfferAnswer(constants.preOfferAnswer.CALL_ACCEPTED);
  }
};

const acceptCallHandler = (calleePersonalCode) => {
  createPeerConnection();
  console.log(calleePersonalCode)
  store.setRemoteUser(calleePersonalCode);
  sendPreOfferAnswer(constants.preOfferAnswer.CALL_ACCEPTED);
};

const rejectCallHandler = (triggeredAction) => {
  setIncomingCallsAvailable();
  if (triggeredAction === "timer") {
    sendPreOfferAnswer(constants.preOfferAnswer.CALL_NOT_ANSWERED);
  } else {
    sendPreOfferAnswer(constants.preOfferAnswer.CALL_REJECTED);
  }
};

const callingDialogRejectCallHandler = () => {
  const data = {
    connectedUserSocketId: connectedUserDetails.socketId,
  };
  closePeerConnectionAndResetState();

  wss.sendUserHangedUp(data);
};

const sendPreOfferAnswer = (preOfferAnswer, callerSocketId = null) => {
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
