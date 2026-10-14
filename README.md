# Blog Management System

A REST API for managing blog articles, categories, comments, users, and authentication in a modular Node.js backend. The project uses Express, MongoDB (replica set), Redis caching, JWT-based auth with device sessions, structured logging, and Docker-based infrastructure for local development.

## Overview

This repository contains a complete backend service for a blog platform. It supports:

- User registration with OTP email verification
- JWT access tokens and device-scoped refresh-token sessions (multi-device login)
- OTP-based password reset with a short-lived reset-token cookie
- Role-based authorization for admin and user access
- Article CRUD with cover image upload and ownership checks
- Category management (categories are never deleted, only made unavailable)
- Threaded comments and replies
- Admin user management
- Redis caching for public reads
- Swagger/OpenAPI documentation
- Dockerized local stack with a MongoDB replica set, Redis, Elasticsearch, and Kibana

## Project Structure

```text
Blog Management System/
├── .github/workflows/        # CI/CD pipeline (tests, Docker image build and publish)
├── docs/                     # SRS, ERD, and diagrams (state, use case, DFD)
├── mongo-init/               # MongoDB replica set initialization script
├── server/                   # Application source code and runtime config
│   ├── src/
│   │   ├── api/v1/           # Controllers grouped by module
│   │   │   ├── article/
│   │   │   ├── authentication/
│   │   │   ├── category/
│   │   │   ├── comments/
│   │   │   └── user/
│   │   ├── config/           # Defaults and the Redis connection
│   │   ├── db/               # MongoDB connection logic
│   │   ├── lib/              # Business logic (services)
│   │   │   ├── articles/
│   │   │   ├── authentication/
│   │   │   ├── categories/
│   │   │   ├── comments/
│   │   │   ├── email/
│   │   │   ├── service registry/   # Cross-module operations (cascading deletes, comment lookups)
│   │   │   ├── storage/            # Cover image storage (local disk in development)
│   │   │   ├── token/
│   │   │   └── user/
│   │   ├── middleware/       # Auth, authorization, ownership, upload checks, logging
│   │   ├── model/            # Mongoose schemas and model definitions
│   │   ├── routes/           # API route registration
│   │   ├── utils/            # Shared helpers: logger, cache, hashing, validation, errors
│   │   ├── app.js            # Express app setup
│   │   └── index.js          # Bootstraps the app, database, and Redis
│   ├── test/                 # Unit and integration tests
│   ├── default.env           # Template for environment variables
│   ├── dockerfile            # Server container definition
│   ├── jest.integration.config.js
│   ├── package.json          # Scripts and dependencies
│   ├── swagger.yaml          # OpenAPI definition
│   └── yarn.lock             # Dependency lock file
├── docker-compose.yml        # Full local stack orchestration
└── README.md                 # Project documentation
```

Runtime folders created by the app (and ignored by git): `server/logs/` for Winston log files and `server/uploads/` for cover images.

## Tech Stack

| Layer                | Technology                               |
| -------------------- | ---------------------------------------- |
| Runtime              | Node.js 22                               |
| Framework            | Express.js                               |
| Database             | MongoDB (replica set) with Mongoose      |
| Cache                | Redis                                    |
| Auth                 | JWT, bcryptjs, HttpOnly cookies          |
| Email                | Nodemailer (SMTP)                        |
| File upload          | Multer (local disk in development)       |
| Validation & Routing | Express middleware and controller checks |
| Logging              | Winston, express-winston, Elasticsearch  |
| Docs                 | Swagger UI (`server/swagger.yaml`)       |
| Testing              | Jest + Supertest                         |
| Containerization     | Docker + Docker Compose                  |
| Package Manager      | Yarn 4                                   |

## Features

### Authentication

- Registration with a 6-digit email OTP (5-minute validity, 5 attempts, single use)
- Sign-in creates a device session; the refresh token lives in an HttpOnly cookie
- The access token is bound to its session, so logging out a device revokes it immediately
- Log out the current device, all devices, or one specific device; list active sessions
- OTP-based password reset; the single-use reset token (5 minutes) is delivered in an HttpOnly cookie
- Changing a password signs out the user's other sessions
- Admin bootstrap endpoint for first-time setup (works once)
- Rate-limited sensitive endpoints (5 requests per minute per IP)

