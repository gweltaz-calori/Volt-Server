const socket = io("/");
const usersInSessions = [];
let session;
let audio = document.querySelector("audio");
let joinButton = document.querySelector(".join");
let leaveButton = document.querySelector(".leave");
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

joinButton.addEventListener("click", joinCall);
leaveButton.addEventListener("click", leaveCall);

function joinCall() {
  joinButton.style.display = "none";
  leaveButton.style.display = "flex";

  socket.emit("join-session", {
    session_id: location.pathname.replace("/", ""),
  });
}
function leaveCall() {
  joinButton.style.display = "flex";
  leaveButton.style.display = "none";
  localConnection && localConnection.close();
  remoteConnection && remoteConnection.close();
  localStream = null;
  localConnection = null;
  remoteConnection = null;
}

socket.on("session-status", ({ started }) => {
  console.log("SESSION STATUS ", started);
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
  console.log("on answer");
  localConnection.setRemoteDescription(answer.description);
});

socket.on("candidate", (candidate) => {
  console.log("on candidate");
  let connection = localConnection || remoteConnection;
  connection.addIceCandidate(new RTCIceCandidate(candidate));
});

socket.on("session:offer", async (offer) => {
  console.log("on offer");
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
    var gainNode = ctx.createGain();
    gainNode.gain.value = 1;
    audiot.onloadedmetadata = function () {
      var source = ctx.createMediaStreamSource(audiot.srcObject);
      audiot.play();
      audiot.muted = true;
      source.connect(gainNode);
      gainNode.connect(ctx.destination);
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
    var gainNode = ctx.createGain();
    gainNode.gain.value = 1;
    audiot.onloadedmetadata = function () {
      var source = ctx.createMediaStreamSource(audiot.srcObject);
      audiot.play();
      audiot.muted = true;
      source.connect(gainNode);
      gainNode.connect(ctx.destination);
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
