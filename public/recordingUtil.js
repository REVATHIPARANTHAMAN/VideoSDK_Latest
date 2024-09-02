import * as store from "./store.js";

let mediaRecorder;

const vp9Codec = "video/webm; codecs=vp=9";
const vp9Options = { mimeType: vp9Codec };
const recordedChunks = [];

export const startRecording = () => {

  const remoteStream = document.getElementById("remote_video");
  const localStream = document.getElementById("local_video");

  let canvas = document.createElement("canvas");
  // Capture canvas stream
  const ctx = canvas.getContext('2d');
  requestAnimationFrame(drawVideos.bind(this, canvas, remoteStream, localStream, ctx));
  const canvasStream = canvas.captureStream();
  if (MediaRecorder.isTypeSupported(vp9Codec)) {
    mediaRecorder = new MediaRecorder(canvasStream, vp9Options);
  } else {
    mediaRecorder = new MediaRecorder(canvasStream);
  }

  mediaRecorder.ondataavailable = handleDataAvailable;
  mediaRecorder.start();
};

function drawVideos(canvas, remoteStream, localStream, ctx) {
  // Set canvas size
  canvas.width = remoteStream.videoWidth;
  canvas.height = remoteStream.videoHeight;

  // Clear canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw first video
  ctx.drawImage(remoteStream, 0, 0, canvas.width, canvas.height);

  // Draw second video on top of the first (with transparency)
  ctx.globalAlpha = 2; // Adjust transparency
  ctx.drawImage(localStream, 0, canvas.height - 150, 150, 150);

  requestAnimationFrame(drawVideos.bind(this,canvas, remoteStream, localStream, ctx));
}


export const pauseRecording = () => {
  mediaRecorder.pause();
};

export const resumeRecording = () => {
  mediaRecorder.resume();
};

export const stopRecording = () => {
  mediaRecorder.stop();
};

const downloadRecordedVideo = () => {
  const blob = new Blob(recordedChunks, {
    type: "video/webm",
  });

  // const url = URL.createObjectURL(blob);
  // const a = document.createElement("a");
  // document.body.appendChild(a);
  // a.style = "display: none;";
  // a.href = url;
  // a.download = "recording.webm";
  // a.click();
  // window.URL.revokeObjectURL(url);

  const myHeaders = new Headers();
  myHeaders.append("Content-Type", "video/webm");
  let appId = "";
  appId = store.getApplicationId();
  if (!appId) {
    appId = `Recording${Date.now()}`; // todo we should not use this ,this is now testing purpose only.
  }
  myHeaders.append("fileName", appId);

  const file = blob;

  const requestOptions = {
    method: "POST",
    headers: myHeaders,
    body: file,
    redirect: "follow"
  };

  fetch("/upload-file", requestOptions)
    .then((response) => response.text())
    .then((result) => console.log(result))
    .catch((error) => console.error(error));
};

const handleDataAvailable = (event) => {
  if (event.data.size > 0) {
    recordedChunks.push(event.data);
    downloadRecordedVideo();
  }
};
