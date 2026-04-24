# Infra-X · Team A

> A containerised, microservices-based web platform that lets patients submit a structured intake form online and lets doctors triage, review, and annotate those submissions from a role-based admin dashboard.

This repository is the Team A stream of the **Infra-X** multi-team engineering programme — a hands-on, full-stack exercise that mirrors how a small product team actually ships: working on separate feature branches, opening merge requests, reviewing each other's code, and integrating behind a shared Docker Compose environment.

---

## Highlights

- **Clean microservices split** — each service owns its own database, exposes a small HTTP contract, and is independently buildable and deployable.
- **JWT-based security with shared signing key** — one service issues tokens, another consumes them, with a Base64-decoded HMAC-SHA256 key so tokens mint on `auth-service` validate on `clinical-service` without coupling.
- **CORS wired end-to-end** — the Angular SPA on port `3000` talks to two different backends on `8080` and `8081` without browser pain; every OPTIONS preflight is handled server-side.
- **Validation enforced on both sides of the wire** — the frontend uses Angular reactive forms with the same regex/email/required rules that the backend re-asserts via Jakarta Bean Validation, so bad input is caught early and never reaches the database.
- **Role-aware UI** — a public landing page routes patients to an unauthenticated intake form and doctors to a JWT-protected dashboard with urgency-sorted triage.
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
                        ┌────────────────────────┐
                        │   Angular SPA (nginx)  │
                        │    localhost:3000      │
                        │                        │
                        │  /               ──── landing page
                        │  /patient-form   ──── public intake form
                        │  /login          ──── doctor sign-in
                        │  /dashboard      ──── triage + modal
                        └──┬──────────────────┬──┘
                           │ POST login       │ GET /api/clinical/forms
                           │                  │ GET /api/clinical/forms/{id}
                           │ JWT              │ PATCH /api/clinical/forms/{id}/admin
                           │                  │ POST  /api/clinical/forms  (public)
                           ▼                  ▼
              ┌──────────────────────┐  ┌──────────────────────┐
              │     auth-service     │  │   clinical-service   │
              │   Spring Boot :8080  │  │   Spring Boot :8081  │
              │                      │  │                      │
              │  POST /api/auth/login│  │  REST + Bean         │
              │  BCrypt + JWT (HS256)│  │  Validation + JWT    │
              │  Role-based access   │  │  filter (same key)   │
              └──────────┬───────────┘  └──────────┬───────────┘
                         │                         │
                         ▼                         ▼
                  ┌─────────────┐          ┌─────────────┐
                  │ mariadb-auth│          │mariadb-clinic│
                  │   auth_db   │          │  clinicdb   │
                  └─────────────┘          └─────────────┘
```

Each service is isolated — the only shared contract is the JWT secret and the role claim convention (`ROLE_ADMIN` / `ROLE_DOCTOR`).

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
- Shares the JWT signing secret with `auth-service` — tokens issued by one validate on the other without any cross-service call.

### `frontend` (Angular 17, served by nginx :3000)

A single-page application covering the full doctor/patient UX.

- **`/`** — public landing page with a role picker ("I am a patient" / "I am a doctor").
- **`/patient-form`** — public reactive form with client-side validation that mirrors the backend rules; sticky action bar keeps the *Submit* button visible regardless of form length; clears any stale doctor session on entry so shared clinic devices are safe.
- **`/login`** — doctor sign-in with field-level validation, loading state, friendly error handling.
- **`/dashboard`** — JWT-guarded triage view: submissions are sorted by an urgency score (symptom count), colour-coded red / yellow / green, and clickable to open a details modal where the doctor can record `diagnosis` and `notes`. Save hits the `PATCH /api/clinical/forms/{id}/admin` endpoint and updates the row in place without a full re-fetch.
- Auth token is attached to outgoing requests by an `HttpInterceptor`; route guards enforce role-based access; `publicGuard` auto-redirects signed-in doctors away from the login page; `authGuard` enforces `ROLE_ADMIN`/`ROLE_DOCTOR` on the dashboard.

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
│       ├── core/              # auth.service, auth.interceptor, route guards
│       ├── pages/
│       │   ├── landing/       # role picker (patient / doctor)
│       │   ├── login/         # doctor sign-in
│       │   ├── patient-form/  # public reactive-form intake
│       │   └── dashboard/     # triage table + detail modal
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
- **Progressive enhancement of Hanin's original submit-service.** The clinical-service backend was rebased from a teammate's earlier work, renamed, and hardened (JWT key encoding, port conflict, URL-mapping cleanup, CORS). The git history preserves the original authorship.

---

## Status

The architecture, services, and features documented above are fully implemented. Integration of the individual branches into `main` happens through peer-reviewed merge requests on GitLab; see the open MR list for what's currently in review. `main` always reflects the stable, merged baseline.

---

## Team A

Infra-X Team A is a group of engineering programme participants collaborating on the project via GitLab merge requests and peer review. Individual contributions are visible in the commit history and MR thread of each feature branch.

