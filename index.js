require("dotenv").config();
const { v4 } = require("uuid");
const http = require("http");
const express = require("express");
const socketio = require("socket.io");
var cors = require("cors");
const ws = require("ws");

const app = express();

app.use(express.static("public"));
app.set("views", __dirname + "/views");
app.set("view engine", "ejs");
app.use(cors());

const server = http.createServer(app);
const io = socketio(server, {
  cors: {
    origin: "*",
  },
});
const sessions = [];

io.on("connection", (socket) => {
  console.log(socket.id);
  socket.on("create:session", () => {
    const session = {
      session_id: v4(),
      socket_id: socket.id,
      users: [],
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
  socket.on("join-session", (data) => {
    const session = sessions.find(
      (session) => session.session_id == data.session_id
    );
    session.users.push(socket.id);
    socket.emit("joined-session", session);
  });
  socket.on("answer", (answer) => {
    console.log(answer.socket_id);
    socket.to(answer.socket_id).emit("answer", {
      description: answer.description,
    });
  });
  socket.on("candidate", (candidate) => {
    socket.to(candidate.socket_id).emit("candidate", candidate.candidate);
  });
  socket.on("close-connection", ({ session }) => {
    for (let user of sessions.find(
      (sessionItem) => session.session_id == sessionItem.session_id
    ).users) {
      socket.to(user).emit("connection-closed");
    }
  });
  socket.on("disconnect", () => {
    const index = sessions.findIndex(
      (session) => session.socket_id === socket.id
    );
    if (index != -1) {
      sessions.splice(index, 1);
    }
  });
});

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

server.listen(process.env.PORT, () => {
  console.log(`App listening at http://localhost:${process.env.PORT}`);
});
