const WebSocket = require("ws");
const http = require("http");
const fs = require("fs");

const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  res.writeHead(200);
  res.end("Pixel server is running");
});

const wss = new WebSocket.Server({ server });

// === ПОЛЕ 50x50 ===
let pixels = Array(50 * 50).fill("#ffffff");

// === ГЛОБАЛЬНЫЙ СЧЁТЧИК ===
let globalPixelCount = 0;

// Загружаем сохранённый счётчик
try {
  if (fs.existsSync("pixelstats.json")) {
    const data = JSON.parse(fs.readFileSync("pixelstats.json", "utf8"));
    globalPixelCount = data.globalPixelCount || 0;
  }
} catch (e) {
  console.log("Ошибка загрузки pixelstats.json:", e);
}

// Сохранение счётчика
function saveStats() {
  fs.writeFileSync("pixelstats.json", JSON.stringify({
    globalPixelCount
  }));
}

// Отправка всем
function broadcast(obj) {
  const payload = JSON.stringify(obj);
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
}

wss.on("connection", ws => {
  // Рандомный ID игрока
  const playerId = Math.floor(Math.random() * 1000001);
  ws.playerId = playerId;

  // Отправляем поле
  ws.send(JSON.stringify({ type: "init", pixels }));

  // Отправляем глобальный счётчик
  ws.send(JSON.stringify({
    type: "globalPixels",
    count: globalPixelCount
  }));

  // Сообщение о входе
  broadcast({
    type: "serverMessage",
    text: `Player [${playerId}] joined in game.`
  });

  ws.on("message", msg => {
    let data;
    try { data = JSON.parse(msg); } catch { return; }

    // === РИСОВАНИЕ ===
    if (data.type === "paint") {
      if (typeof data.index !== "number") return;
      if (data.index < 0 || data.index >= pixels.length) return;
      if (typeof data.color !== "string") return;

      pixels[data.index] = data.color;

      // Увеличиваем глобальный счётчик
      globalPixelCount++;
      saveStats();

      // Отправляем обновление пикселя
      broadcast({
        type: "update",
        index: data.index,
        color: data.color
      });

      // Отправляем обновлённый глобальный счётчик
      broadcast({
        type: "globalPixels",
        count: globalPixelCount
      });
    }

    // === ЧАТ ===
    if (data.type === "chat") {
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
});

server.listen(PORT, () => {
  console.log("Server listening on port", PORT);
});
