const socket = io("/");
const usersInSessions = [];
let session;
let audio = document.querySelector("audio");
let joinButton = document.querySelector(".join");
let leaveButton = document.querySelector(".leave");
let sliderGrab = document.querySelector(".slider_grab");
let sliderFilled = document.querySelector(".slider_filled");
let content = document.querySelector(".content");
let canvas = document.querySelector("canvas");
canvas.width = window.innerWidth;
canvas.height = window.innerHeight - 300;
let canvasCtx = canvas.getContext("2d");
let localStream = null;

const iceConfiguration = {
  iceServers: [
    {
      url: "stun:stun.l.google.com:19302",
    },
    {
      url: "turn:192.158.29.39:3478?transport=udp",
      credential: "JZEOEt2V3Qb0y27GRntt2u2PAYA=",
      username: "28224511:1379330808",
    },
    {
      url: "turn:192.158.29.39:3478?transport=tcp",
      credential: "JZEOEt2V3Qb0y27GRntt2u2PAYA=",
      username: "28224511:1379330808",
    },
  ],
};

let localConnection = null;
let remoteConnection = null;
let sessionStarted = false;
let gainNode = null;
let analyser = null;
let frequency_array = null;

joinButton.addEventListener("click", joinCall);
leaveButton.addEventListener("click", leaveCall);

function joinCall() {
  joinButton.style.display = "none";
  leaveButton.style.display = "flex";
  content.style.display = "flex";

  socket.emit("join-session", {
    session_id: location.pathname.replace("/", ""),
  });
}
function leaveCall() {
  joinButton.style.display = "flex";
  leaveButton.style.display = "none";
  content.style.display = "none";
  localConnection && localConnection.close();
  remoteConnection && remoteConnection.close();
  localStream = null;
  localConnection = null;
  remoteConnection = null;
  socket.emit("leave-session", {
    session_id: session.session_id,
  });
}

socket.on("session-status", ({ started }) => {
  session.started = started;
});

socket.on("joined-session", (newSession) => {
  session = newSession;
  if (session.started) {
    initWebRTC();
  }
});

socket.on("connection-closed", () => {
  leaveCall();
});

socket.on("answer", (answer) => {
  localConnection.setRemoteDescription(answer.description);
});

socket.on("candidate", (candidate) => {
  let connection = localConnection || remoteConnection;
  connection.addIceCandidate(new RTCIceCandidate(candidate));
});

socket.on("session:offer", async (offer) => {
  remoteConnection = new RTCPeerConnection(iceConfiguration);

  remoteConnection.onicecandidate = ({ candidate }) => {
    candidate &&
      socket.emit("candidate", {
        socket_id: offer.socket_id,
        candidate,
      });
  };
  remoteConnection.ontrack = ({ streams: [stream] }) => {
    localStream = stream;
    var ctx = new AudioContext();
    var audiot = new Audio();
    audiot.srcObject = localStream;
    gainNode = ctx.createGain();
    gainNode.gain.value = 1;
    audiot.onloadedmetadata = function () {
      var source = ctx.createMediaStreamSource(audiot.srcObject);
      analyser = ctx.createAnalyser();
      audiot.play();
      audiot.muted = true;
      source.connect(analyser);
      source.connect(gainNode);
      analyser.connect(ctx.destination);
      frequency_array = new Uint8Array(analyser.frequencyBinCount);
      gainNode.connect(ctx.destination);
      update();
    };
  };
  await remoteConnection.setRemoteDescription(offer.description);
  const answer = await remoteConnection.createAnswer();
  answer.sdp = answer.sdp.replace(
    "useinbandfec=1",
    "useinbandfec=1; stereo=1; maxaveragebitrate=510000"
  );
  await remoteConnection.setLocalDescription(answer);
  socket.emit("answer", {
    socket_id: offer.socket_id,
    description: remoteConnection.localDescription,
  });
});

function initWebRTC() {
  localConnection = new RTCPeerConnection(iceConfiguration);
  localConnection.onicecandidate = ({ candidate }) => {
    candidate &&
      socket.emit("candidate", {
        socket_id: session.socket_id,
        candidate,
      });
  };
  localConnection.ontrack = ({ streams: [stream] }) => {
    localStream = stream;
    var ctx = new AudioContext();
    var audiot = new Audio();
    audiot.srcObject = localStream;
    gainNode = ctx.createGain();
    gainNode.gain.value = 1;
    audiot.onloadedmetadata = function () {
      var source = ctx.createMediaStreamSource(audiot.srcObject);
      analyser = ctx.createAnalyser();
      audiot.play();
      audiot.muted = true;
      source.connect(analyser);
      source.connect(gainNode);
      analyser.connect(ctx.destination);
      frequency_array = new Uint8Array(analyser.frequencyBinCount);
      gainNode.connect(ctx.destination);
      update();
    };
  };
  localConnection
    .createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: false })
    .then(async (offer) => {
      offer.sdp = offer.sdp.replace(
        "useinbandfec=1",
        "useinbandfec=1; stereo=1"
      );
      return await localConnection.setLocalDescription(offer);
    })
    .then(() => {
      socket.emit("offer", {
        session_id: session.session_id,
        description: localConnection.localDescription,
      });
    });
}

function onGrab(value) {
  if (!gainNode) {
    return;
  }

  gainNode.gain.value = value;
}

let isGrabbing = false;
let origin = {
  x: 0,
};
let move = {
  x: 109 - 21,
};
let hold = {
  x: 0,
};

sliderGrab.addEventListener("mousedown", ({ x }) => {
  isGrabbing = true;
  origin = { x };
  hold = { x: move.x };
});
window.addEventListener("mousemove", ({ x }) => {
  if (!isGrabbing) {
    return;
  }

  const position = { x };

  move.x = hold.x + position.x - origin.x;
  move.x = clamp(move.x, 0, 109 - 21);

  sliderGrab.style.transform = `translateX(${move.x}px)`;
  sliderFilled.style.width = `${(move.x / (109 - 21)) * 100}%`;

  onGrab(move.x / (109 - 21));
});
window.addEventListener("mouseup", (e) => {
  isGrabbing = false;
});

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

function update() {
  if (!gainNode) {
    return;
  }
  canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
  analyser.getByteFrequencyData(frequency_array);
  let bars = 500;
  let bar_width = canvas.width / bars;
  increment = canvas.height / bars;
  x = 0;

  for (var i = 0; i < bars; i++) {
    //divide a circle into equal parts
    bar_height = (frequency_array[i] * canvas.height) / 300;
    // set coordinates

    y = canvas.height;
    y_end = y - bar_height;
    //draw a bar
    drawBar(x, y, y_end, bar_width, frequency_array[i]);

    x += increment + bar_width;
  }

  requestAnimationFrame(update);
}

function drawBar(x1, y1, y2, width, frequency) {
  var lineColor = "rgb(88,101,242)";
  canvasCtx.strokeStyle = lineColor;
  canvasCtx.lineWidth = width;
  canvasCtx.beginPath();
  canvasCtx.moveTo(x1, y1);
  canvasCtx.lineTo(x1, y2);
  canvasCtx.stroke();
}
