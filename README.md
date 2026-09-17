# St. Georg Schülerheim – Fitness-App

Buchung des Fitnessraums für die Studenten des Heims. Next.js 16 + Firebase.

## Für Studenten

| Bereich | Inhalt |
| --- | --- |
| **Fitness** | Trainingszeit buchen und stornieren |
| **Profil** | Eigene Daten, Erlaubnisse (16+, Bestätigung), Passwort, Ansicht (hell/dunkel), Sprache (DE/IT) |

Beim ersten Öffnen jeder Seite erklärt eine kurze **Einführung mit Sprechblasen** die Knöpfe
(Studenten: Fitness, Profil · Admins zusätzlich: Verwaltung, Studenten anlegen, Slots, Design).
Im Profil lässt sie sich unter *Hilfe* erneut starten. Inhalte: `lib/tours.ts`.

Die Studentenseiten gibt es **auf Deutsch und Italienisch** (`lib/i18n.ts`); die Verwaltung ist nur deutsch.
Hell/Dunkel und Sprache wählt jeder selbst, die Akzentfarbe legt der Admin fest.

## Für Admins (Verwaltung)

- **Fitness** – alle Buchungen pro Tag, Studenten aus dem Slot entfernen oder sperren
- **Studenten** – anlegen (einzeln oder als Liste), bearbeiten, bestätigen, sperren, Passwörter, löschen
- **Fitness-Slots** – Zeiten, Plätze, 16+ und Mit Bestätigung
- **Design** – Akzentfarbe für alle
- **Zugangsdaten** – Zettel für die Rezeption drucken
- **Admins** – nur Superadmin: Admins anlegen, Passwort neu, löschen

## Regeln

Standard, unter *Verwaltung → Fitness-Slots* änderbar:

| Regel | Standard |
| --- | --- |
| Slots | 06:00–07:00, dann stündlich 13:30–14:30 bis 20:30–21:30 |
| Plätze pro Slot | 6 |
| Buchungen pro Student | 1 pro Tag |
| Buchungsfenster | ab 21:15 am Vortag bis zum Start des letzten Slots |
| Slot-Optionen | **16+** und **Mit Bestätigung** – solche Slots sehen nur berechtigte Studenten |
| Zeitzone | Europe/Rome – unabhängig von Server- oder Handy-Zeit |
| Zimmer | mit oder ohne Buchstabe, z.B. `101` oder `101A` |

Alle Regeln werden **auf dem Server** geprüft (`app/api/*`), der Browser darf in Firestore nur lesen.

## Aufbau

- `app/page.tsx` – Login (immer dunkel) mit Kontaktdaten des Heims
- `app/fitness`, `app/profil` – Studentenbereich
- `app/admin/*` – Verwaltung (Studenten, Slots, Design, Print, Admins)
- `app/api/*` – alle Schreibzugriffe über das Firebase Admin SDK
- `components/AppShell.tsx` – Kopfzeile, Navigation unten (Studenten: Fitness · Profil · Admins: Fitness · Verwaltung · Profil), Zugriffsschutz
- `components/AdminPage.tsx` – Rahmen der Verwaltungsseiten, `components/Toast.tsx` – Rückmeldungen
- `components/Tour.tsx` + `lib/tours.ts` – Einführung mit Sprechblasen (`data-tour`-Attribute markieren die Ziele)
- `lib/i18n.ts` (Sprachen), `lib/theme.ts` + `app/globals.css` (Farben als CSS-Variablen)

Firestore: `users`, `bookings/{datum}_{uid}`, `days/{datum}`, `settings/{schedule|theme}`,
`credentials` (nur serverseitig lesbar).

## Einrichtung

1. `.env.example` nach `.env.local` kopieren und ausfüllen (Firebase Web-Config + Service-Account).
2. **Firestore-Regeln veröffentlichen:** Inhalt von `firestore.rules` in der Firebase Console unter
   Firestore → Regeln einfügen → Veröffentlichen. **Nach jeder Erweiterung neu veröffentlichen**,
   sonst bleiben neue Bereiche für die App leer.
3. Superadmin anlegen:
   ```bash
   npm run create-superadmin -- ralph EinLangesSicheresPasswort
   ```
   Weitere Admins danach in der App (Verwaltung → Admins).

   **Rollen:** Superadmin = alles, inkl. Admins verwalten (nur im Terminal änderbar) · Admin = Studenten, Buchungen, Slots, Design · Student = App nutzen.
4. Lokal starten: `npm run dev`

## Deployment auf Hostinger

1. Node.js-Web-App für die Subdomain anlegen (Node 20 oder neuer), Repo verbinden.
2. Build `npm run build`, Start `npm run start`.
3. Alle Werte aus `.env.example` als Umgebungsvariablen eintragen (die `NEXT_PUBLIC_*` müssen beim Build gesetzt sein,
   beim `FIREBASE_PRIVATE_KEY` die `\n` stehen lassen).
4. Firebase Console → Authentication → Einstellungen → Autorisierte Domains: Subdomain hinzufügen.

## Neues Schuljahr

Verwaltung → Studenten: alte Studenten löschen, neue Liste importieren, **Alle Passwörter neu**, dann **Alle drucken**.
