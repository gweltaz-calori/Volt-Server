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

joinButton.addEventListener("click", () => {
  console.log(localStream);
  if (!localStream) {
    return;
  }
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

  joinButton.style.display = "none";
  leaveButton.style.display = "flex";
});

socket.on("joined-session", (newSession) => {
  session = newSession;
  initWebRTC();
});
socket.emit("join-session", {
  session_id: location.pathname.replace("/", ""),
});
socket.on("connection-closed", () => {
  joinButton.style.display = "inline";
  localStream = null;
  localConnection.close();
  localConnection = null;
  socket.emit("join-session", {
    session_id: location.pathname.replace("/", ""),
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
  };
  localConnection
    .createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: false })
    .then(async (offer) => {
      offer.sdp = offer.sdp.replace(
        "useinbandfec=1",
        "useinbandfec=1; stereo=1"
      );
      console.log(offer);
      return await localConnection.setLocalDescription(offer);
    })
    .then(() => {
      socket.emit("offer", {
        session_id: location.pathname.replace("/", ""),
        description: localConnection.localDescription,
      });
    });
}

socket.on("offer", (offer) => {
  console.log("RECEIVED OFFER", offer);
});

socket.on("answer", (answer) => {
  localConnection.setRemoteDescription(answer.description);
});

socket.on("candidate", (candidate) => {
  const conn = localConnection;
  conn.addIceCandidate(new RTCIceCandidate(candidate));
});
