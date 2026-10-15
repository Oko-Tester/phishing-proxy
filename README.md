# HTTP-/HTTPS-Testproxy

Lokaler Forward Proxy mit getrennten Protokollen für HTTP und HTTPS sowie einer eigenen Login-Testwebsite. Node.js 24 und npm werden benötigt.

## Starten

```bash
npm install
npm run proxy
```

In einem zweiten Terminal:

```bash
npm run test-site
```

Testwebsite: <http://127.0.0.1:9000> · Proxy: `127.0.0.1:8080`

Demo-Zugang: **alex@norda.test** / **Norda-Demo!2026**. Alternativ „Demo-Zugang verwenden“ anklicken.

## Über den Proxy testen

Im Browser den HTTP-Proxy `127.0.0.1` mit Port `8080` eintragen; für HTTPS denselben Proxy verwenden. In der Adresszeile steht weiterhin die Zielwebsite.

Browser umgehen den Proxy bei lokalen Adressen häufig. Für einen eindeutigen Test beide Server starten und in einem dritten Terminal ausführen:

```bash
TEST_PROXY=http://127.0.0.1:8080 npm run test-site:check
```

Für den manuellen Browsertest samt lokalem Hostnamen siehe [Testwebsite-Anleitung](test-site/README.md#über-den-proxy-testen).

## Logs lesen

- `logs/http.jsonl`: Anfragen, Header und Antworten; Inhalte unter `body.data` sind Base64-codiert.
- `logs/https.jsonl`: Tunnelziele und verschlüsselte Daten in beiden Richtungen. HTTPS-Inhalte werden nicht entschlüsselt.

Jede Zeile ist ein JSON-Eintrag. Zusammengehörige Einträge haben dieselbe `id`. Für den Demo-Login nach `/api/login` suchen und den Eintrag mit gleicher `id` sowie `direction: "client-to-server"` lesen.

HTTP-Inhalt im Terminal decodieren: `node` starten, dann den Wert aus `body.data` einsetzen:

```js
Buffer.from("BASE64_WERT", "base64").toString("utf8")
```

Die Node-Konsole mit `.exit` schließen. Base64 ist keine Verschlüsselung; das Decodieren von HTTPS-Logdaten liefert weiterhin verschlüsselte Bytes. Logs werden angehängt und sind von Git ausgeschlossen. Für die Login-Tests ausschließlich die mitgelieferten Demo-Daten verwenden.

TypeScript prüfen: `npm run typecheck`. Server mit `Strg+C` beenden.
