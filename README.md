# Fitness Heim – Gym Log

Buchungssystem für den Fitnessraum im Heim (Next.js 16 + Firebase).

## Regeln

Standard-Zeitplan – der Admin ändert ihn unter **Verwaltung → Slots bearbeiten** (Uhrzeiten, Plätze, Altersgrenze, Slots hinzufügen/löschen, Buchungsstart):

| Regel | Standard |
| --- | --- |
| Slots | 06:00–07:00, dann stündlich 13:30–14:30 bis 20:30–21:30 |
| Nur ab 16 Jahren | 19:30–20:30 und 20:30–21:30 |
| Plätze pro Slot | 6 |
| Buchungen pro Student | 1 pro Tag |
| Buchungsfenster | ab 21:15 am Vortag bis zum Start des letzten Slots (Slots, die schon begonnen haben, sind gesperrt) |
| Zeitzone | Europe/Rome – unabhängig von Server- oder Handy-Zeit |
| Zimmer | Nummer mit oder ohne Buchstabe, z.B. `101` oder `101A` |

Die Logik steht in `lib/schedule.ts` und wird **auf dem Server** geprüft (`app/api/*`).
Der Browser darf in Firestore nur lesen (`firestore.rules`).

## Aufbau

- `app/page.tsx` – Login mit Name + Passwort (`Max Müller` → Benutzer `max.mueller`)
- `app/dashboard` – Studenten buchen / stornieren; Admin sieht alle Buchungen (30 Tage zurück bis morgen), entfernt Buchungen und sperrt Studenten
- `app/gym-admin-control` – Studenten anlegen (einzeln oder als Liste), bearbeiten, sperren, löschen, Passwörter erneuern
- `app/gym-admin-control/print` – Zugangszettel für die Rezeption (A4, 10 pro Seite)
- `app/api/*` – alle Schreibzugriffe über das Firebase Admin SDK

Firestore-Collections: `settings/schedule` (Zeitplan), `users` (Profile), `bookings` (ID `<datum>_<uid>`), `days` (Belegung pro Slot, ohne Namen), `credentials` (Passwörter für den Ausdruck, nur serverseitig lesbar).

## Einrichtung

1. `.env.example` nach `.env.local` kopieren und ausfüllen.
   Den Service-Account bekommst du in der Firebase Console → Projekteinstellungen → Dienstkonten → „Neuen privaten Schlüssel generieren“. Aus der JSON-Datei `client_email` → `FIREBASE_CLIENT_EMAIL` und `private_key` → `FIREBASE_PRIVATE_KEY`.
2. Firestore-Regeln veröffentlichen: Inhalt von `firestore.rules` in der Firebase Console unter Firestore → Regeln einfügen (oder `npx firebase-tools deploy --only firestore:rules`).
3. Admin-Konto anlegen bzw. Passwort setzen:
   ```bash
   npm run create-admin -- admin EinSicheresPasswort
   ```
4. Lokal starten: `npm run dev`

## Deployment auf Hostinger

1. In hPanel eine Node.js-Web-App für die Subdomain anlegen (Node 20 oder neuer), Repo verbinden.
2. Build-Befehl `npm run build`, Start-Befehl `npm run start`.
3. Unter Umgebungsvariablen **alle** Werte aus `.env.example` eintragen. Die `NEXT_PUBLIC_*`-Werte müssen schon beim Build gesetzt sein.
   Beim `FIREBASE_PRIVATE_KEY` die Zeilenumbrüche als `\n` stehen lassen.
4. In der Firebase Console → Authentication → Einstellungen → Autorisierte Domains die Subdomain hinzufügen.

## Neues Schuljahr

Verwaltung → „Neues Jahr: Alle Passwörter neu“ → danach „Alle drucken“. Alle Studenten werden sofort abgemeldet und brauchen den neuen Zettel.
