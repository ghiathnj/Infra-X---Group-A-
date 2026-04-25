# Infra-X · Team A

> A containerised, microservices-based web platform that lets patients submit a structured intake form online and lets doctors triage, review, and annotate those submissions from a role-based admin dashboard.

This repository is the Team A stream of the **Infra-X** multi-team engineering programme — a hands-on, full-stack exercise that mirrors how a small product team actually ships: working on separate feature branches, opening merge requests, reviewing each other's code, and integrating behind a shared Docker Compose environment.

---

## Highlights

- **Clean microservices split** — each service owns its own database, exposes a small HTTP contract, and is independently buildable and deployable.
- **JWT-based security with shared signing key** — one service issues tokens, another consumes them, with a Base64-decoded HMAC-SHA256 key so tokens minted on `auth-service` validate on `clinical-service` without coupling.
- **CORS wired end-to-end** — the Angular SPA on port `3000` talks to two different backends on `8080` and `8081` without browser pain; every OPTIONS preflight is handled server-side.
- **Validation enforced on both sides of the wire** — the frontend uses Angular reactive forms with the same regex/email/required rules that the backend re-asserts via Jakarta Bean Validation, so bad input is caught early and never reaches the database.
- **Role-aware UI** — a public landing page routes patients to an unauthenticated intake form and doctors to a JWT-protected dashboard with urgency-sorted triage.
- **Triage + analytics in one place** — the doctor dashboard pairs a per-submission triage table (red / yellow / green urgency badges, click-to-edit modal) with a Statistics tab that aggregates symptoms, volume, diagnosis backlog, and top allergies / medications / pre-existing conditions over the last six months — all computed in-browser from a single API call.
- **Per-submission timestamps** — every patient form records its own `submittedAt` (Hibernate `@CreationTimestamp`, immutable through the admin PATCH); the dashboard shows it in `de-DE` format and uses it to power the monthly aggregations.
- **Privacy-safe third-party integration** — the public landing page calls Open-Meteo for live Karlsruhe weather without ever leaking the doctor's JWT, thanks to a scoped `HttpInterceptor` that only attaches the bearer token to internal API origins.
- **Production-minded containerisation** — multi-stage Dockerfiles, Alpine/`-jre` runtime images, nginx-served SPA with single-page-app fallback and long-cache static asset headers.

---

## Tech Stack

| Layer          | Technology                                                               |
| -------------- | ------------------------------------------------------------------------ |
| Backend        | Java 17 · Spring Boot 4.0.5 · Spring Security · Spring Data JPA · Hibernate · JJWT 0.12.6 · Jakarta Bean Validation · Lombok |
| Frontend       | Angular 17 (standalone components · signals · `@for`/`@if` control flow · reactive forms) · TypeScript 5.4 · RxJS            |
| Database       | MariaDB 11 (one database instance per service)                            |
| Build / Infra  | Maven · Node 20 · Docker · Docker Compose · nginx 1.27-alpine             |
| Test tooling   | JUnit 5 · Spring Boot Test · Postman collection (Git-synced under `postman/`) |

---

## Architecture

```
                                 ┌────────────────────────────────────┐
                                 │       Angular SPA (nginx :3000)    │
                                 │                                    │
                                 │  /              landing            │
                                 │  /patient-form  public intake      │
                                 │  /login         doctor sign-in     │
                                 │  /dashboard     triage + statistics│
                                 └──┬──────────┬───────────────────┬──┘
                                    │ login    │ JWT-protected     │ no auth
                                    │          │ submissions API   │ third-party
                                    ▼          ▼                   ▼
              ┌──────────────────────┐  ┌──────────────────────┐  ┌──────────────────┐
              │     auth-service     │  │   clinical-service   │  │   Open-Meteo     │
              │   Spring Boot :8080  │  │   Spring Boot :8081  │  │  (live weather)  │
              │                      │  │                      │  │                  │
              │  POST /api/auth/login│  │  REST + Bean         │  │  no API key,     │
              │  BCrypt + JWT (HS256)│  │  Validation + JWT    │  │  no JWT (scoped  │
              │  Role-based access   │  │  filter (same key)   │  │  HttpInterceptor)│
              └──────────┬───────────┘  └──────────┬───────────┘  └──────────────────┘
                         │                         │
                         ▼                         ▼
                  ┌─────────────┐          ┌─────────────┐
                  │ mariadb-auth│          │mariadb-clinic│
                  │   auth_db   │          │  clinicdb   │
                  └─────────────┘          └─────────────┘
```

