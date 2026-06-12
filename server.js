const WebSocket = require("ws");
const http = require("http");

const PORT = process.env.PORT || 3000;

// простой HTTP-сервер (Render этого требует)
const server = http.createServer((req, res) => {
  res.writeHead(200);
  res.end("Pixel server is running");
});

const wss = new WebSocket.Server({ server });

let pixels = Array(25 * 25).fill("#ffffff");

wss.on("connection", ws => {
  // отправляем текущее состояние новому клиенту
  ws.send(JSON.stringify({ type: "init", pixels }));

  ws.on("message", msg => {
    let data;
    try {
      data = JSON.parse(msg);
    } catch {
      return;
    }

    if (data.type === "paint") {
      const index = data.index;
      const color = data.color;

      if (index < 0 || index >= pixels.length) return;

      pixels[index] = color;

      // рассылаем всем
      wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({
            type: "update",
            index,
            color
          }));
        }
      });
    }
  });
});

server.listen(PORT, () => {
  console.log("Server listening on port", PORT);
});
