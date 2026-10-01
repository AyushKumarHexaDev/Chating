import { io } from "socket.io-client";

const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL ||
  "https://chating-production-a695.up.railway.app";

export const socket = io(SOCKET_URL, {
  autoConnect: true
});