Each backend service is isolated — the only shared contract is the JWT secret and the role claim convention (`ROLE_ADMIN` / `ROLE_DOCTOR`). The third-party Open-Meteo call is sandboxed to the landing page and never receives credentials, even when a doctor is signed in on the same device.

---

## Services

### `auth-service` (:8080)

The authentication and identity microservice.

- `POST /api/auth/login` — username + password, returns a signed JWT containing the subject and roles claim (`ROLE_ADMIN`).
- BCrypt password hashing, stateless session policy, CSRF disabled (appropriate for stateless JWT), JWT filter registered before the standard username/password filter.
- Seeds a default admin user on first boot via a `CommandLineRunner` so the full stack is demo-ready after a single `docker compose up`.
- CORS allows the Angular origin.

### `clinical-service` (:8081)

The patient intake and triage microservice.

- `POST /api/clinical/forms` — **public** endpoint for patients to submit an intake form. No authentication required (mirrors the way real clinics accept submissions from walk-ins).
- `GET  /api/clinical/forms` — returns the list of all submissions. JWT-protected.
- `GET  /api/clinical/forms/{id}` — single submission. JWT-protected.
- `PATCH /api/clinical/forms/{id}/admin` — doctor sets `diagnosis` and `notes`. JWT-protected.
- Validates inputs per the ticket's acceptance criteria: first name / last name / street / city must be uppercase; street number and postal code must be numeric; phone number must match an international format; email format when provided.
- Every submission carries a `submittedAt` timestamp set automatically by Hibernate `@CreationTimestamp` on first persist; `@Column(updatable = false)` guarantees the admin PATCH cannot overwrite it. Spring's Jackson serialises it as ISO-8601 in every GET response.
- Shares the JWT signing secret with `auth-service` — tokens issued by one validate on the other without any cross-service call.

### `frontend` (Angular 17, served by nginx :3000)

A single-page application covering the full doctor/patient UX.

- **`/`** — public landing page with a role picker ("I am a patient" / "I am a doctor"), plus a live Karlsruhe weather card (Open-Meteo, no API key) and a *Doctor's tip* strip that rotates through 12 evergreen health tips every 5 seconds. The rotation timer is cancelled on navigation away via `takeUntilDestroyed(DestroyRef)` so nothing leaks.
- **`/patient-form`** — public reactive form with client-side validation that mirrors the backend rules; sticky action bar keeps the *Submit* button visible regardless of form length; clears any stale doctor session on entry so shared clinic devices are safe.
- **`/login`** — doctor sign-in with field-level validation, loading state, friendly error handling.
- **`/dashboard`** — JWT-guarded view with two tabs:
  - **Submissions** — triage table sorted by an urgency score (symptom count), colour-coded red / yellow / green, with a "Submitted" timestamp column. Each row opens a details modal where the doctor can record `diagnosis` and `notes`; saving hits `PATCH /api/clinical/forms/{id}/admin` and updates the row in place without a full re-fetch.
  - **Statistics** — four panels aggregated client-side from the same submissions response (no extra API call): symptoms per month (last 6 months), submissions volume per month, diagnosis-rate per month (stacked green/yellow bar with `12 / 31 (39 %)` caption), and top allergies / medications / pre-existing conditions all-time. Computed via `computed()` signals so the panels update automatically the moment the doctor saves a diagnosis.
- Auth token is attached to outgoing requests by an `HttpInterceptor` that is **scoped to internal API origins** (`apiBaseUrl`, `apiClinicalUrl`) — third-party calls (e.g. Open-Meteo on the landing page) get a clean request, even when a doctor is signed in.
- Route guards enforce role-based access; `publicGuard` auto-redirects signed-in doctors away from the login page; `authGuard` enforces `ROLE_ADMIN`/`ROLE_DOCTOR` on the dashboard.

---

## Quick start

Prerequisites: **Docker** and **Docker Compose v2+** — nothing else. Java, Maven, Node, and the Angular CLI are only needed if you want to develop a service outside of containers.

```bash
git clone https://gitlab.com/infra-x-group/team-a.git
cd team-a
docker compose up --build
```

Once everything is healthy:

| URL                                             | What you'll see                             |
| ----------------------------------------------- | ------------------------------------------- |
| http://localhost:3000                           | Landing page — choose patient or doctor     |
| http://localhost:3000/patient-form              | Public patient intake form                  |
| http://localhost:3000/login                     | Doctor sign-in (`admin` / `admin`)          |
| http://localhost:3000/dashboard                 | Triage dashboard (after login)              |
| http://localhost:8080/api/auth/login            | Auth API                                    |
| http://localhost:8081/api/clinical/forms        | Clinical API                                |

