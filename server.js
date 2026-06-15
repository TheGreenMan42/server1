const WebSocket = require("ws");
const http = require("http");

const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  res.writeHead(200);
  res.end("Pixel server is running");
});

const wss = new WebSocket.Server({ server });

// ПОЛЕ 50x50
let pixels = Array(50 * 50).fill("#ffffff");

function broadcast(obj) {
  const payload = JSON.stringify(obj);
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
}

wss.on("connection", ws => {
  // Рандомный ID игрока 0–1000000
  const playerId = Math.floor(Math.random() * 1000001);
  ws.playerId = playerId;

  // Отправляем поле
  ws.send(JSON.stringify({ type: "init", pixels }));

  // Серверное сообщение о входе
  broadcast({
    type: "serverMessage",
    text: `Player [${playerId}] joined in game.`
  });

  ws.on("message", msg => {
    let data;
    try { data = JSON.parse(msg); } catch { return; }

    // Рисование
    if (data.type === "paint") {
      if (typeof data.index !== "number") return;
      if (data.index < 0 || data.index >= pixels.length) return;
      if (typeof data.color !== "string") return;

      pixels[data.index] = data.color;

      broadcast({
        type: "update",
        index: data.index,
        color: data.color
      });
    }

    // Чат
    if (data.type === "chat") {
      // Ник "Server" запрещён
      const nick = (data.nick || "").trim();
      if (!nick || nick.toLowerCase() === "server") return;

      broadcast({
        type: "chat",
        nick: nick,
        text: data.text || "",
        color: data.color || "#ffffff"
      });
    }
  });

  ws.on("close", () => {
    console.log("Кто-то отключился");
  });
});

server.listen(PORT, () => {
  console.log("Server listening on port", PORT);
});
