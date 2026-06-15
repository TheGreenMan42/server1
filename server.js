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

// === ДАННЫЕ ИГРОКОВ ===
let players = {}; // playerId: { pixels, unlockedColors, color }

// === ЗАГРУЗКА СТАТИСТИКИ ===
try {
  if (fs.existsSync("pixelstats.json")) {
    const data = JSON.parse(fs.readFileSync("pixelstats.json", "utf8"));
    globalPixelCount = data.globalPixelCount || 0;
    players = data.players || {};
  }
} catch (e) {
  console.log("Ошибка загрузки pixelstats.json:", e);
}

// === СОХРАНЕНИЕ ===
function saveStats() {
  fs.writeFileSync("pixelstats.json", JSON.stringify({
    globalPixelCount,
    players
  }));
}

// === ОТПРАВКА ВСЕМ ===
function broadcast(obj) {
  const payload = JSON.stringify(obj);
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
}

wss.on("connection", ws => {
  // === РАНДОМНЫЙ ID ===
  const playerId = Math.floor(Math.random() * 1000001);
  ws.playerId = playerId;

  // === СОЗДАЁМ ИГРОКА ===
  if (!players[playerId]) {
    players[playerId] = {
      pixels: 0,
      unlockedColors: ["black", "white", "blue", "red", "yellow", "cyan", "green", "pink", "purple"],
      color: "#000000"
    };
  }

  // === ОТПРАВЛЯЕМ ПОЛЕ ===
  ws.send(JSON.stringify({ type: "init", pixels }));

  // === ОТПРАВЛЯЕМ ГЛОБАЛЬНЫЙ СЧЁТЧИК ===
  ws.send(JSON.stringify({
    type: "globalPixels",
    count: globalPixelCount
  }));

  // === ОТПРАВЛЯЕМ ЛИЧНЫЕ ДАННЫЕ ===
  ws.send(JSON.stringify({
    type: "playerPixels",
    count: players[playerId].pixels
  }));

  ws.send(JSON.stringify({
    type: "setColor",
    color: players[playerId].color
  }));

  ws.send(JSON.stringify({
    type: "unlockedColors",
    colors: players[playerId].unlockedColors
  }));

  // === СООБЩЕНИЕ О ВХОДЕ ===
  broadcast({
    type: "serverMessage",
    text: `Player [${playerId}] joined in game.`
  });

  ws.on("message", msg => {
    let data;
    try { data = JSON.parse(msg); } catch { return; }

    // === ЗАПРОС НА СМЕНУ ЦВЕТА ===
    if (data.type === "requestColor") {
      const col = data.color;
      if (players[playerId].unlockedColors.includes(col)) {
        players[playerId].color = col;
        ws.send(JSON.stringify({
          type: "setColor",
          color: col
        }));
        saveStats();
      }
    }

    // === РИСОВАНИЕ ===
    if (data.type === "paint") {
      if (typeof data.index !== "number") return;
      if (data.index < 0 || data.index >= pixels.length) return;

      const color = players[playerId].color;
      pixels[data.index] = color;

      // === ЛИЧНЫЙ СЧЁТЧИК ===
      players[playerId].pixels++;
      ws.send(JSON.stringify({
        type: "playerPixels",
        count: players[playerId].pixels
      }));

      // === ГЛОБАЛЬНЫЙ СЧЁТЧИК ===
      globalPixelCount++;
      broadcast({
        type: "globalPixels",
        count: globalPixelCount
      });

      saveStats();

      // === ОБНОВЛЕНИЕ ПИКСЕЛЯ ВСЕМ ===
      broadcast({
        type: "update",
        index: data.index,
        color: color
      });
    }

    // === ПОКУПКА ЦВЕТА ===
    if (data.type === "buyColor") {
      const col = data.color;
      const cost = {
        gray: 150,
        orange: 500,
        darkgreen: 999
      };

      if (!cost[col]) return;
      if (players[playerId].unlockedColors.includes(col)) return;
      if (players[playerId].pixels < cost[col]) return;

      players[playerId].unlockedColors.push(col);

      ws.send(JSON.stringify({
        type: "unlockColor",
        color: col
      }));

      saveStats();
    }

    // === ЧАТ ===
    if (data.type === "chat") {
      const nick = (data.nick || "").trim();
      if (!nick || nick.toLowerCase() === "server") return;

      broadcast({
        type: "chat",
        nick: nick,
        text: data.text || "",
        color: players[playerId].color
      });
    }
  });
});

server.listen(PORT, () => {
  console.log("Server listening on port", PORT);
});
