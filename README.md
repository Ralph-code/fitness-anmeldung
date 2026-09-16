# St. Georg Schülerheim – App

Heim-App: Infos, Essensplan, An- und Abmeldungen, Fitness, Studierzeit und Anwesenheit.
Next.js 16 + Firebase.

## Für Studenten

| Bereich | Inhalt |
| --- | --- |
| **Start** | Neuigkeiten, Essensplan für heute, eigene Buchungen, Status des Heims |
| **Fitness** | Trainingszeit buchen und stornieren |
| **Essen** | Essenszeiten, Plan der nächsten Tage, Ab- und Anmeldung |
| **Lernen** | Studierzeit für den Tag wählen |
| **Profil** | Eigene Daten, Status heute, Erlaubnisse, Vermerke, Passwort, Ansicht (hell/dunkel), Sprache (DE/IT) |
| **Kalender** | Öffnungszeiten, geschlossene und schulfreie Tage (über die Startseite) |

Beim ersten Öffnen erklärt ein kurzes Tutorial die App (im Profil erneut aufrufbar).
Der Schülerbereich ist **deutsch und italienisch** (`lib/i18n.ts`); die Verwaltung ist nur deutsch.

## Für Admins (Verwaltung)

- **Studenten** – anlegen (einzeln oder als Liste), bearbeiten, bestätigen, sperren, Vermerke, Passwörter, löschen; dort auch **Studierzeit-Pflicht pro Student**
- **Anwesenheit** – wer ist im Heim / Schule / Sport / zuhause / Ausgang / krank / entschuldigt, dazu die **Zimmerkontrolle am Abend** und eine Notiz pro Tag
- **Essen** – Essensplan eintragen **und** Anwesenheit kontrollieren (wer isst mit, wer fehlt)
- **Studierzeit** – Zeiten festlegen, Einträge pro Tag sehen, Anwesenheit abhaken, „ohne Eintrag“ im Blick
- **Neuigkeiten** – Beiträge für die Startseite mit Kategorie und Anheften
- **Kalender** – wöchentliche Öffnungszeiten und Ausnahmen **über einen Zeitraum** (geschlossen, andere Zeiten, schulfrei)
- **Fitness-Slots** – Zeiten, Plätze, 16+ und Mit Bestätigung
- **Design** – Akzentfarbe für alle (Hell/Dunkel wählt jeder selbst)
- **Zugangsdaten** – Zettel für die Rezeption drucken
- **Protokoll** – jede Admin-Änderung mit Zeit, Person und Details (Studenten-Aktionen werden nicht protokolliert)
- **Admins** – nur Superadmin: Admins anlegen, Passwort neu, löschen

## Regeln

**Essen:** Mittag 12:30–14:00, Abend 18:15–19:00. Ohne Abmeldung ist jeder angemeldet;
Schüler können bis **20:00 am Vortag** ab- und wieder anmelden, danach nur das Personal.
Wer als „gefehlt“ markiert wird, obwohl er angemeldet war, muss die Meldung in der App bestätigen.

**Heim:** offen von Sonntag 19:00 bis Freitag 14:30 (Standard, vom Admin änderbar).

**Studierzeit:** standardmäßig drei Einheiten pro Tag; jeder Student wählt eine, solange sie noch nicht begonnen hat.
Die Pflicht gilt pro Student (`users.studyRequired`, Standard: Pflicht).

**Fitness** – Standard, unter *Verwaltung → Fitness-Slots* änderbar:

| Regel | Standard |
| --- | --- |
| Slots | 06:00–07:00, dann stündlich 13:30–14:30 bis 20:30–21:30 |
| Plätze pro Slot | 6 |
| Buchungen pro Student | 1 pro Tag |
| Buchungsfenster | ab 21:15 am Vortag bis zum Start des letzten Slots |
| Slot-Optionen | **16+** und **Mit Bestätigung** – solche Slots sehen nur berechtigte Studenten |
| Zeitzone | Europe/Rome – unabhängig von Server- oder Handy-Zeit |
| Zimmer | mit oder ohne Buchstabe, z.B. `101` oder `101A` |
| Nachtschlüssel | erst ab 18 Jahren |

Alle Regeln werden **auf dem Server** geprüft (`app/api/*`), der Browser darf in Firestore nur lesen.

## Aufbau

- `app/page.tsx` – Login (immer dunkel) mit Kontaktdaten des Heims
- `app/start`, `app/fitness`, `app/essen`, `app/studierzeit`, `app/profil`, `app/kalender` – Schülerbereich
- `app/admin/*` – Verwaltung (Studenten, Heim-Anwesenheit, Studierzeit, News, Kalender, Slots, Design, Print, Protokoll, Admins)
- `app/api/*` – alle Schreibzugriffe über das Firebase Admin SDK
- `components/AppShell.tsx` – Kopfzeile, Navigation unten (Studenten: Start · Fitness · Essen · Lernen · Profil · Admins: Start · Essen · Anwesenheit · Studierzeit · Verwaltung), Zugriffsschutz
- `lib/i18n.ts` (Sprachen), `lib/theme.ts` + `app/globals.css` (Farben als CSS-Variablen)

Firestore: `users`, `posts`, `meals/{datum}`, `mealAttendance/{datum}_{uid}`, `presence/{datum}_{uid}`,
`studyBookings/{datum}_{uid}`, `bookings/{datum}_{uid}`, `days/{datum}`, `notes`, `calendar/{datum}`,
`settings/{schedule|study|opening|theme}`, `adminLog`, `credentials` (nur serverseitig lesbar).

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

   **Rollen:** Superadmin = alles, inkl. Admins verwalten (nur im Terminal änderbar) · Admin = Studenten, Inhalte, Kontrolle · Student = App nutzen.
4. Lokal starten: `npm run dev`

## Deployment auf Hostinger

1. Node.js-Web-App für die Subdomain anlegen (Node 20 oder neuer), Repo verbinden.
2. Build `npm run build`, Start `npm run start`.
3. Alle Werte aus `.env.example` als Umgebungsvariablen eintragen (die `NEXT_PUBLIC_*` müssen beim Build gesetzt sein,
   beim `FIREBASE_PRIVATE_KEY` die `\n` stehen lassen).
4. Firebase Console → Authentication → Einstellungen → Autorisierte Domains: Subdomain hinzufügen.

## Neues Schuljahr

Verwaltung → Studenten: alte Studenten löschen, neue Liste importieren, **Alle Passwörter neu**, dann **Alle drucken**.
