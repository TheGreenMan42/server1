const WebSocket = require("ws");

const PORT = 8080;
const GRID_SIZE = 50;
const TOTAL_PIXELS = GRID_SIZE * GRID_SIZE;

const wss = new WebSocket.Server({ port: PORT });

const pixels = Array(TOTAL_PIXELS).fill("#ffffff");

wss.on("connection", (ws) => {
    console.log("Кто-то подключился");

    ws.send(JSON.stringify({
        type: "init",
        pixels: pixels
    }));

    ws.on("message", (msg) => {
        let data;
        try { data = JSON.parse(msg); } catch { return; }

        if (data.type === "paint") {
            const i = data.index;
            const color = data.color;

            if (typeof i !== "number") return;
            if (i < 0 || i >= TOTAL_PIXELS) return;
            if (typeof color !== "string") return;

            pixels[i] = color;

            const payload = JSON.stringify({
                type: "update",
                index: i,
                color: color
            });

            wss.clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(payload);
                }
            });
        }

        if (data.type === "chat") {
            const payload = JSON.stringify({
                type: "chat",
                nick: data.nick || "Unknown",
                text: data.text || "",
                color: data.color || "#ffffff"
            });

            wss.clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(payload);
                }
            });
        }
    });

    ws.on("close", () => {
        console.log("Кто-то отключился");
    });
});

console.log(`Сервер запущен на порту ${PORT}, поле ${GRID_SIZE}x${GRID_SIZE}`);
