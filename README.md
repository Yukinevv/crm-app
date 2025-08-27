# CRM-APP

Lekki, modułowy CRM zbudowany w Angularze z Firebase Auth, Functions oraz json-serverem.

---

## Spis treści

- [Opis projektu](#opis-projektu)
- [Funkcjonalności](#funkcjonalności)
- [Technologie](#technologie)
- [Wymagania wstępne](#wymagania-wstępne)
- [Instalacja](#instalacja)
- [Uruchamianie](#uruchamianie)
  - [Backend (json-server i emulator Firebase)](#backend-json-server-i-emulator-firebase)
  - [Frontend (Angular)](#frontend-angular)
- [Struktura katalogów](#struktura-katalogów)
- [Testowanie](#testowanie)
- [Licencja](#licencja)

---

## Opis projektu

CRM-APP to lekki system do zarządzania kontaktami, lejkiem sprzedaży, kalendarzem spotkań oraz komunikacją e-mail.  
Najważniejsze możliwości:

- **Autentykacja** - rejestracja/logowanie (Firebase Auth) i ochrona tras.
- **Kontakty** - pełny CRUD z polami dodatkowymi (tagi, status, źródło, region, menedżer, decydent),
  filtrowanie/sortowanie/wyszukiwanie, import/eksport (CSV/XLSX/PDF).
- **Lejek sprzedaży** - definiowalne etapy, drag & drop leadów, dynamiczne pola per etap, szczegóły leada (notatki, checklisty, załączniki).
- **KPI** - liczniki, conversion rate, średni czas w etapach.
- **Kalendarz spotkań** - widoki miesiąc/tydzień/dzień (FullCalendar), szybkie "Nowe spotkanie", wybór bez weekendów,
  wydarzenia: własne/zaproszone/globalne, formularz (uczestnicy z kontaktów, lokalizacja/link, "cały dzień", przypomnienie),
  zaproszenia e-mail, akcja "Opuść spotkanie".
- **Rezerwacje** - lista wolnych slotów, prosty formularz (imię, e-mail), automatyczne utworzenie wydarzenia (bez `userId`),
  oznaczenie slotu jako zajęty, wysyłka potwierdzenia e-mail.
- **E-mail**
  - **Skrzynka** (Odebrane/Wysłane) z filtrami (pełnotekst, nadawca, temat, daty, "tylko nieprzeczytane") i oznacz przeczytane.
  - **Kompozycja + Szablony** - zmienne `{{ }}` z auto-sync (osobno temat/treść), prefill dla odpowiedzi.
  - **Wysyłka/Śledzenie** - SendGrid/MailHog/Ethereal, tagowanie UTM, tracking klików `/api/t`, zapis do "Wysłane" + log konwersacji (out).
  - **Odczyt** - bezpieczne renderowanie, auto-log (in), "Odpowiedz", "Importuj wątek".
  - **Masowa wysyłka** - wybór kontaktów, interpolacja zmiennych, postęp/throttling/anulowanie, log z `contactId`.
  - **Wątki** - widok rozmowy po `contactId`/`leadId`/email, rozwijanie treści, cache.
  - **Statystyki** - Top 10 (wykres), zakres dni, szczegóły z filtrami i wykresem czasu, eksport CSV.
- **UI/UX** - Bootstrap 4 + Icons, spójne tokeny kolorów, sidebar nawigacyjny, dopracowana stopka.

---

## Funkcjonalności

1. **Autentykacja**

- Rejestracja i logowanie z walidacją danych
- Ochrona tras wymagających logowania (routing)

2. **Moduł Kontaktów**

- CRUD kontaktów: imię, nazwisko, firma, email, telefon, adres, notatki, tagi, status, źródło, region, menedżer, decydent
- Filtrowanie, stronicowanie, wyszukiwanie pełnotekstowe
- Import/eksport (CSV, XLSX, PDF)

3. **Moduł Lejka Sprzedaży**

- Definiowalne etapy lejka
- Przeciągnij & upuść leady między etapami
- Dynamiczne pola (np. kwota oferty, oczekiwany rabat)
- Podgląd szczegółów leada ze wszystkimi notatkami, checklistą, załącznikami

4. **Raportowanie KPI**

- Liczba leadów w każdym etapie
- Conversion rate (ostatni etap / wszystkie leady)
- Średni czas przebywania w etapie (dni)

5. **Kalendarz spotkań**

- Widok miesiąc/tydzień/dzień (**FullCalendar**), własny przycisk **„Nowe spotkanie”**; zaznaczanie zakresu bez weekendów.
- Źródła zdarzeń: **moje + zaproszone + rezerwacje globalne** oraz tryb podglądu **„Wszystkie”**.
- Formularz: tytuł, uczestnicy (z kontaktów), lokalizacja/link, start-koniec/**cały dzień**, przypomnienie; **edycja tylko dla twórcy**.
- Zaproszenia e-mail dla uczestników (Cloud Function `sendInvitationEmail`: SendGrid/MailHog/Ethereal).
- Akcja **„Opuść spotkanie”** - usuwa użytkownika z zaproszonych i uczestników.
- Karty wydarzeń pokazują "**Utworzył: Ty/Nazwa**"; kliknięcie otwiera edycję/podgląd.

6. **Rezerwacje (Booking)**

- Lista **dostępnych terminów** (slotów) i szybka rezerwacja.
- Formularz: **imię i nazwisko + e-mail** z walidacją; po sukcesie:
  - tworzy się **wydarzenie kalendarza** (rezerwacja globalna - bez `userId`),
  - slot jest oznaczany jako **booked**,
  - wysyłane jest **potwierdzenie e-mail** (Cloud Function `sendBookingConfirmation`: SendGrid/MailHog/Ethereal).
- Automatyczny powrót do listy po krótkim komunikacie sukcesu.

7. **E-mail (Skrzynka, Kompozycja, Odczyt, Masowa wysyłka, Wątki, Statystyki)**

- **Skrzynka (Inbox/Wysłane)**
  - Dwie zakładki: *Odebrane* (IMAP/MailHog) i *Wysłane* (lokalne wysyłki).
  - Filtry inboxu z debounce 300 ms: pełnotekstowo, *from*, *subject*, zakres dat, *tylko nieprzecz.*.
  - Akcje: podgląd wiadomości, compose, oznaczanie jako przeczytane po wejściu.

- **Kompozycja + Szablony**
  - Formularz: *to, subject, body, trackLinks*, wybór **szablonu**.
  - Zmiennie `{{ key }}` z auto-wykrywaniem typu (*text/date/time*) i **auto-sync** (osobno dla tematu/treści) z możliwością ręcznego *Zastosuj teraz*.
  - Prefill z query (np. *Reply*) wyłącza auto-sync dla ręcznie nadpisanych pól.

- **Wysyłka i śledzenie**
  - `POST /api/mail/send` - fizyczna wysyłka (SendGrid/MailHog/Ethereal).
  - Opcjonalne **tagowanie linków** (UTM): `utm_source, utm_medium, utm_campaign, utm_content, utm_recipient`.
  - **Tracking klików**: każdy URL może być owinięty w `/api/t?m=<messageId>&u=<url>&r=<recipient>` (integracja ze statystykami klików).
  - Po sukcesie zapis do `POST /api/emails` + **log konwersacji (out)**.

- **Odczyt wiadomości**
  - Widok wysłanej: bezpieczne renderowanie (linkifikacja, <br> z nowych linii).
  - Widok odebranej: *markRead*, render treści, **auto-log konwersacji (in)** po otwarciu.
  - Akcje: **Odpowiedz** (prefill *to/subject/body* z cytatem), **Importuj wątek** (heurystyka po znormalizowanym temacie i rozmówcy, masowy log *in/out*).

- **Masowa wysyłka**
  - Wybór odbiorców z listy kontaktów (wyszukiwarka, "Zaznacz widoczne", czyszczenie wyboru).
  - Interpolacja zmiennych w temacie i treści: `{{firstName}}`, `{{lastName}}`, `{{company}}`, `{{email}}`, `{{position}}`.
  - Postęp wysyłki z podsumowaniem (*sent/error*), throttling ~120 ms, możliwość anulowania i resetu.
  - Każdy wysłany mail opcjonalnie taguje linki (UTM) i jest logowany do konwersacji z `contactId`.

- **Wątek korespondencji**
  - Widok rozmowy filtrowany przez `contactId`, `leadId` lub `email` (query params).
  - Chronologiczna lista "in/out" z możliwością rozwijania wiadomości; treść dociągana i cache’owana na żądanie.
  - Tytuł wątku automatycznie z nazwy kontaktu lub adresu.

- **Statystyki kliknięć**
  - **Przegląd:** Top 10 wiadomości (wykres słupkowy), zakres dni, eksport CSV, wybór wiersza do szczegółów.
  - **Szczegóły:** Filtry (odbiorca/URL), wykres linii "kliknięcia w czasie", tabela klików, eksport CSV.
  - Mapowanie statystyk do skrzynki po `messageId` (łączenie tematu, odbiorcy, daty z licznikami).

- **Modele/serwisy**
  - `EmailService`: lista/widok, `sendEmail()` (UTM + tracking + zapis + log *out*), `markAsRead()`.
  - `InboxService`: lista/wiadomość/markRead (MailHog/IMAP).
  - `TemplateService`: pobieranie listy i pojedynczego szablonu.
  -
    - `ConversationService`: pobieranie i logowanie pozycji wątku.
  - `EmailStatsService`: podsumowania i listy klików dla `messageId`.

8. **UI/UX**

- Bootstrap 4 + Bootstrap Icons
- Sidebar z przyciskami i ikonami
- Stopka z nawigacją

---

## Technologie

- **Frontend (Angular):** standalone components, Router, Reactive Forms, HttpClient, RxJS
- **UI:** Bootstrap 4, Bootstrap Icons, SCSS z tokenami (CSS variables)
- **Drag & Drop:** Angular CDK DragDrop
- **Kalendarz:** FullCalendar (`@fullcalendar/angular`, `interaction`, `daygrid`, `timegrid`)
- **Wykresy:** Chart.js + `chartjs-adapter-date-fns`
- **Auth:** Firebase Authentication (`@angular/fire`)
- **Funkcje chmurowe:** Firebase Functions v2 (`onRequest`, `onCall`), wywołania przez `@angular/fire/functions`
- **Backend/API (dev):** Node.js + Express + `json-server` (lowdb) - routing `/api`, `/inbox`, `/mail`, tracking `/t`
- **E-mail – wysyłka:** Nodemailer (SendGrid przez sekret, MailHog w emulatorze, Ethereal jako fallback)
- **E-mail – odbiór (Inbox):** MailHog (dev) oraz IMAP (produkcyjnie) z `imapflow` + `mailparser` + `iconv-lite`
- **Dane/Statystyki:** Firestore (Admin SDK) - zapisy klików, podsumowania i eksport CSV
- **Śledzenie/UTM:** przepisywanie URL-i (URL API) + redirect tracker `/api/t` z UTM i `messageId`

---

## Wymagania wstępne

- Node.js >= 14
- npm (lub yarn)
- Konto Firebase (dla Auth, Functions)

---

## Instalacja

```bash
# Sklonuj repo
git clone https://github.com/twojuser/crm-app.git
cd crm-app

# Zainstaluj zależności frontendu
npm install

# Zainstaluj json-server globalnie lub lokalnie
npm install -g json-server
```

---

## Uruchamianie

### Backend (json-server i emulator Firebase)

Utwórz plik db.json w katalogu projektu (functions) z pustą strukturą:

```
{
"contacts": [],
"stages": [],
"leads": [],
"events": [],
"slots": [],
"emails": [],
"emailTemplates": []
}
```

Utwórz również plik db-email.json w tej samej lokalizacji:

```
{
"conversations": [],
"leadsEmail:" [],
"inboxRead": []
}
```

Uruchom:

```
firebase emulators:start --only functions,ui
json-server --watch functions/db.json --port 3000
```

### Frontend (Angular)

Skonfiguruj w environment.ts swój projekt Firebase (Auth):

```
export const environment = {
  production: false,
  firebase: {
  apiKey: "...",
  authDomain: "...",
  projectId: "...",
  // inne pola
  },
  apiUrl: 'http://localhost:3000/api'
};
```

Uruchom dev-server:

```
ng serve --proxy-config proxy.conf.json
```

Aplikacja będzie dostępna pod http://localhost:4200.

---

## Struktura katalogów

```
/src
├─ /app
│  ├─ /auth
│  │  ├─ login.component.ts/.html/.scss
│  │  ├─ register.component.ts/.html/.scss
│  │  └─ auth.service.ts
│  ├─ /contacts
│  │  ├─ contact-form.component.ts/.html/.scss
│  │  ├─ contact-list.component.ts/.html/.scss
│  │  ├─ contact.service.ts
│  │  ├─ import-export.service.ts
│  │  └─ contact.model.ts
│  ├─ /sales-funnel
│  │  ├─ funnel.component.ts/.html/.scss
│  │  ├─ kpi.component.ts/.html/.scss
│  │  ├─ lead-detail.component.ts/.html/.scss
│  │  ├─ stage-config.component.ts/.html/.scss
│  │  ├─ sales-funnel.service.ts
│  │  ├─ lead.model.ts
│  │  └─ stage.model.ts
│  ├─ /calendar
│  │  ├─ calendar.component.ts/.html/.scss
│  │  ├─ event-form.component.ts/.html/.scss
│  │  ├─ event.service.ts
│  │  └─ calendar-event.model.ts
│  ├─ /booking
│  │  ├─ booking.component.ts/.html/.scss
│  │  ├─ booking-form.component.ts/.html/.scss
│  │  ├─ booking.service.ts
│  │  ├─ slot.service.ts
│  │  └─ slot.model.ts
│  ├─ /email
│  │  ├─ email-list.component.ts/.html/.scss
│  │  ├─ email-compose.component.ts/.html/.scss
│  │  ├─ email-detail.component.ts/.html/.scss
│  │  ├─ inbox-detail.component.ts/.html/.scss
│  │  ├─ email-bulk.component.ts/.html/.scss
│  │  ├─ email-thread.component.ts/.html/.scss
│  │  ├─ email-stats.component.ts/.html/.scss
│  │  ├─ /email-stats-overview
│  │  │  └─ email-stats-overview.component.ts/.html/.scss
│  │  ├─ /email-stats-details
│  │  │  └─ email-stats-details.component.ts/.html/.scss
│  │  ├─ email.service.ts
│  │  ├─ inbox.service.ts
│  │  ├─ template.service.ts
│  │  ├─ template.model.ts
│  │  ├─ email-stats.service.ts
│  │  ├─ email-stats.model.ts
│  │  └─ /conversations
│  │     ├─ conversations-list.component.ts/.html/.scss
│  │     ├─ conversations.service.ts
│  │     └─ conversations.model.ts
│  ├─ /shared
│  │  └─ /components
│  │     ├─ /pagination
│  │     │  └─ pagination.component.ts
│  │     └─ /app-footer
│  │        └─ app-footer.component.ts/.html/.scss
│  ├─ app.component.ts/.html/.scss
│  └─ app-routing.module.ts
├─ /environments
│  └─ environment.ts
└─ styles.scss
```

---

## Testowanie

### Jednostkowe:

```
ng test
```

E2E (Protractor/Cypress):

```
ng e2e
```

---

### Licencja

MIT © Adrian Rodzic (`adrianrodzic33@gmail.com`)
