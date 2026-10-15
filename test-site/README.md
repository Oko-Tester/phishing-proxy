# Norda – lokale Login-Testwebsite

Eigenständige Demo mit fiktiver Marke, responsiver Anmeldeseite und Projektübersicht. Keine externen Dienste, keine zusätzlichen npm-Abhängigkeiten. Der Server lauscht ausschließlich auf `127.0.0.1`.

## Starten

Im Projektverzeichnis in zwei Terminals ausführen:

```bash
npm run test-site
```

```bash
npm run proxy
```

Website: <http://127.0.0.1:9000>

| Zugang   | Wert              |
| -------- | ----------------- |
| E-Mail   | `alex@norda.test` |
| Passwort | `Norda-Demo!2026` |

Alternativ trägt „Demo-Zugang verwenden“ die Zugangsdaten ein. Falsche Zugangsdaten erzeugen eine Fehlermeldung. Nach der Anmeldung sind die Projektübersicht, Aktualisieren und Abmelden verfügbar. Beim erneuten Laden bleibt die Anmeldung über ein HttpOnly-Sitzungscookie erhalten. Alle Sitzungen liegen im Arbeitsspeicher und verschwinden nach einem Serverneustart.

Dies ist eine Testanmeldung mit einem fest eingebauten Demo-Konto. Ausschließlich die mitgelieferten Demo-Zugangsdaten verwenden.

## Über den Proxy testen

Browser können `localhost` und Loopback-Adressen automatisch am Proxy vorbeileiten. Das bloße Öffnen der Seite beweist daher noch nicht, dass sie über den Proxy geladen wurde.

Für einen reproduzierbaren Test ohne Browserausnahmen:

```bash
TEST_PROXY=http://127.0.0.1:8080 npm run test-site:check
```

Dieser Test lädt alle Assets und prüft falsche Anmeldedaten, ungültiges JSON, fremde Origins, erfolgreiche Anmeldung, Sitzungscookie, geschützte Projekte und Abmeldung. Die Kommunikation erscheint in `logs/http.jsonl`. Zum Vergleich direkt testen:

```bash
npm run test-site:check
```

Für den Test im Browser kannst du einen lokalen Hostnamen verwenden. Ergänze selbst in deiner Hosts-Datei (unter Linux `/etc/hosts`):

```text
127.0.0.1 norda.test
```

Trage im Browser den HTTP-Proxy `127.0.0.1`, Port `8080`, ein und öffne ausdrücklich <http://norda.test:9000>. Der Name darf nicht in der Proxy-Ausnahmeliste stehen. Bei aktivem „Nur-HTTPS“-Modus brauchst du eine Ausnahme für diese lokale HTTP-Testwebsite. Im Proxy-Terminal sollte `GET http://norda.test:9000/` erscheinen. Die Anmeldedaten gehen als `POST /api/login` an den Testserver; sie sind im HTTP-Log in Base64 enthalten.

## Optional über HTTPS

Der Server unterstützt auch ein eigenes Testzertifikat samt Schlüssel. Verwende ein für den gewählten Hostnamen gültiges Zertifikat, dem dein Testbrowser vertraut, beispielsweise aus einer bereits eingerichteten lokalen Entwicklungs-CA. Speichere Zertifikat und Schlüssel außerhalb des Repositorys.

```bash
TEST_SITE_TLS_CERT=/absoluter/pfad/cert.pem \
TEST_SITE_TLS_KEY=/absoluter/pfad/key.pem \
npm run test-site
```

Dann lauscht die Seite standardmäßig auf Port `9443`. Verwende beispielsweise `https://norda.test:9443`, wenn das Zertifikat für `norda.test` ausgestellt ist. Aktiviere im Browser zusätzlich denselben Proxy für HTTPS. Das HTTPS-Log enthält die verschlüsselten Tunnelbytes; der Proxy entschlüsselt die Anmeldung nicht.

Mit `TEST_SITE_PORT` kannst du den Port ändern. Für diese HTTPS-Variante läuft der Serverstart statt des HTTP-Starts, oder mit eigenem Port in einem weiteren Terminal.

## Projektdateien

- `server.ts`: HTTP-/HTTPS-Server, Anmelde-API, Sitzungen und Assets
- `public/index.html`: Anmeldeseite, Arbeitsbereich und Demo-Hilfe
- `public/styles.css`: Layout, responsive Gestaltung und Animationen
- `public/app.js`: Formular, Anmeldestatus und Interaktionen
- `public/landscape.svg`: eigene Landschaftsillustration
- `check.mjs`: Smoke-Test für den HTTP-Anmeldeablauf, optional über den Proxy

TypeScript prüfen: `npm run typecheck`.
