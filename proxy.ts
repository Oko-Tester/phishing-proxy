import http from "node:http";
import net from "node:net";
import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

const logDirectory = path.join(__dirname, "logs");
mkdirSync(logDirectory, { recursive: true, mode: 0o700 });
const logFiles = {
  http: path.join(logDirectory, "http.jsonl"),
  https: path.join(logDirectory, "https.jsonl"),
};
for (const file of Object.values(logFiles)) {
  writeFileSync(file, "", { flag: "a", mode: 0o600 });
}

function logTraffic(protocol: keyof typeof logFiles, entry: Record<string, unknown>) {
  try {
    appendFileSync(logFiles[protocol], JSON.stringify({
      timestamp: new Date().toISOString(),
      ...entry,
    }) + "\n");
  } catch (error) {
    console.error("Protokoll konnte nicht gespeichert werden:", error);
  }
}

// Base64 bewahrt auch Binärdaten unverändert auf.
function encodeBody(data: Buffer) {
  return { encoding: "base64", bytes: data.length, data: data.toString("base64") };
}

const server = http.createServer(async (req: any, res: any) => {
  const id = randomUUID();
  logTraffic("http", {
    id, event: "request", method: req.method, url: req.url,
    headers: req.rawHeaders,
  });
  try {
    const url = new URL(req.url ?? "");

    console.log(req.method, req.url);

    const body: Buffer[] = [];

    for await (const chunk of req) {
      const data = Buffer.from(chunk);
      body.push(data);
      logTraffic("http", {
        id, event: "data", direction: "client-to-server", body: encodeBody(data),
      });
    }
    logTraffic("http", { id, event: "request-end" });

    const upstreamResponse = await fetch(url, {
      method: req.method,
      headers: {
        ...req.headers,
        host: url.host,
      },
      body:
        req.method === "GET" || req.method === "HEAD"
          ? undefined
          : Buffer.concat(body),
      redirect: "manual",
    });

    res.statusCode = upstreamResponse.status;
    logTraffic("http", {
      id, event: "response", status: upstreamResponse.status,
      headers: Array.from(upstreamResponse.headers.entries()),
    });

    upstreamResponse.headers.forEach((value, key) => {
      if (
        key !== "content-length" &&
        key !== "transfer-encoding" &&
        key !== "connection"
      ) {
        res.setHeader(key, value);
      }
    });

    const responseBody = Buffer.from(await upstreamResponse.arrayBuffer());
    logTraffic("http", {
      id, event: "data", direction: "server-to-client", body: encodeBody(responseBody),
    });

    res.end(responseBody);
    logTraffic("http", { id, event: "response-end" });
  } catch (error) {
    logTraffic("http", { id, event: "error", message: String(error) });
    console.error("HTTP-Weiterleitung fehlgeschlagen:", error);
    if (!res.headersSent) {
      res.writeHead(502, { "Content-Type": "text/plain; charset=utf-8" });
      const message = Buffer.from("Der Zielserver konnte nicht erreicht werden.");
      logTraffic("http", {
        id, event: "proxy-response", status: 502,
        headers: res.getHeaders(), body: encodeBody(message),
      });
      res.end(message);
    } else {
      res.destroy();
    }
  }
});

server.on("connect", (req, socket, head) => {
  const id = randomUUID();
  logTraffic("https", {
    id, event: "connect-request", target: req.url, headers: req.rawHeaders,
  });
  console.log("HTTPS-Tunnel angefragt:", req.url);

  // CONNECT enthält ein Ziel wie example.com:443 oder [::1]:443.
  const target = /^(\[[^\]]+\]|[^:/\s]+):(\d+)$/.exec(req.url ?? "");
  const port = Number(target?.[2]);
  if (!target || port < 1 || port > 65535) {
    logTraffic("https", { id, event: "connect-response", status: 400 });
    socket.end("HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n");
    return;
  }

  const host = target[1].replace(/^\[|\]$/g, "");
  const upstream = net.connect({ host, port });
  let connected = false;

  const connectTimeout = setTimeout(() => {
    upstream.destroy(new Error("Zeitlimit beim Verbindungsaufbau erreicht"));
  }, 15_000);

  upstream.on("connect", () => {
    clearTimeout(connectTimeout);
    connected = true;
    socket.write("HTTP/1.1 200 Connection Established\r\n\r\n");
    logTraffic("https", { id, event: "connect-response", status: 200 });

    // Im Tunnel werden ausschließlich verschlüsselte TLS-Bytes gespeichert.
    socket.on("data", (data: Buffer) => {
      logTraffic("https", {
        id, event: "data", direction: "client-to-server", body: encodeBody(data),
      });
    });
    upstream.on("data", (data: Buffer) => {
      logTraffic("https", {
        id, event: "data", direction: "server-to-client", body: encodeBody(data),
      });
    });

    // Eventuell bereits empfangene Tunneldaten ebenfalls weitergeben.
    if (head.length > 0) {
      logTraffic("https", {
        id, event: "data", direction: "client-to-server", body: encodeBody(head),
      });
      upstream.write(head);
    }
    socket.pipe(upstream);
    upstream.pipe(socket);
  });

  upstream.on("error", (error) => {
    logTraffic("https", { id, event: "error", message: error.message });
    console.error("HTTPS-Tunnel fehlgeschlagen:", req.url, error.message);
    if (connected) {
      socket.destroy();
    } else {
      logTraffic("https", { id, event: "connect-response", status: 502 });
      socket.end("HTTP/1.1 502 Bad Gateway\r\nConnection: close\r\n\r\n");
    }
  });

  socket.on("error", (error) => {
    logTraffic("https", { id, event: "client-error", message: error.message });
    upstream.destroy();
  });
  socket.on("close", () => upstream.destroy());
  upstream.on("close", () => {
    logTraffic("https", { id, event: "close" });
    clearTimeout(connectTimeout);
    if (connected) socket.destroy();
  });
});

server.listen(8080, "127.0.0.1", () => {
  console.log("Proxy läuft auf http://127.0.0.1:8080");
});
