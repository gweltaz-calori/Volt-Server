const { v4 } = require("uuid");
const http = require("http");
const express = require("express");
/* const socketio = require("socket.io"); */
var cors = require("cors");
const ws = require("ws");

const app = express();
const port = 3000;

app.set("views", __dirname + "/views");
app.set("view engine", "ejs");
app.use(cors());

/* const io = socketio(server); */

const sessions = [];
const websockets = {};

const server = http.createServer(app);
const wss = new ws.Server({ server });

wss.getUniqueID = function () {
  function s4() {
    return Math.floor((1 + Math.random()) * 0x10000)
      .toString(16)
      .substring(1);
  }
  return s4() + s4() + "-" + s4();
};

wss.on("connection", function connection(ws) {
  ws.id = wss.getUniqueID();
  websockets[ws.id] = ws;
  ws.on("message", function incoming(message) {
    try {
      const data = JSON.parse(message.toString());
      switch (data.type) {
        case "create:session":
          const session = {
            session_id: v4(),
            socket_id: ws.id,
            users: [],
          };
          sessions.push(session);
          ws.send(
            JSON.stringify({
              type: "session:created",
              data: {
                session,
              },
            })
          );
          break;
        case "join-session":
          {
            const session = sessions.find(
              (session) => session.session_id === data.session_id
            );
            session.users.push(ws);
          }

          break;
        default:
          break;
      }
    } catch (e) {
      console.log(ws.id);
      console.log(message);
    }
  });

  ws.on("close", () => {
    const index = sessions.findIndex((session) => session.socket_id === ws.id);
    if (index != -1) {
      sessions.splice(index, 1);
    }
  });
});

/* io.on("connection", (socket) => {
  socket.on("create:session", () => {
    const session = {
      session_id: v4(),
      socket_id: socket.id,
    };
    sessions.push(session);
    socket.emit("session:created", session);
  });

  socket.on("data", (data) => {
    console.log(data);
  });

  socket.on("offer", (data) => {
    socket
      .to(
        sessions.find((session) => session.session_id == data.session_id)
          .socket_id
      )
      .emit("offer", {
        description: data.description,
        socket_id: socket.id,
      });
  });

  socket.on("answer", (answer) => {
    socket.to(answer.socket_id).emit("answer", {
      description: answer.description,
    });
  });

  socket.on("candidate", (candidate) => {
    socket.to(candidate.socket_id).emit("candidate", candidate.candidate);
  });

  socket.on("disconnect", () => {
    const index = sessions.findIndex(
      (session) => session.socket_id === socket.id
    );
    if (index != -1) {
      sessions.splice(index, 1);
    }
  });
}); */

app.get("/:session_id", async (req, res) => {
  const session = sessions.find(
    (session) => session.session_id === req.params.session_id
  );
  if (session) {
    res.render("index");
  } else {
    res.status(404).send("404");
  }
});

server.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
});
