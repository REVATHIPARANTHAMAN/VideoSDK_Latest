import * as store from "./store.js";
import * as webRTCHandler from "./RTCHandlerAgent.js";
import * as constants from "./constants.js";
import * as ui from "./uiInteract.js";

let socketIO = null;

export const registerSocketEvents = (socket) => {
  socketIO = socket;

  socket.on("emitUser", (msg) => {
    console.log(msg);
    store.setSocketId(msg.id.connection_id, msg.id.user);
    ui.updatePersonalCode(msg.id.user);
  });

  socket.on("pre-offer", (data) => {
    webRTCHandler.handlePreOffer(data);
  });

  socket.on("pre-offer-answer", (data) => {
    webRTCHandler.handlePreOfferAnswer(data);
  });

  socket.on("user-hanged-up", () => {
    webRTCHandler.handleConnectedUserHangedUp();
  });

  socket.on("redirectHomePage", () => {

    window.location.href = "/userDisconnected";
  });

  let ringtone = new Audio("./audio/user_disconnect.mp3");
  socket.on("disconnect", () => {

    const status_bar = document.querySelector("#status_bar");
    status_bar.style.display = "flex";
    ringtone.play();
    ringtone.pause();
    document.querySelector("#user_id").textContent = "####";
    const connect_vc = document.querySelector("#connect_vc")
    connect_vc.classList.add("btn-secondary");
    connect_vc.classList.remove("btn-success");
    connect_vc.textContent = "Connect VC";
    connect_vc.dataset.status = "disconnected";
  });

  socket.on("connect", () => {
    const status_bar = document.querySelector("#status_bar");
    status_bar.style.display = "none";
  })

  socket.on("webRTC-signaling", (data) => {
    switch (data.type) {
      case constants.webRTCSignaling.OFFER:
        webRTCHandler.handleWebRTCOffer(data);
        break;
      case constants.webRTCSignaling.ANSWER:
        webRTCHandler.handleWebRTCAnswer(data);
        break;
      case constants.webRTCSignaling.ICE_CANDIDATE:
        webRTCHandler.handleWebRTCCandidate(data);
        break;
      default:
        return;
    }
  });
};

export const sendPreOffer = (data) => {
  socketIO.emit("pre-offer", data);
};

export const sendPreOfferAnswer = (data) => {
  socketIO.emit("pre-offer-answer", data);
};

export const sendDataUsingWebRTCSignaling = (data) => {
  socketIO.emit("webRTC-signaling", data);
};

export const sendUserHangedUp = (data) => {
  socketIO.emit("user-hanged-up", data);
};

export const sendConnectionStatus = (data) => {
  socketIO.emit("updateConnectionStatus", data);
};