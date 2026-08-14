/** Socket smoke: connect, subscribe, trigger jitter, await odds:update. */
import { io } from "socket.io-client";

const BASE = process.env.BASE ?? "http://localhost:3100";
const socket = io(BASE, { path: "/socket.io", transports: ["websocket"] });

const timeout = setTimeout(() => {
  console.error("SOCKET SMOKE FAILED: no odds:update within 10s");
  process.exit(1);
}, 10_000);

socket.on("connect", async () => {
  socket.emit("subscribe:live");
  const res = await fetch(`${BASE}/api/dev/tools`, { method: "PUT" });
  if (!res.ok) {
    console.error("jitter failed", res.status);
    process.exit(1);
  }
});

socket.on("odds:update", (update) => {
  clearTimeout(timeout);
  console.log("SOCKET SMOKE PASSED:", JSON.stringify(update));
  socket.close();
  process.exit(0);
});

socket.on("connect_error", (err) => {
  console.error("socket connect error:", err.message);
  process.exit(1);
});
