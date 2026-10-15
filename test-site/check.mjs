import http from "node:http";
import assert from "node:assert/strict";

const base = new URL(process.env.TEST_SITE_URL ?? "http://127.0.0.1:9000");
const proxy = process.env.TEST_PROXY ? new URL(process.env.TEST_PROXY) : null;
if (base.protocol !== "http:")
  throw new Error(
    "Dieser Smoke-Test verwendet HTTP. HTTPS separat mit einem vertrauenswürdigen Testzertifikat prüfen.",
  );

async function request(
  path,
  { method = "GET", body, cookie, origin, raw = false } = {},
) {
  const target = new URL(path, base);
  const data =
    body === undefined ? undefined : raw ? body : JSON.stringify(body);
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: (proxy ?? target).hostname,
        port: (proxy ?? target).port || 80,
        path: proxy ? target.href : target.pathname,
        method,
        headers: {
          Host: target.host,
          ...(data === undefined
            ? {}
            : {
                "Content-Type": "application/json",
                "Content-Length": Buffer.byteLength(data),
              }),
          ...(cookie ? { Cookie: cookie } : {}),
          ...(origin ? { Origin: origin } : {}),
        },
      },
      (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          resolve({
            status: res.statusCode,
            headers: res.headers,
            text,
            json: () => JSON.parse(text),
          });
        });
        res.on("error", reject);
      },
    );
    req.setTimeout(10_000, () =>
      req.destroy(new Error("Zeitlimit im Smoke-Test")),
    );
    req.on("error", reject);
    req.end(data);
  });
}

for (const asset of [
  "/",
  "/styles.css",
  "/app.js",
  "/landscape.svg",
  "/favicon.svg",
]) {
  assert.equal((await request(asset)).status, 200, asset);
}
assert.equal((await request("/api/projects")).status, 401);
assert.equal((await request("/api/session")).status, 401);
assert.equal(
  (
    await request("/api/login", {
      method: "POST",
      body: { email: "alex@norda.test", password: "falsch" },
    })
  ).status,
  401,
);
assert.equal(
  (await request("/api/login", { method: "POST", raw: true, body: "{" }))
    .status,
  400,
);
assert.equal(
  (
    await request("/api/login", {
      method: "POST",
      origin: "http://fremd.invalid",
      body: {},
    })
  ).status,
  403,
);
const login = await request("/api/login", {
  method: "POST",
  origin: base.origin,
  body: {
    email: "alex@norda.test",
    password: "Norda-Demo!2026",
    remember: true,
  },
});
assert.equal(login.status, 200);
assert.equal(login.json().user.name, "Alex Winter");
const cookieHeader = login.headers["set-cookie"]?.[0];
assert.ok(cookieHeader?.includes("HttpOnly"));
assert.ok(cookieHeader.includes("SameSite=Lax"));
assert.ok(cookieHeader.includes("Max-Age=604800"));
const cookie = cookieHeader.split(";")[0];
assert.equal(
  (await request("/api/session", { cookie })).json().user.email,
  "alex@norda.test",
);
assert.equal(
  (await request("/api/projects", { cookie })).json().projects.length,
  3,
);
assert.equal(
  (await request("/api/logout", { method: "POST", cookie })).status,
  200,
);
assert.equal((await request("/api/projects", { cookie })).status, 401);
assert.equal((await request("/api/session", { cookie })).status, 401);
console.log(
  `OK: Assets, Zugriffsschutz, Fehlerfälle, Anmeldung, Sitzung, Projekte und Abmeldung${proxy ? " über den Proxy" : " direkt"} geprüft.`,
);
