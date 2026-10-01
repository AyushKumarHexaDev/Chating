import express from "express";
import http from "http";
import cors from "cors";
import { Server } from "socket.io";

const app = express();

const allowedOrigins = (
  process.env.CORS_ORIGIN ||
  "http://localhost:5173,http://127.0.0.1:5173,https://ayushkumarhexadev.github.io"
)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("CORS not allowed for this origin"));
      }
    },
    methods: ["GET", "POST"],
    credentials: true,
  })
);

app.use(express.json());

app.get("/", (_req, res) => {
  res.json({
    status: "ok",
    service: "Ayush Socket Room",
  });
});

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

const MAX_USERS_PER_ROOM = 4;
const roomMembers = new Map();

io.on("connection", (socket) => {
  console.log("Connected:", socket.id);

  socket.on("room:join", ({ roomId, name } = {}, callback = () => {}) => {
    const cleanRoom = String(roomId || "").trim().slice(0, 40);
    const cleanName = String(name || "").trim().slice(0, 24);

    if (!cleanRoom || !cleanName) {
      return callback({
        ok: false,
        error: "Room ID and name are required.",
      });
    }

    // Leave the previous room first, if this socket already joined one.
    const previousRoom = socket.data.roomId;

    if (previousRoom) {
      const previousMembers = roomMembers.get(previousRoom);

      if (previousMembers) {
        const previousName = previousMembers.get(socket.id);
        previousMembers.delete(socket.id);

        socket.to(previousRoom).emit("room:user-left", {
          name: previousName,
        });

        io.to(previousRoom).emit(
          "room:users",
          [...previousMembers.values()]
        );

        if (previousMembers.size === 0) {
          roomMembers.delete(previousRoom);
        }
      }

      socket.leave(previousRoom);
      socket.data.roomId = null;
      socket.data.name = null;
    }

    let members = roomMembers.get(cleanRoom);

    if (!members) {
      members = new Map();
      roomMembers.set(cleanRoom, members);
    }

    if (members.size >= MAX_USERS_PER_ROOM) {
      return callback({
        ok: false,
        error: "This room is full (maximum 4 users).",
      });
    }

    members.set(socket.id, cleanName);
    socket.join(cleanRoom);

    socket.data.roomId = cleanRoom;
    socket.data.name = cleanName;

    callback({
      ok: true,
      roomId: cleanRoom,
      users: [...members.values()],
    });

    socket.to(cleanRoom).emit("room:user-joined", {
      name: cleanName,
    });

    io.to(cleanRoom).emit(
      "room:users",
      [...members.values()]
    );

    socket.emit("chat:history", []);
  });

  socket.on("chat:send", ({ text } = {}) => {
    const roomId = socket.data.roomId;
    const message = String(text || "").trim().slice(0, 1000);

    if (!roomId || !message) return;

    io.to(roomId).emit("chat:message", {
      id: `${Date.now()}-${socket.id}`,
      name: socket.data.name,
      text: message,
      time: new Date().toISOString(),
    });
  });

  socket.on("disconnect", () => {
    console.log("Disconnected:", socket.id);

    const roomId = socket.data.roomId;
    if (!roomId) return;

    const members = roomMembers.get(roomId);
    if (!members) return;

    const name = members.get(socket.id);
    members.delete(socket.id);

    socket.to(roomId).emit("room:user-left", { name });

    io.to(roomId).emit(
      "room:users",
      [...members.values()]
    );

    if (members.size === 0) {
      roomMembers.delete(roomId);
    }
  });
});

const PORT = process.env.PORT || 3001;

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Socket server listening on port ${PORT}`);
});