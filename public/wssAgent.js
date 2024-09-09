import * as store from "./store.js";
import * as webRTCHandler from "./RTCHandlerAgent.js";
import * as constants from "./constants.js";
import * as ui from "./uiInteract.js";
import * as sessionTool from "./agent.js";

let socketIO = null;

export const registerSocketEvents = (socket) => { // wss agent handles the events  from agent 
  socketIO = socket;

  socket.on("emitUser", (msg) => {// emit user --- after estableshing connection from socket it returns the id
    console.log("socket connected emitUser" + JSON.stringify(msg));
    store.setSocketId(msg.id.connection_id, msg.id.user);
    ui.updatePersonalCode(msg.id.user);
    const connect_vc = document.querySelector("#connect_vc");
    connect_vc.classList.remove("btn-secondary");
    connect_vc.classList.add("btn-success");
    connect_vc.textContent = "Disconnect VC";
    connect_vc.dataset.status = "connected";
    document.querySelector("#status").textContent = "VC Connected";
    sessionTool.session.start();
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

    ringtone.play();
    const status_bar = document.querySelector("#status_bar");// vc connected disconnected  popup
    status_bar.style.display = "flex";
    document.querySelector("#user_id").textContent = "####";
    const connect_vc = document.querySelector("#connect_vc")
    connect_vc.classList.add("btn-secondary");
    connect_vc.classList.remove("btn-success");
    connect_vc.textContent = "Connect VC";
    connect_vc.dataset.status = "disconnected";
    console.log("socket disconnected");
    //const currentTimeInMilliseconds = Date.now();
    //console.log("Socket Disconnected timestamp" + currentTimeInMilliseconds);
    getFormattedTimestamp();
    console.log("Socket disconnected time stamp" +getFormattedTimestamp() );
    ringtone.pause();
    sessionTool.session.dispose();
  });

  socket.on("connect", () => { // on is to receive communications
    const status_bar = document.querySelector("#status_bar");
    status_bar.style.display = "none";
    console.log("socket connected");
     getFormattedTimestamp();
    console.log("Socket Connected time stamp" +getFormattedTimestamp() );
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

export const sendDataUsingWebRTCSignaling = (data) => { // to send data we are using emit function
  socketIO.emit("webRTC-signaling", data);
};

export const sendUserHangedUp = (data) => {
  socketIO.emit("user-hanged-up", data);
};

export const sendConnectionStatus = (data) => {
  socketIO.emit("updateConnectionStatus", data);
};
function getFormattedTimestamp() {
  const now = new Date();

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0'); // Months are 0-based
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const milliseconds = String(now.getMilliseconds()).padStart(3, '0');

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${milliseconds}`;
}

console.log("getFormattedTimestamp" +getFormattedTimestamp());