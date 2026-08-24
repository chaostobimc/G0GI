# G0GI 🍒

Die Clan-Website von **G0GI** auf **HugoSMP** — alles in Kirschrot.
Mit **Market-Tab**: Auktionshaus- und Order-Preise von HugoSMP, durchsuchbar
auf Deutsch und Englisch, mit Preisgraph.

## Struktur

```
index.html            Clan-Hauptseite
market.html           Market-Tab (Preise suchen + Preisverlauf)
assets/css/           Kirschrot-Theme + Market-Styles
assets/js/            Frontend-Logik (Tools, Market, Suche, SVG-Graph)
backend/              Node.js: Datenquellen (Site-Feed/Bot), SQLite (sql.js), Express-API
```

## Backend starten

```bash
cd backend
cp .env.example .env      # einmalig, dann Werte anpassen
npm install
npm start                 # API auf Port 8080 + Datenquelle
```

Node ≥ 22 wird nur für den **Bot-Modus** gebraucht; der Standard-Modus
(Site-Feed) läuft auch auf älteren Nodes. Die DB ist **sql.js (pure WASM)** —
kein natives Kompilieren, keine Segfaults.

## Datenquellen (`DATA_SOURCE` in der `.env`)

### `site` (Standard): hugosmp-market.net

Delta/Watermark-Crawler: zieht pro Zyklus (Standard: 5 min) nur die Zeilen,
die neuer sind als der letzte Stand — also den Live-Feed, keinen Voll-Crawl
(~6–8 Requests/Zyklus, identifizierender User-Agent). Baut über die Zeit
automatisch eine Preishistorie auf. Braucht keinen Minecraft-Account.

**Hinweis robots.txt:** hugosmp-market.net disallowed `/api/` für Crawler.
Dieses Projekt pollt bewusst minimal-frequent als Community-Integration —
im Zweifel die Betreiber (gleiche Community!) kurz um OK fragen oder auf
`DATA_SOURCE=bot` wechseln.

### `bot`: eigener Mineflayer-Bot auf hugosmp.net

- Joint `hugosmp.net:25565` (Minecraft **1.21.11**), Limbo-fest: Regeln-/
  Changelog-Logik läuft ab Login, Changelog-Fenster werden automatisch
  geschlossen (nur wenn wirklich eins offen ist).
- **Steht danach nur rum** — keine Bewegung, kein Farmen von Währung.
- Alle `SCAN_INTERVAL_MIN`: `/ah` und `/order` öffnen, alle Seiten so
  schnell wie möglich durchklicken (Weiter = Slot 50, Listings = Slots 0–35),
  Preise aus der Lore (`Preis: $X`, `Verkäufer: …`, Zeit-Zeilen ignoriert).
- Account: `AUTH=offline` (nur Name) oder `AUTH=microsoft` (Device-Code-Flow,
  kein Passwort).

### GUI-Layout (Bot-Modus)

Per Screenshot vermessen und vorkonfiguriert (`.env.example`):
Listings = Slots 0–35, Weiter-Button = Slot 50 (`/ah` und `/order` gleich).
`SCRAPER_DEBUG=true` schreibt rohe GUI-Dumps nach `backend/data/dumps/`.

## API

| Route | Bedeutung |
|---|---|
| `GET /api/status` | Quellen-Status, letzter Scan, Demo-Flag |
| `GET /api/items?q=&market=&limit=` | Suche (DE + EN inkl. Verzauberungs-Varianten) |
| `GET /api/item/:key` | Aktuelle Listings (Zeitfenster, Standard 30 min) |
| `GET /api/item/:key/history?days=` | Preisverlauf für den Graphen |
| `GET /api/scans` | Letzte Scans |
| `GET /icons/:name.png` | Item-Icons (1.21.11-Texturen) |

Auktionen = Gesamtpreis (`/ah`), Orders = Stückpreis (`/order`).
Varianten wie `diamond_pickaxe/efficiency:5+mending:1` werden als eigene
Einträge geführt und zweisprachig benannt („Diamantspitzhacke (Effizienz V,
Reparatur I)").

---
*Kein offizielles Minecraft-Produkt. Nicht von Mojang genehmigt oder mit Mojang verbunden.*
