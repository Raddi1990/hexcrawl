# Hexcrawl-Kartentool

Webbasiertes Hex-Kartentool für Pen & Paper: Basiskarte + Nebel des Krieges, Spielfigur
per Drag & Drop, aufgedeckter Bereich wird serverseitig gespeichert. Mehrere Karten
verwaltbar über einen kleinen Admin-Bereich. Kein Build-Schritt – die Dateien können
1:1 per FTP/Datei-Manager auf einen Webspace mit PHP (z.B. one.com) hochgeladen werden.

## Voraussetzungen auf dem Webspace

- PHP (getestet mit PHP 7.4+/8.x, wie bei one.com üblich)
- Schreibrechte für den Webserver auf `data/` und `maps/` (bei one.com standardmäßig gegeben)

## Deployment

1. Gesamten Ordnerinhalt (inkl. `.htaccess`-Dateien) per FTP/Datei-Manager in das
   gewünschte Verzeichnis auf dem one.com Webspace kopieren (z.B. `public_html/hexcrawl/`
   oder direkt `public_html/`, falls die ganze Domain dafür genutzt werden soll).
2. Admin-Zugangsdaten festlegen: In `data/config.php` `admin_username` und
   `admin_password` von Hand auf eigene Werte setzen (siehe Abschnitt
   "Admin-Zugang" unten).
3. Unter `/admin/` (verlangt den Admin-Login) Karten anlegen: Namen vergeben, Basiskarte
   + Nebelbild hochladen, anschließend im Kalibrierungsmodus das rote Hex-Raster
   passend zur Kartenauflösung einstellen (Hexgröße, Ursprung X/Y, Ausrichtung,
   Sichtradius) und speichern.
4. Auf der Hauptseite (`/`) Karte auswählen, Spielfigur (roter Punkt) auf ein Hex ziehen –
   der Nebel wird dort (und im eingestellten Sichtradius) dauerhaft aufgedeckt und
   automatisch gespeichert.

## Admin-Zugang

Die Kartenansicht (`/`) ist frei zugänglich, kein Login nötig – jeder mit dem Link kann
die Karte ansehen, die Spielfigur bewegen und Nebel aufdecken.

Nur der Admin-Bereich (`/admin/`: Karten anlegen/kalibrieren/löschen) sowie der Button
"Nebel zurücksetzen" auf der Hauptseite verlangen zusätzlich einen Admin-Login
(Benutzername + Passwort). Admin-Benutzername und -Passwort werden nicht über ein
Web-Formular gesetzt, sondern direkt in `data/config.php` eingetragen:

```php
'admin_username' => 'admin',
'admin_password' => 'bitte-aendern',
```

Einfach auf einen selbst gewählten, leicht zu merkenden Wert ändern und Datei speichern
(z.B. per FTP-Editor). Der Ordner `data/` ist per `.htaccess` gegen direkten Zugriff von
außen abgesichert.

## Lokal testen (optional)

Auf diesem Rechner ist aktuell keine PHP-CLI installiert. Zum lokalen Testen vor dem
Hochladen:

- PHP CLI installieren (z.B. `winget install PHP.PHP` oder XAMPP), dann im Projektordner:
  ```
  php -S localhost:8000
  ```
  und `http://localhost:8000/` im Browser öffnen.
- Alternativ: direkt in einen Testordner auf dem one.com Webspace hochladen und dort
  ausprobieren.

## Admin-Passwort vergessen

Einfach in `data/config.php` `admin_username`/`admin_password` auf einen neuen Wert
setzen (per FTP-Editor) – kein Reset-Mechanismus nötig, da nichts gehasht gespeichert
wird.

## Ordnerstruktur

```
index.php, admin_login.php, logout.php          Öffentliche Seiten
admin/                                          Kartenverwaltung + Kalibrierung (Admin-Login nötig)
api/                                             PHP-Endpunkte (JSON)
assets/                                          CSS/JS (Vanilla, kein Build-Schritt)
maps/<slug>/                                     Hochgeladene Karten- und Nebelbilder
data/maps.json                                   Kartenkonfigurationen
data/state/<mapId>.json                          Aufgedeckte Hexe + Token-Position je Karte
data/config.php                                  Admin-Zugangsdaten
```
