# G0GI 🍒

Die Clan-Website von **G0GI** auf **HugoSMP** — alles in Kirschrot.
Mit **Market-Tab**: Auktionshaus- und Order-Preise vom Server, gescannt von
einem Mineflayer-Bot, durchsuchbar auf Deutsch und Englisch, mit Preisgraph.

## Struktur

```
index.html            Clan-Hauptseite
market.html           Market-Tab (Preise suchen + Preisverlauf)
assets/css/           Kirschrot-Theme + Market-Styles
assets/js/            Frontend-Logik (Tools, Market, Suche, SVG-Graph)
backend/              Node.js: Mineflayer-Bot, Scraper, SQLite, Express-API
```

## Backend starten

```bash
cd backend
cp .env.example .env      # einmalig, dann Werte anpassen
npm install
npm start                 # Bot + API auf Port 8080
```

Nur Website/API ohne Bot (z. B. zum Entwickeln): `npm run start:api-only`
(oder `DISABLE_BOT=true` in der `.env`).

### Was der Bot macht (und was nicht)

- Joint `hugosmp.net:25565` (Minecraft **1.21.11**), führt das Regeln-Kommando
  aus und klickt den Bestätigungs-Button automatisch.
- **Steht danach nur rum** — keine Bewegung, kein Farmen von Währung.
- Alle `SCAN_INTERVAL_MIN` (Default 30 min): `/ah` und `/order` öffnen,
  alle Seiten so schnell wie möglich durchklicken (Warten nur auf die
  Fenster-Aktualisierung, ~250 ms Pause pro Seite), Listings mit Preis in
  SQLite speichern.
- Sanftes Anti-AFK (Arm schwenken), damit er nicht gekickt wird.

### Account

`AUTH=offline` braucht nur einen Benutzernamen. Für Online-Mode-Server:
`AUTH=microsoft` — der Bot zeigt dann einen Device-Code, den man auf
microsoft.com/link eingibt. Es wird kein Passwort gespeichert.

### GUI-Layout

Die Parser-Muster (Preis-Zeilen, Weiter-Button, Deko-Slots) liegen in
`backend/src/parsers.js`. Mit `SCRAPER_DEBUG=true` schreibt der Bot rohe
GUI-Dumps nach `backend/data/dumps/` — damit lässt sich der Parser exakt
auf das hugosmp.net-Layout einstellen.

## API

| Route | Bedeutung |
|---|---|
| `GET /api/status` | Bot-Status, letzter Scan, Demo-Flag |
| `GET /api/items?q=&market=&limit=` | Suche (DE + EN), aktuelle Bestpreise |
| `GET /api/item/:key` | Aktuelle Listings eines Items |
| `GET /api/item/:key/history?days=` | Preisverlauf für den Graphen |
| `GET /api/scans` | Letzte Scans |
| `GET /icons/:name.png` | Item-Icons (1.21.11-Texturen) |

Auktionen = Gesamtpreis (`/ah`), Orders = Stückpreis (`/order`).

---
*Kein offizielles Minecraft-Produkt. Nicht von Mojang genehmigt oder mit Mojang verbunden.*
