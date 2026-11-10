
import { DurableObject } from "cloudflare:workers";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/") {
      return Response.json({
        status: "online",
        service: "Watch Together API",
        version: "1.0"
      });
    }

    if (url.pathname === "/api/rooms" && request.method === "POST") {
      const roomId = crypto.randomUUID().replaceAll("-", "").slice(0, 8);
      const room = env.ROOMS.getByName(roomId);

      await room.fetch("https://room.internal/init", {
        method: "POST"
      });

      return Response.json({
        success: true,
        roomId,
        roomUrl: `/room/${roomId}`
      });
    }

    if (url.pathname.startsWith("/ws/")) {
      const roomId = url.pathname.split("/")[2];

      if (!roomId) {
        return new Response("Room ID required", { status: 400 });
      }

      const room = env.ROOMS.getByName(roomId);
      return room.fetch(request);
    }

    return new Response("Not Found", { status: 404 });
  }
};

export class WatchRoom extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.ctx = ctx;
  }

  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === "/init") {
      return new Response("Room initialized");
    }

    if (url.pathname !== "/ws") {
      return new Response("Not Found", { status: 404 });
    }

    if (!url.pathname.startsWith("/ws")) {
  return new Response("Not Found", { status: 404 });
}
    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];

    this.ctx.acceptWebSocket(server);

    server.send(JSON.stringify({
      type: "connected",
      message: "Connected to Watch Together"
    }));

    return new Response(null, {
      status: 101,
      webSocket: client
    });
  }

  async webSocketMessage(ws, message) {
    let data;

    try {
      data = JSON.parse(message);
    } catch {
      ws.send(JSON.stringify({
        type: "error",
        message: "Invalid message"
      }));
      return;
    }

    const allowedTypes = ["chat", "play", "pause", "seek"];

    if (!allowedTypes.includes(data.type)) {
      return;
    }

    const outgoing = JSON.stringify(data);

    for (const socket of this.ctx.getWebSockets()) {
      if (socket !== ws) {
        socket.send(outgoing);
      }
    }
  }

  async webSocketClose() {}

  async webSocketError() {}
}