A ready-to-import **Postman collection** is under [`postman/collections/clinical-service.postman_collection.json`](postman/collections/clinical-service.postman_collection.json) with tests covering every endpoint, including CORS preflight and validation failures.

---

## Project structure

```
team-a/
├── auth-service/              # Spring Boot · authentication + JWT
│   ├── src/main/java/infrax/teama/auth_service/
│   │   ├── controller/        # AuthController
│   │   ├── dto/               # LoginRequest, LoginResponse
│   │   ├── model/             # User, Role (JPA entities)
│   │   ├── repository/        # Spring Data JPA
│   │   ├── service/           # JwtService, CustomUserDetailsService
│   │   └── config/            # SecurityConfig, CORS, DataInitializer
│   └── Dockerfile             # Multi-stage: temurin-jdk → temurin-jre
│
├── clinical-service/          # Spring Boot · patient intake + triage
│   ├── src/main/java/infrax/teama/clinical_service/
│   │   ├── controller/        # PatientFormController
│   │   ├── dto/               # PatientFormRequest (with @Pattern/@Email)
│   │   ├── model/             # PatientForm + enum types (Symptom, Allergy, …)
│   │   ├── repository/
│   │   ├── service/
│   │   └── security/          # JwtProvider, JwtAuthenticationFilter, CORS
│   └── Dockerfile
│
├── frontend/                  # Angular 17 SPA
│   └── src/app/
│       ├── core/              # auth.service, scoped auth.interceptor,
│       │                      # route guards, weather.service, doctor-tips
│       ├── pages/
│       │   ├── landing/       # role picker + weather + rotating tips
│       │   ├── login/         # doctor sign-in
│       │   ├── patient-form/  # public reactive-form intake
│       │   └── dashboard/     # triage table + detail modal + statistics tab
│       │       ├── dashboard.component
│       │       ├── submission-detail-modal.component
│       │       └── statistics-panel.component
│       └── environments/
│
├── postman/                   # Git-synced API collection + env
├── db-init/                   # MariaDB init scripts
├── init-databases.sql         # creates auth_db + clinicdb
└── docker-compose.yml         # 4 services + healthcheck + networks
```

---

## Engineering notes

A few decisions worth calling out for a reviewer:

- **Authentication is centralised, authorisation is local.** Only `auth-service` knows how to mint tokens; every other service is stateless and just verifies the signature. Adding a third service in the future means copying ~40 lines of filter/provider code — no service discovery, no session store.
- **One database per service**, co-located on MariaDB instances behind the same Docker network. Cheap isolation that still lets each service own its schema and evolve independently.
- **Validation is duplicated on purpose.** The Angular form enforces the same rules as the backend DTO because (a) the frontend rejects bad input instantly for a crisp UX and (b) the backend re-validates because clients can't be trusted. Both sets of rules live right next to the data they describe.
- **Shared-device safety.** Clinic front desks are often shared. The `patient-form` route actively clears any signed-in doctor session on load — a patient using the same machine can never navigate into the doctor's dashboard with a leftover token.
- **Scoped HTTP interceptor.** The `authInterceptor` only attaches the JWT to requests whose URL begins with `apiBaseUrl` or `apiClinicalUrl`. Third-party calls (Open-Meteo today, anything else tomorrow) are guaranteed never to receive the doctor's token — and the same scope is applied to the 401-redirect handler so a foreign 401 cannot bounce the user out of their session.
- **Analytics without a backend round-trip.** The dashboard's Statistics tab aggregates monthly symptom frequencies, submission volume, diagnosis backlog, and top allergies/medications/conditions entirely in TypeScript via `computed()` signals over the existing `GET /api/clinical/forms` response. Result: instant tab switching, automatic refresh after every saved diagnosis, and zero new endpoints to build or version. If the dataset later outgrows the browser, the same shape can move to a backend `/stats` endpoint without changing the UI.
- **Progressive enhancement of Hanin's original submit-service.** The clinical-service backend was rebased from a teammate's earlier work, renamed, and hardened (JWT key encoding, port conflict, URL-mapping cleanup, CORS). The git history preserves the original authorship.

---

## Status

The architecture, services, and features documented above are fully implemented. Integration of the individual branches into `main` happens through peer-reviewed merge requests on GitLab; see the open MR list for what's currently in review. `main` always reflects the stable, merged baseline.

---

## Team A

Infra-X Team A is a group of engineering programme participants collaborating on the project via GitLab merge requests and peer review. Individual contributions are visible in the commit history and MR thread of each feature branch.