### Articles

- Create, read, update, and delete articles with a cover image (JPG, JPEG, PNG, WebP; max 5 MB)
- Public listing of published articles with search, category filter, sorting, and pagination
- Admin-only listing of all articles and admin-only publish/draft status control
- Only the owner can edit an article; the owner or an admin can delete it
- Deleting an article also deletes its comments and cover image

### Categories

- Admins create and update categories and toggle them between `active` and `unavailable`
- Public callers only see active categories; admins see all of them and can filter by status

### Comments

- Top-level comments and nested replies on published articles
- Only the owner can edit a comment; the owner or an admin can delete it (replies are deleted too)
- Admins hide or show comments and list all comments

### Users

- Admin user management (create, list, update name/role/status, delete)
- Profile retrieval for the owner or an admin, with optional `expand`
- An admin cannot delete, block, or demote their own account, and the last active admin is always protected
- Deleting a user removes their sessions, tokens, articles, and all comments on or under them

### Infrastructure

- Centralized error handling with a correlation id on every response
- Daily rotating log files and Elasticsearch log shipping (authorization and cookie headers are never logged)
- Redis caching for article lists, article details, authors, and comment trees
- Containerized MongoDB replica set
- Swagger UI at `/docs`

## Prerequisites

- Node.js 22
- Yarn 4+
- Docker and Docker Compose
- MongoDB running as a **replica set** (the API uses transactions); Docker Compose provides one
- Redis (required, the server exits if it cannot connect)
- SMTP credentials for OTP emails

## Getting Started

### Option 1: Docker Compose (Recommended)

1. Clone the repository

```bash
git clone https://github.com/ihsiam/Blog_Management_System.git
cd Blog_Management_System
```

2. Create your environment file

```bash
cp server/default.env server/.env
```

3. Fill in the required values in `server/.env`

4. Start the full stack

```bash
docker compose up --build
```

5. Access the running services:

- API: http://localhost:3000
- Health check: http://localhost:3000/health
- Swagger docs: http://localhost:3000/docs
- MongoDB: localhost:27017, 27018, 27019
- Redis: localhost:6379
- Elasticsearch: http://localhost:9200
- Kibana: http://localhost:5601

### Option 2: Local Development

1. Install dependencies

```bash
cd server
yarn install
```

2. Create a local `.env` file based on `default.env`

3. Start MongoDB as a replica set (for example `mongod --replSet rs0` followed by `rs.initiate()`), and start Redis. Point `DB_URL` at the replica set, for example `mongodb://localhost:27017/Blog_Management_System?replicaSet=rs0`.

4. Run the app in development mode

```bash
yarn dev
```

For production:

```bash
yarn start
```

## Environment Variables

The project ships with a template in `server/default.env`. Copy it into a `.env` file before running the app.

```env
PORT=
APP_URL=
DB_URL=
REDIS_URL=
ELASTIC_URL=

SALT_ROUNDS=

JWT_ACCESS_SECRET=
JWT_REFRESH_SECRET=

JWT_ACCESS_EXPIRES=
JWT_REFRESH_EXPIRES=

EMAIL_SERVICE=
EMAIL_USER=
EMAIL_PASSWORD=
```

