import * as wss from "./wss.js";
import * as constants from "./constants.js";
import * as store from "./store.js";
import * as ui from "./uiInteract.js";

let connectedUserDetails;
let peerConection;
let dataChannel;

const defaultConstraints = {
  audio: true,
  // video: true,
  video: {
    facingMode: { exact: "user" }
  }
};

const configuration = constants.getTurnCred();

export const getLocalPreview = () => {
  navigator.mediaDevices
    .getUserMedia(defaultConstraints)
    .then((stream) => {
      ui.updateLocalVideo(stream);
      ui.showVideoCallButtons();
      store.setCallState(constants.callState.CALL_AVAILABLE);
      store.setLocalStream(stream);
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

  dataChannel = peerConection.createDataChannel("chat");

  dataChannel.onopen = (event) => {
    console.log("Data channel ready to receive data");
    dataChannel.send(JSON.stringify({ "id": "ekyc", "Data": store.getApplicationId() }));
  };

  dataChannel.onclose = (event) => {
    console.log("Data channel closed by remote user");
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
      callingDialogRejectCallHandler();
      ui.updateStatus("disconnected");
      wss.sendConnectionStatus({
        username: state.userName,
        socketId: state.socketId,
        remoteUser: "",
        status: "disconnected"
      });
      try {
        ui.callNFI("onConferenceEnd");
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
        hangup.disabled = false;
        ui.callNFI("onAccept");
        ui.callNFI("onConferenceStarted");
        ui.updateConnectedUser();
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

    for (const track of localStream.getTracks()) {
      peerConection.addTrack(track, localStream);
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

  if (preOfferAnswer === constants.preOfferAnswer.CALL_NOT_ANSWERED) {
    setIncomingCallsAvailable();
    ui.showInfoDialog(preOfferAnswer);
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
    ui.updateStatus("disconnect");
    ui.callNFI("onConferenceEnd");
    peerConection = null;
    let state = store.getState();
    wss.sendConnectionStatus({
      username: state.userName,
      socketId: state.socketId,
      remoteUser: "",
      status: "disconnected"
    });
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