import { io } from "socket.io-client";

// Keep the server URL in one place so it is easy to change later.
export const socket = io("http://localhost:3001", { autoConnect: true });
