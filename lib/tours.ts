// Kurze Einführungen mit Sprechblasen. Jede Tour wird einmal pro Benutzer gezeigt
// (users.toursSeen) und kann im Profil zurückgesetzt werden.
// `target` verweist auf ein Element mit passendem data-tour-Attribut; fehlt es, wird der Schritt übersprungen.

import type { Language } from "@/lib/i18n";

type Localized = Record<Language, string>;
export type TourStep = { target: string; title: Localized; text: Localized };

export const TOURS = {
  fitness: [
    {
      target: "fitness-status",
      title: { de: "Willkommen!", it: "Benvenuto!" },
      text: {
        de: "Hier siehst du, für welchen Tag du gerade buchen kannst – oder ab wann die Buchung wieder öffnet.",
        it: "Qui vedi per quale giorno puoi prenotare – oppure da quando si riapre la prenotazione.",
      },
    },
    {
      target: "fitness-slot",
      title: { de: "Trainingszeit buchen", it: "Prenotare un turno" },
      text: {
        de: "Jeder Punkt ist ein Platz. Tippe auf „Buchen“, um dir einen Platz zu sichern. Pro Tag ist eine Buchung möglich, mit „Storno“ gibst du ihn wieder frei.",
        it: "Ogni punto è un posto. Tocca «Prenota» per riservarlo. È possibile una prenotazione al giorno, con «Annulla» lo liberi di nuovo.",
      },
    },
    {
      target: "nav-fitness",
      title: { de: "Fitness", it: "Fitness" },
      text: { de: "Hier kommst du jederzeit zurück zur Buchung.", it: "Da qui torni sempre alle prenotazioni." },
    },
    {
      target: "nav-profile",
      title: { de: "Dein Profil", it: "Il tuo profilo" },
      text: {
        de: "Deine Daten, Hell/Dunkel, Sprache und dein Passwort.",
        it: "I tuoi dati, tema chiaro/scuro, lingua e password.",
      },
    },
  ],
  fitnessAdmin: [
    {
      target: "fitness-date",
      title: { de: "Tag wählen", it: "Scegliere il giorno" },
      text: {
        de: "Mit den Pfeilen wechselst du den Tag – bis zu 30 Tage zurück und bis morgen.",
        it: "Con le frecce cambi giorno – fino a 30 giorni indietro e fino a domani.",
      },
    },
    {
      target: "fitness-slot",
      title: { de: "Buchungen pro Slot", it: "Prenotazioni per turno" },
      text: {
        de: "Unter jedem Slot stehen die gebuchten Studenten. Mit „Sperren“ sperrst du jemanden, mit ✕ entfernst du ihn aus dem Slot.",
        it: "Sotto ogni turno trovi gli studenti prenotati. Con «Sperren» blocchi qualcuno, con ✕ lo togli dal turno.",
      },
    },
    {
      target: "nav-admin",
      title: { de: "Verwaltung", it: "Amministrazione" },
      text: {
        de: "Studenten anlegen, Slots einstellen, Designfarbe und Zugangsdaten drucken.",
        it: "Creare studenti, impostare i turni, colore del design e stampa degli accessi.",
      },
    },
    {
      target: "nav-profile",
      title: { de: "Profil", it: "Profilo" },
      text: { de: "Hell/Dunkel, Sprache, Passwort und Abmelden.", it: "Tema, lingua, password e uscita." },
    },
  ],
  profile: [
    {
      target: "profile-theme",
      title: { de: "Ansicht", it: "Tema" },
      text: { de: "Wähle zwischen dunkler und heller Ansicht.", it: "Scegli tra tema scuro e chiaro." },
    },
    {
      target: "profile-language",
      title: { de: "Sprache", it: "Lingua" },
      text: { de: "Die App gibt es auf Deutsch und Italienisch.", it: "L'app è disponibile in tedesco e in italiano." },
    },
    {
      target: "profile-password",
      title: { de: "Passwort", it: "Password" },
      text: {
        de: "Ändere hier dein Passwort vom Zettel in ein eigenes.",
        it: "Qui puoi sostituire la password del foglietto con una tua.",
      },
    },
    {
      target: "profile-tours",
      title: { de: "Hilfe", it: "Aiuto" },
      text: { de: "Hier kannst du diese Einführung jederzeit wieder ansehen.", it: "Qui puoi rivedere questa introduzione quando vuoi." },
    },
    {
      target: "profile-logout",
      title: { de: "Abmelden", it: "Esci" },
      text: { de: "Hier meldest du dich ab.", it: "Da qui esci dall'app." },
    },
  ],
  admin: [
    {
      target: "admin-studenten",
      title: { de: "Studenten", it: "Studenti" },
      text: {
        de: "Neue Studenten anlegen, bearbeiten, bestätigen, sperren und Passwörter verwalten.",
        it: "Creare, modificare, autorizzare e bloccare studenti e gestire le password.",
      },
    },
    {
      target: "admin-slots",
      title: { de: "Fitness-Slots", it: "Turni fitness" },
      text: {
        de: "Zeiten, Plätze und Buchungsstart festlegen, Slots für 16+ oder nur mit Bestätigung.",
        it: "Impostare orari, posti e apertura prenotazioni, turni 16+ o solo con autorizzazione.",
      },
    },
    {
      target: "admin-design",
      title: { de: "Design", it: "Design" },
      text: { de: "Die Akzentfarbe der App für alle Benutzer.", it: "Il colore principale dell'app per tutti." },
    },
    {
      target: "admin-print",
      title: { de: "Zugangsdaten", it: "Dati di accesso" },
      text: {
        de: "Zettel mit Name und Passwort für die Studenten drucken.",
        it: "Stampare i foglietti con nome e password per gli studenti.",
      },
    },
  ],
  students: [
    {
      target: "students-new",
      title: { de: "Neuen Studenten anlegen", it: "Creare uno studente" },
      text: {
        de: "Name, Zimmer und Geburtsdatum eingeben und „Anlegen“ tippen. Benutzername und Passwort werden automatisch erzeugt und danach angezeigt.",
        it: "Inserisci nome, camera e data di nascita e tocca «Anlegen». Nome utente e password vengono creati automaticamente e mostrati subito.",
      },
    },
    {
      target: "students-import",
      title: { de: "Ganze Liste importieren", it: "Importare un elenco" },
      text: {
        de: "Viele Studenten auf einmal: eine Zeile pro Student im Format „Name; Zimmer; Geburtsdatum“ – auch direkt aus Excel kopiert.",
        it: "Molti studenti insieme: una riga per studente nel formato «Nome; Camera; Data di nascita» – anche copiato da Excel.",
      },
    },
    {
      target: "students-year",
      title: { de: "Neues Schuljahr", it: "Nuovo anno scolastico" },
      text: {
        de: "Alle Zettel drucken, alle Passwörter auf einmal erneuern oder alle Studenten löschen.",
        it: "Stampare tutti i foglietti, rinnovare tutte le password o eliminare tutti gli studenti.",
      },
    },
    {
      target: "students-search",
      title: { de: "Suchen", it: "Cercare" },
      text: { de: "Nach Name oder Zimmer filtern.", it: "Filtrare per nome o camera." },
    },
    {
      target: "students-select",
      title: { de: "Mehrere auswählen", it: "Selezione multipla" },
      text: {
        de: "Mehrere Studenten markieren und gemeinsam löschen.",
        it: "Selezionare più studenti ed eliminarli insieme.",
      },
    },
    {
      target: "students-password",
      title: { de: "Passwort", it: "Password" },
      text: {
        de: "Mit „Zeigen“ siehst du das aktuelle Passwort. Hat der Student es selbst geändert, steht hier „selbst geändert“.",
        it: "Con «Zeigen» vedi la password attuale. Se lo studente l'ha cambiata, compare «selbst geändert».",
      },
    },
    {
      target: "students-actions",
      title: { de: "Aktionen", it: "Azioni" },
      text: {
        de: "Bearbeiten (auch Bestätigung für Slots), Zettel drucken, neues Passwort, sperren oder löschen.",
        it: "Modificare (anche l'autorizzazione ai turni), stampare, nuova password, bloccare o eliminare.",
      },
    },
  ],
  slots: [
    {
      target: "slots-opens",
      title: { de: "Buchungsstart", it: "Apertura prenotazioni" },
      text: {
        de: "Ab dieser Uhrzeit können Studenten für den nächsten Tag buchen.",
        it: "Da quest'ora gli studenti possono prenotare per il giorno dopo.",
      },
    },
    {
      target: "slots-slot",
      title: { de: "Slot einstellen", it: "Impostare un turno" },
      text: {
        de: "Uhrzeit ändern, mit − und + die Plätze festlegen, 16+ oder „Mit Bestätigung“ einschalten, mit ✕ löschen.",
        it: "Modifica l'orario, imposta i posti con − e +, attiva 16+ o «Mit Bestätigung», elimina con ✕.",
      },
    },
    {
      target: "slots-add",
      title: { de: "Slot hinzufügen", it: "Aggiungere un turno" },
      text: { de: "Fügt einen neuen Slot nach dem letzten hinzu.", it: "Aggiunge un nuovo turno dopo l'ultimo." },
    },
    {
      target: "slots-save",
      title: { de: "Speichern", it: "Salvare" },
      text: {
        de: "Änderungen gelten erst nach dem Speichern – sofort für alle.",
        it: "Le modifiche valgono solo dopo il salvataggio – subito per tutti.",
      },
    },
  ],
  design: [
    {
      target: "design-colors",
      title: { de: "Farbe wählen", it: "Scegliere il colore" },
      text: {
        de: "Eine Vorlage antippen oder einen eigenen Farbcode eingeben.",
        it: "Tocca un colore predefinito o inserisci un codice colore.",
      },
    },
    {
      target: "design-save",
      title: { de: "Speichern", it: "Salvare" },
      text: { de: "Die Farbe gilt nach dem Speichern für alle Benutzer.", it: "Dopo il salvataggio il colore vale per tutti." },
    },
  ],
  admins: [
    {
      target: "admins-new",
      title: { de: "Admin anlegen", it: "Creare un admin" },
      text: {
        de: "Namen eingeben – das Passwort wird nur einmal angezeigt, also gleich notieren.",
        it: "Inserisci il nome – la password viene mostrata una sola volta, annotala subito.",
      },
    },
  ],
} satisfies Record<string, TourStep[]>;

export type TourId = keyof typeof TOURS;

export const isTourId = (value: unknown): value is TourId => typeof value === "string" && value in TOURS;
