import { FormEvent, useEffect, useRef, useState } from "react";
import { socket } from "./socket";

type ChatMessage = { id: string; name: string; text: string; time: string };
type JoinReply = { ok: boolean; error?: string; users?: string[]; roomId?: string };

export default function App() {
  const [name, setName] = useState("");
  const [roomId, setRoomId] = useState("study-room");
  const [joined, setJoined] = useState(false);
  const [users, setUsers] = useState<string[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onMessage = (message: ChatMessage) => setMessages((old) => [...old, message]);
    const onUsers = (list: string[]) => setUsers(list);
    const onJoined = ({ name }: { name: string }) => setMessages((old) => [...old, {
      id: crypto.randomUUID(), name: "System", text: `${name} joined the room`, time: new Date().toISOString()
    }]);
    const onLeft = ({ name }: { name: string }) => setMessages((old) => [...old, {
      id: crypto.randomUUID(), name: "System", text: `${name || "A user"} left the room`, time: new Date().toISOString()
    }]);
    socket.on("chat:message", onMessage);
    socket.on("room:users", onUsers);
    socket.on("room:user-joined", onJoined);
    socket.on("room:user-left", onLeft);
    return () => {
      socket.off("chat:message", onMessage);
      socket.off("room:users", onUsers);
      socket.off("room:user-joined", onJoined);
      socket.off("room:user-left", onLeft);
    };
  }, []);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  function joinRoom(e: FormEvent) {
    e.preventDefault(); setError("");
    socket.emit("room:join", { name, roomId }, (reply: JoinReply) => {
      if (!reply.ok) { setError(reply.error || "Could not join room."); return; }
      setJoined(true); setUsers(reply.users || []); setMessages([]);
    });
  }

  function sendMessage(e: FormEvent) {
    e.preventDefault();
    if (!draft.trim()) return;
    socket.emit("chat:send", { text: draft });
    setDraft("");
  }

  function leaveRoom() {
    socket.disconnect();
    socket.connect();
    setJoined(false); setUsers([]); setMessages([]);
  }

  if (!joined) return <main className="join-wrap">
    <form className="join-card" onSubmit={joinRoom}>
      <div className="eyebrow">REAL-TIME STUDY CHAT</div>
      <h1>Join a room</h1>
      <p className="muted">Test Socket.IO with up to four people.</p>
      <label>Your name<input value={name} onChange={e => setName(e.target.value)} maxLength={24} placeholder="e.g. Ayush" required /></label>
      <label>Room ID<input value={roomId} onChange={e => setRoomId(e.target.value)} maxLength={40} placeholder="e.g. study-room" required /></label>
      {error && <p className="error">{error}</p>}
      <button type="submit">Join chat</button>
      <small>Open this page in 3–4 tabs and use the same room ID.</small>
    </form>
  </main>;

  return <main className="app-shell">
    <header className="topbar"><div><div className="eyebrow">STUDY HUB / LIVE</div><h1>{roomId}</h1></div>
      <button className="secondary" onClick={leaveRoom}>Leave room</button></header>
    <section className="layout">
      <aside className="members"><h2>Members <span>{users.length}/4</span></h2>
        {users.map((user, i) => <div className="member" key={`${user}-${i}`}><i />{user}{user === name && <small>you</small>}</div>)}
      </aside>
      <section className="chat"><div className="chat-title"><strong>Room conversation</strong><span className="online">● Connected</span></div>
        <div className="messages">{messages.length === 0 && <div className="empty">Room is ready. Send the first message.</div>}
          {messages.map(m => <article className={`message ${m.name === name ? "mine" : ""}`} key={m.id}>
            <div className="message-meta"><b>{m.name}</b><time>{new Date(m.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time></div>
            <p>{m.text}</p>
          </article>)}<div ref={bottomRef} /></div>
        <form className="composer" onSubmit={sendMessage}><input value={draft} onChange={e => setDraft(e.target.value)} placeholder="Write a message..." maxLength={1000} />
          <button type="submit">Send</button></form>
      </section>
    </section>
  </main>;
}
