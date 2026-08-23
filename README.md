# G0GI 🍒

Die Clan-Website von **G0GI** auf **HugoSMP** — alles in Kirschrot.

## Was hier drinsteckt

Pures Frontend: `index.html` + CSS + Vanilla-JS. Kein Framework, kein Build-Step,
kein Tracker — einfach öffnen oder mit einem statischen Server ausliefern.

- **Tools** (laufen komplett im Browser, Daten liegen im `localStorage`):
  Weg-Rechner, Bau-Rechner, Farm-Rechner, Raid-Packliste, Event-Countdown,
  Kampfruf-Generator und Loot-Roulette.
- **3D-Scroll-Animationen**: rotierender Kirsch-Block im Hero, Reveal-Karten
  mit Perspektive, Parallax-Blobs, Maus-Tilt bei den Team-Karten, Blütenblätter.
- `prefers-reduced-motion` wird respektiert.

## Starten

```bash
python3 -m http.server 8080
# dann http://localhost:8080
```

## Struktur

```
index.html            Hauptseite (alle Sektionen)
assets/css/style.css  Kirschrot-Theme
assets/js/main.js     Nav, Animationen, Tool-Logik
```

## Backend

Kommt später. Bis dahin sind alle Tools reine Frontend-Demos — das ist so
gewollt und steht auch auf der Seite.

---
*Gebaut von Lasse mit zu wenig Schlaf. Nicht von Mojang genehmigt oder mit Mojang verbunden.*
