# CRM-APP

Lekki, modułowy CRM zbudowany w Angularze z Firebase Auth i json-serverem.

---

## Spis treści

- [Opis projektu](#opis-projektu)
- [Funkcjonalności](#funkcjonalności)
- [Technologie](#technologie)
- [Wymagania wstępne](#wymagania-wstępne)
- [Instalacja](#instalacja)
- [Uruchamianie](#uruchamianie)
  - [Backend (json-server)](#backend-json-server)
  - [Frontend (Angular)](#frontend-angular)
- [Struktura katalogów](#struktura-katalogów)
- [Testowanie](#testowanie)
- [Licencja](#licencja)

---

## Opis projektu

CRM-APP to prosty system do zarządzania kontaktami i lejkami sprzedaży.  
Pozwala na:

- Rejestrację i logowanie użytkowników (Firebase Auth)
- Tworzenie i edycję kontaktów z polami dodatkowymi (tagi, status, źródło, region)
- Import/eksport kontaktów (CSV, XLSX, PDF)
- Wieloetapowy lejek sprzedaży z drag & drop (CDK DragDrop)
- Podgląd KPI: liczniki, conversion rate, średni czas w etapach
- Konfigurację dynamicznych pól w zależności od etapu lejka
- Responsywny interfejs z bocznym panelem nawigacyjnym

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

5. **UI/UX**

- Bootstrap 4 + Bootstrap Icons
- Sidebar z przyciskami i ikonami
- Stopka z nawigacją

---

## Technologie

- **Framework:** Angular (standalone components, RxJS)
- **Auth:** Firebase Authentication (`@angular/fire`)
- **Backend do dev:** `json-server`
- **UI:** Bootstrap 4, Bootstrap Icons
- **Drag & Drop:** Angular CDK DragDrop
- **Import/eksport:** biblioteki CSV/XLSX/PDF w `ImportExportService`

---

## Wymagania wstępne

- Node.js ≥ 14
- npm (lub yarn)
- Konto Firebase (dla Auth)

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

### Backend (json-server)

Utwórz plik db.json w katalogu projektu z pustą strukturą:

```
{
"contacts": [],
"stages": [],
"leads": []
}
```

Uruchom:

```
json-server --watch db.json --port 3000
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
ng serve
```

Aplikacja będzie dostępna pod http://localhost:4200.

---

## Struktura katalogów

```
/src
├─ /app
│ ├─ /auth
│ │ ├ login.component.ts/.html/.scss
│ │ └ register.component.ts/.html/.scss
│ ├─ /contacts
│ │ ├ contact-form.component.ts/.html/.scss
│ │ ├ contact-list.component.ts/.html/.scss
│ │ ├ contact.service.ts
│ │ └ import-export.service.ts
│ ├─ /sales-funnel
│ │ ├ funnel.component.ts/.html/.scss
│ │ ├ kpi.component.ts/.html/.scss
│ │ ├ lead-detail.component.ts/.html/.scss
│ │ ├ stage-config.component.ts/.html/.scss
│ │ └ sales-funnel.service.ts
│ ├─ app.component.ts/.html/.scss
│ └─ app-routing.module.ts
├─ /environments
│ └ environment.ts
└─ styles.scss
```

---

## Testowanie

### Jednostkowe:

```
ng test
```

E2E (Protractor/Cypress): (jeśli skonfigurowane)

```
ng e2e
```

---

### Licencja

MIT © Adrian Rodzic
