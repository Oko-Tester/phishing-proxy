import http from "node:http";
import https from "node:https";
import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { TLSSocket } from "node:tls";

const publicDirectory = path.join(__dirname, "public");
const demoUser = {
  name: "Alex Winter",
  email: "alex@norda.test",
  initials: "AW",
};
const demoPassword = "Norda-Demo!2026";
const sessions = new Map<string, { expires: number }>();
const projects = [
  {
    name: "Website Relaunch",
    category: "Design & Entwicklung",
    initials: "WR",
    color: "sage",
    progress: 72,
    status: "In Arbeit",
    date: "24. Okt.",
    members: ["AW", "LS", "MK"],
  },
  {
    name: "Brand Guidelines",
    category: "Marke & Strategie",
    initials: "BG",
    color: "sand",
    progress: 100,
    status: "Abgeschlossen",
    date: "18. Okt.",
    members: ["LS", "AW"],
  },
  {
    name: "Herbstkampagne",
    category: "Marketing",
    initials: "HK",
    color: "lavender",
    progress: 38,
    status: "In Arbeit",
    date: "30. Okt.",
    members: ["MK", "LS"],
  },
];

function json(res: http.ServerResponse, status: number, body: unknown) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(body));
}

function sessionToken(req: http.IncomingMessage) {
  return (req.headers.cookie ?? "")
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("norda_session="))
    ?.slice("norda_session=".length);
}

function authenticated(req: http.IncomingMessage) {
  const token = sessionToken(req);
  if (!token) return false;
  const session = sessions.get(token);
  if (!session || session.expires <= Date.now()) {
    sessions.delete(token);
    return false;
  }
  return true;
}

async function handler(req: http.IncomingMessage, res: http.ServerResponse) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "same-origin");
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; style-src 'self'; script-src 'self'; img-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
  );
  try {
    const url = new URL(req.url ?? "/", "http://localhost");
    if (url.pathname.startsWith("/api/")) {
      if (req.method === "POST") {
        if (
          req.headers.origin &&
          new URL(req.headers.origin).host !== req.headers.host
        ) {
          json(res, 403, { error: "Diese Anfrage ist nicht erlaubt." });
          return;
        }
        if (url.pathname === "/api/login") {
          if (!req.headers["content-type"]?.startsWith("application/json")) {
            json(res, 415, { error: "Bitte JSON senden." });
            return;
          }
          const chunks: Buffer[] = [];
          let size = 0;
          for await (const chunk of req) {
            const data = Buffer.from(chunk);
            size += data.length;
            if (size > 16_384) {
              json(res, 413, { error: "Die Anfrage ist zu groß." });
              return;
            }
            chunks.push(data);
          }
          let credentials;
          try {
            credentials = JSON.parse(Buffer.concat(chunks).toString("utf8"));
          } catch {
            json(res, 400, { error: "Die Anfrage enthält ungültiges JSON." });
            return;
          }
          if (
            credentials?.email !== demoUser.email ||
            credentials?.password !== demoPassword
          ) {
            json(res, 401, {
              error:
                "E-Mail oder Passwort stimmt nicht. Nutze den Demo-Zugang unten.",
            });
            return;
          }
          const lifetime =
            credentials.remember === true ? 7 * 24 * 60 * 60 : 12 * 60 * 60;
          const token = randomBytes(32).toString("hex");
          const previousToken = sessionToken(req);
          if (previousToken) sessions.delete(previousToken);
          for (const [key, value] of sessions)
            if (value.expires <= Date.now()) sessions.delete(key);
          sessions.set(token, { expires: Date.now() + lifetime * 1000 });
          res.setHeader(
            "Set-Cookie",
            `norda_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${lifetime}${req.socket instanceof TLSSocket ? "; Secure" : ""}`,
          );
          json(res, 200, { user: demoUser });
          return;
        }
        if (url.pathname === "/api/logout") {
          const token = sessionToken(req);
          if (token) sessions.delete(token);
          res.setHeader(
            "Set-Cookie",
            "norda_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0",
          );
          json(res, 200, { ok: true });
          return;
        }
      }
      if (
        req.method === "GET" &&
        (url.pathname === "/api/session" || url.pathname === "/api/projects")
      ) {
        if (!authenticated(req)) {
          json(res, 401, { error: "Bitte melde dich an." });
          return;
        }
        json(
          res,
          200,
          url.pathname === "/api/session" ? { user: demoUser } : { projects },
        );
        return;
      }
      json(res, 404, { error: "Endpunkt nicht gefunden." });
      return;
    }
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.setHeader("Allow", "GET, HEAD");
      json(res, 405, { error: "Methode nicht erlaubt." });
      return;
    }
    const assets: Record<string, [string, string]> = {
      "/": ["index.html", "text/html; charset=utf-8"],
      "/styles.css": ["styles.css", "text/css; charset=utf-8"],
      "/app.js": ["app.js", "text/javascript; charset=utf-8"],
      "/landscape.svg": ["landscape.svg", "image/svg+xml"],
      "/favicon.svg": ["favicon.svg", "image/svg+xml"],
    };
    const asset = assets[url.pathname];
    if (!asset) {
      json(res, 404, { error: "Seite nicht gefunden." });
      return;
    }
    const content = await readFile(path.join(publicDirectory, asset[0]));
    res.writeHead(200, {
      "Content-Type": asset[1],
      "Cache-Control": "no-store",
    });
    res.end(req.method === "HEAD" ? undefined : content);
  } catch (error) {
    console.error("Testwebsite:", error);
    if (!res.headersSent)
      json(res, 500, { error: "Die Anfrage konnte nicht verarbeitet werden." });
    else res.destroy();
  }
}

async function start() {
  const certFile = process.env.TEST_SITE_TLS_CERT;
  const keyFile = process.env.TEST_SITE_TLS_KEY;
  if (Boolean(certFile) !== Boolean(keyFile))
    throw new Error(
      "Für HTTPS müssen TEST_SITE_TLS_CERT und TEST_SITE_TLS_KEY gesetzt sein.",
    );
  const secure = Boolean(certFile && keyFile);
  const port = Number(process.env.TEST_SITE_PORT ?? (secure ? 9443 : 9000));
  const server = secure
    ? https.createServer(
        { cert: await readFile(certFile!), key: await readFile(keyFile!) },
        handler,
      )
    : http.createServer(handler);
  server.on("error", (error) => {
    console.error("Testwebsite konnte nicht gestartet werden:", error.message);
    process.exitCode = 1;
  });
  server.listen(port, "127.0.0.1", () => {
    console.log(
      `Norda Testwebsite: ${secure ? "https" : "http"}://127.0.0.1:${port}`,
    );
    console.log(`Demo-Zugang: ${demoUser.email} / ${demoPassword}`);
  });
}

start().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
