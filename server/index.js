import express from "express";
import http from "http";
import cors from "cors";
import { Server } from "socket.io";

const app = express();
app.use(cors({ origin: "http://localhost:5173" }));
app.get("/", (_req, res) => res.json({ status: "ok", service: "Ayush Socket Room" }));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "http://localhost:5173", methods: ["GET", "POST"] }
});

const MAX_USERS_PER_ROOM = 4;
const roomMembers = new Map(); // roomId -> Map(socketId, displayName)

io.on("connection", (socket) => {
  socket.on("room:join", ({ roomId, name } = {}, callback = () => {}) => {
    const cleanRoom = String(roomId || "").trim().slice(0, 40);
    const cleanName = String(name || "").trim().slice(0, 24);
    if (!cleanRoom || !cleanName) return callback({ ok: false, error: "Room ID and name are required." });

    let members = roomMembers.get(cleanRoom);
    if (!members) {
      members = new Map();
      roomMembers.set(cleanRoom, members);
    }
    if (members.size >= MAX_USERS_PER_ROOM) {
      return callback({ ok: false, error: "This room is full (maximum 4 users)." });
    }

    members.set(socket.id, cleanName);
    socket.join(cleanRoom);
    socket.data.roomId = cleanRoom;
    socket.data.name = cleanName;
    callback({ ok: true, roomId: cleanRoom, users: [...members.values()] });
    socket.to(cleanRoom).emit("room:user-joined", { name: cleanName });
    io.to(cleanRoom).emit("room:users", [...members.values()]);
    socket.emit("chat:history", []); // In-memory demo starts with an empty history.
  });

  socket.on("chat:send", ({ text } = {}) => {
    const roomId = socket.data.roomId;
    const message = String(text || "").trim().slice(0, 1000);
    if (!roomId || !message) return;
    io.to(roomId).emit("chat:message", {
      id: `${Date.now()}-${socket.id}`,
      name: socket.data.name,
      text: message,
      time: new Date().toISOString()
    });
  });

  socket.on("disconnect", () => {
    const roomId = socket.data.roomId;
    if (!roomId) return;
    const members = roomMembers.get(roomId);
    if (!members) return;
    const name = members.get(socket.id);
    members.delete(socket.id);
    socket.to(roomId).emit("room:user-left", { name });
    io.to(roomId).emit("room:users", [...members.values()]);
    if (members.size === 0) roomMembers.delete(roomId);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`Socket server listening on http://localhost:${PORT}`));