| Variable                                        | Required | Default                 | Notes                                    |
| ----------------------------------------------- | -------- | ----------------------- | ---------------------------------------- |
| `PORT`                                          | No       | `3000`                  | HTTP port                                |
| `APP_URL`                                       | No       | -                       | Used for the docs URL printed at startup |
| `DB_URL`                                        | Yes      | -                       | MongoDB replica set connection string    |
| `REDIS_URL`                                     | Yes      | -                       | Redis connection string                  |
| `ELASTIC_URL`                                   | No       | `http://localhost:9200` | Elasticsearch log shipping               |
| `SALT_ROUNDS`                                   | No       | -                       | bcrypt cost                              |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`       | Yes      | -                       | Use long random values                   |
| `JWT_ACCESS_EXPIRES`, `JWT_REFRESH_EXPIRES`     | No       | `15m`, `30d`            | Token lifetimes                          |
| `EMAIL_SERVICE`, `EMAIL_USER`, `EMAIL_PASSWORD` | Yes      | -                       | SMTP settings for OTP emails             |
| `MONGOOSE_SERVER_SELECTION_TIMEOUT_MS`          | No       | `5000`                  | Optional tuning                          |
| `MONGOOSE_BUFFER_TIMEOUT_MS`                    | No       | `10000`                 | Optional tuning                          |

Docker Compose overrides `PORT`, `APP_URL`, `DB_URL`, `ELASTIC_URL`, and `REDIS_URL` for the server container.

## API Overview

The API is grouped under `/api/v1` and uses JSON responses (cover uploads use `multipart/form-data`). Full request and response schemas are in Swagger at `/docs`.

Success responses use `{ code, message, data, links }`; list responses add `pagination`. Errors use `{ code, error, correlationId, message, data }`. Lists accept `page` and `limit` (1 to 100), and sorting and search parameters per resource.

### Health and Docs

| Method | Endpoint  | Description              |
| ------ | --------- | ------------------------ |
| GET    | `/health` | Server health check      |
| GET    | `/docs`   | Swagger UI documentation |

### Authentication

| Method | Endpoint                               | Description                                     | Access         |
| ------ | -------------------------------------- | ----------------------------------------------- | -------------- |
| POST   | `/api/v1/auth/setup-admin`             | Create the initial admin (works once)           | Public         |
| POST   | `/api/v1/auth/sign-up`                 | Register a new user and send a verification OTP | Public         |
| POST   | `/api/v1/auth/verify-email-otp`        | Verify the email with the OTP                   | Public         |
| POST   | `/api/v1/auth/resend-verification-otp` | Resend the verification OTP                     | Public         |
| POST   | `/api/v1/auth/sign-in`                 | Sign in and receive tokens                      | Public         |
| POST   | `/api/v1/auth/refresh`                 | Issue a new access token (refresh cookie)       | Refresh cookie |
| POST   | `/api/v1/auth/logout`                  | Log out the current device                      | Authenticated  |
| POST   | `/api/v1/auth/logout-all`              | Log out all devices                             | Authenticated  |
| GET    | `/api/v1/auth/sessions`                | List active sessions                            | Authenticated  |
| DELETE | `/api/v1/auth/sessions/:sessionId`     | Log out a specific device                       | Authenticated  |
| POST   | `/api/v1/auth/forgot-password`         | Send a password reset OTP                       | Public         |
| POST   | `/api/v1/auth/verify-reset-otp`        | Verify the OTP and issue the reset-token cookie | Public         |
| PATCH  | `/api/v1/auth/reset-password`          | Reset the password (reset-token cookie)         | Reset cookie   |

### Articles

| Method | Endpoint                                                  | Description                          | Access                       |
| ------ | --------------------------------------------------------- | ------------------------------------ | ---------------------------- |
| GET    | `/api/v1/articles`                                        | List published articles              | Public                       |
| POST   | `/api/v1/articles`                                        | Create an article (with cover image) | User, Admin                  |
| GET    | `/api/v1/articles/admin/all`                              | List all articles including drafts   | Admin                        |
| GET    | `/api/v1/articles/:id`                                    | Get an article (`expand=comments`)   | Public (drafts: owner/admin) |
| PATCH  | `/api/v1/articles/:id`                                    | Update an article                    | Owner                        |
| DELETE | `/api/v1/articles/:id`                                    | Delete an article                    | Owner, Admin                 |
| PATCH  | `/api/v1/articles/:id/status`                             | Set published or draft               | Admin                        |
| GET    | `/api/v1/articles/:id/author`                             | Get the article author               | Public                       |
| GET    | `/api/v1/articles/:id/comments`                           | List comments as a nested tree       | Public                       |
| POST   | `/api/v1/articles/:id/comments`                           | Comment on an article                | User, Admin                  |
| POST   | `/api/v1/articles/:articleId/comments/:commentId/replies` | Reply to a comment                   | User, Admin                  |

### Categories

| Method | Endpoint                        | Description                                  | Access              |
| ------ | ------------------------------- | -------------------------------------------- | ------------------- |
| GET    | `/api/v1/categories`            | List categories (admins see unavailable too) | Public              |
| POST   | `/api/v1/categories`            | Create a category                            | Admin               |
| GET    | `/api/v1/categories/:id`        | Get a category                               | Public (admin: all) |
| PATCH  | `/api/v1/categories/:id`        | Update name and/or description               | Admin               |
| PATCH  | `/api/v1/categories/:id/status` | Set active or unavailable                    | Admin               |

### Comments

| Method | Endpoint                      | Description                      | Access       |
| ------ | ----------------------------- | -------------------------------- | ------------ |
| GET    | `/api/v1/comments`            | List all comments                | Admin        |
| PATCH  | `/api/v1/comments/:id`        | Update a comment body            | Owner        |
| DELETE | `/api/v1/comments/:id`        | Delete a comment and its replies | Owner, Admin |
| PATCH  | `/api/v1/comments/:id/status` | Hide or show a comment           | Admin        |

Comments are created through the article routes above.

### Users

| Method | Endpoint                            | Description                             | Access       |
| ------ | ----------------------------------- | --------------------------------------- | ------------ |
| GET    | `/api/v1/users`                     | List users                              | Admin        |
| POST   | `/api/v1/users`                     | Create a user (active immediately)      | Admin        |
| GET    | `/api/v1/users/:id`                 | Get a user (`expand=articles,comments`) | Owner, Admin |
| PATCH  | `/api/v1/users/:id`                 | Update name, role, or status            | Admin        |
| DELETE | `/api/v1/users/:id`                 | Delete a user and related data          | Admin        |
| PATCH  | `/api/v1/users/:id/change-password` | Change the password                     | Owner        |

## Authentication

The API uses a **JWT access + refresh token** strategy with one server-side session per device:

1. **Sign-in** returns an `accessToken` in the JSON body and sets the `refreshToken` in an HttpOnly cookie. Both tokens carry the session id.
2. **Protected routes** require the header `Authorization: Bearer <accessToken>`. A token whose session was revoked is rejected.
3. When the access token expires, call **POST** `/api/v1/auth/refresh` (the refresh cookie is sent automatically) to get a new access token. The refresh token stays valid for the 30-day life of the session.
4. **Logout** removes the current device session; **logout-all** removes every session.

### Registration Flow

```
Sign up -> Email OTP -> POST /auth/verify-email-otp -> Account active -> Sign in
```

New users start with `pending` status until they verify their email. Admin-created users and the initial admin are `active` immediately.

### Password Reset Flow

```
POST /auth/forgot-password -> POST /auth/verify-reset-otp (sets resetToken cookie) -> PATCH /auth/reset-password
```

### Account Status

| From      | To        | Trigger                 |
| --------- | --------- | ----------------------- |
| `pending` | `active`  | Email verification      |
| `active`  | `blocked` | Admin blocks the user   |
| `blocked` | `active`  | Admin unblocks the user |

## User Roles

| Role      | Permissions                                                                                                                                                                                                   |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **user**  | Create and edit own articles, delete own articles, comment and reply, edit and delete own comments                                                                                                            |
| **admin** | Everything a user can do, plus manage users and categories, publish or unpublish any article, delete any article or comment, and hide or show comments. Admins cannot edit other users' articles or comments. |

## Testing

Run unit tests:

```bash
cd server
yarn test
```

Run integration tests:

```bash
cd server
yarn test:integration
```

## Notes

- The root project orchestrates the full stack through Docker Compose, which also overrides the container command to `yarn dev` with the source folder mounted.
- The backend server itself lives under the `server/` folder.
- MongoDB must run as a replica set because registration, token, delete, and password flows use transactions.
- Cover images are stored on local disk under `server/uploads/articles` during development and served from `/uploads/articles/`.
- Elasticsearch and Kibana are included for centralized log monitoring.

## Roadmap

The following features are **planned** and will be implemented incrementally:

- [ ] Load balancing
- [ ] Security hardening (`helmet`, stricter CORS)
- [ ] Cloud object storage for cover images

## Author

**Md Ismile Hosen Siam**

- GitHub: [@ihsiam](https://github.com/ihsiam)
- Repository: [Blog_Management_System](https://github.com/ihsiam/Blog_Management_System)
- Email: ismile.20cse034@gstu.edu.bd

## License

ISC
