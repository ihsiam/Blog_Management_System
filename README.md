# Blog Management System

A RESTful backend API for managing blog posts, comments, and users. Built with Node.js, Express, and MongoDB, featuring JWT-based authentication, role-based access control (RBAC), structured logging, and Docker support for local development.

> **Note:** This repository currently contains the **API server only**.

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [API Documentation](#api-documentation)
- [Authentication](#authentication)
- [User Roles](#user-roles)
- [Roadmap](#roadmap)
- [Author](#author)

## Features

### Currently Implemented

- **Authentication**
  - User registration with email verification
  - Login / logout with JWT access and refresh tokens
  - Token refresh via HTTP-only cookies
  - Password reset via email
  - One-time initial admin setup (`/api/v1/auth/setup-admin`)
  - Rate limiting on sensitive auth endpoints

- **Articles**
  - Create, read, update, and delete blog posts
  - Public listing of published articles with pagination, sorting, and search
  - Admin view for all articles (including drafts)
  - Ownership-based access control

- **Comments**
  - Post comments on articles
  - Update and delete own comments
  - Admin moderation (list, hide, delete)

- **User Management**
  - Admin CRUD for users
  - User status workflow: `pending` → `approved` / `blocked` / `declined`
  - Password change endpoint
  - Cascade delete (removes user's articles and comments)

- **Infrastructure**
  - Centralized error handling with correlation IDs
  - Winston logging with daily file rotation
  - Elasticsearch + Kibana for log aggregation
  - Swagger/OpenAPI documentation at `/docs`
  - Health check endpoint at `/health`
  - Docker Compose stack (API, MongoDB, Elasticsearch, Kibana)

## Tech Stack

| Layer | Technology |
|-------|------------|
| Runtime | Node.js 20 |
| Framework | Express 4 |
| Database | MongoDB 7 (Mongoose) |
| Auth | JWT (jsonwebtoken) + bcryptjs |
| Email | Nodemailer |
| Logging | Winston, express-winston, Elasticsearch |
| API Docs | Swagger UI (yamljs) |
| Package Manager | Yarn 4 |
| Containerization | Docker, Docker Compose |

## Architecture

```
HTTP Request
    ↓
Routes          →  URL mapping, middleware chain
    ↓
Controllers     →  Request validation, HTTP responses
    ↓
Services (lib)  →  Business logic
    ↓
Models          →  Mongoose schemas & database access
```

Middleware stack:

- CORS, JSON parsing, cookie parser
- Correlation ID (`x-correlation-id`)
- Request / error logging (Winston)
- JWT authentication
- Role authorization (`admin`, `user`)
- Resource ownership checks

## Project Structure

```
Blog Management System/
├── docker-compose.yml       # Full stack: server, mongo, elasticsearch, kibana
├── docs/                    # SRS, ER diagram, DFD, use case diagrams
└── server/
    ├── default.env          # Environment variable template
    ├── dockerfile
    ├── swagger.yaml         # OpenAPI specification
    └── src/
        ├── index.js         # Entry point
        ├── app.js           # Express app setup
        ├── api/v1/          # Controllers (auth, article, comment, user)
        ├── config/          # Default values (pagination, etc.)
        ├── db/              # MongoDB connection
        ├── lib/             # Business logic / services
        ├── middleware/      # Auth, authorize, ownership, logging
        ├── model/           # Mongoose models (User, Article, Comment)
        ├── routes/          # Route definitions
        └── utils/           # Errors, hashing, query helpers, logger
```

## Prerequisites

- [Node.js](https://nodejs.org/) 20+
- [Yarn](https://yarnpkg.com/) 4+ (Corepack enabled)
- [Docker](https://www.docker.com/) & Docker Compose (optional, recommended)
- MongoDB (if running without Docker)
- SMTP credentials for email (registration, password reset)

## Getting Started

### Option 1: Docker Compose (Recommended)

1. Clone the repository:

```bash
git clone <repository-url>
cd "Blog Management System"
```

2. Create environment file from template:

```bash
cp server/default.env server/.env
```

3. Fill in the required values in `server/.env` (see [Environment Variables](#environment-variables)).

4. Start all services:

```bash
docker compose up --build
```

5. Verify the server is running:

- API: [http://localhost:4000](http://localhost:4000)
- Health: [http://localhost:4000/health](http://localhost:4000/health)
- Swagger docs: [http://localhost:4000/docs](http://localhost:4000/docs)
- Kibana: [http://localhost:5601](http://localhost:5601)
- MongoDB: `localhost:27018`

### Option 2: Local Development (without Docker)

1. Install dependencies:

```bash
cd server
yarn install
```

2. Start MongoDB locally and set `DB_URL` in `.env`.

3. Run the development server:

```bash
yarn dev
```

For production:

```bash
yarn start
```

## Environment Variables

Copy `server/default.env` to `server/.env` and configure:

| Variable | Description | Example |
|----------|-------------|---------|
| `PORT` | Server port | `4000` |
| `APP_URL` | Public base URL (used in email links) | `http://localhost:4000` |
| `DB_URL` | MongoDB connection string | `mongodb://localhost:27017/Blog_Management_System` |
| `SALT_ROUNDS` | bcrypt salt rounds | `10` |
| `JWT_ACCESS_SECRET` | Secret for access tokens | Random secure string |
| `JWT_REFRESH_SECRET` | Secret for refresh tokens | Random secure string |
| `JWT_ACTIVE_RESET_SECRET` | Secret for email/reset tokens | Random secure string |
| `JWT_ACCESS_EXPIRES` | Access token lifetime | `15m` |
| `JWT_REFRESH_EXPIRES` | Refresh token lifetime | `7d` |
| `JWT_ACTIVE_RESET_EXPIRES` | Activation/reset token lifetime | `5m` |
| `EMAIL_SERVICE` | Nodemailer service name | `gmail` |
| `EMAIL_USER` | SMTP email address | `your@gmail.com` |
| `EMAIL_PASSWORD` | SMTP password / app password | `your-app-password` |
| `ELASTIC_URL` | Elasticsearch URL (for logging) | `http://localhost:9200` |

> **Security:** Never commit `.env` files. Use strong, unique secrets for each JWT variable in production.

## API Documentation

Interactive Swagger UI is available at:

```
http://localhost:4000/docs
```

The OpenAPI spec lives in `server/swagger.yaml`.

### Main Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/v1/auth/setup-admin` | Create initial admin | Public |
| POST | `/api/v1/auth/sign-up` | Register new user | Public |
| POST | `/api/v1/auth/sign-in` | Login | Public |
| POST | `/api/v1/auth/logout` | Logout | Required |
| POST | `/api/v1/auth/refresh` | Refresh access token | Cookie |
| GET | `/api/v1/auth/verify-email/:token` | Verify email | Public |
| POST | `/api/v1/auth/forgot-password` | Request password reset | Public |
| PATCH | `/api/v1/auth/reset-password/:token` | Reset password | Public |
| GET | `/api/v1/articles` | List published articles | Public |
| POST | `/api/v1/articles` | Create article | User / Admin |
| GET | `/api/v1/articles/:id` | Get single article | Public |
| PATCH | `/api/v1/articles/:id` | Update article | Owner / Admin |
| DELETE | `/api/v1/articles/:id` | Delete article | Owner / Admin |
| GET | `/api/v1/articles/all` | List all articles (admin) | Admin |
| GET/POST | `/api/v1/articles/:id/comments` | Article comments | Mixed |
| GET/POST | `/api/v1/comments` | Comment management | Admin |
| GET/POST | `/api/v1/users` | User management | Admin |

## Authentication

The API uses a **JWT access + refresh token** strategy:

1. **Login** returns an `accessToken` in the JSON body and stores the `refreshToken` in an HTTP-only cookie.
2. **Protected routes** require the header: `Authorization: Bearer <accessToken>`.
3. When the access token expires, call **POST** `/api/v1/auth/refresh` to get a new one (refresh token is sent automatically via cookie).
4. **Logout** clears the refresh token from the database and removes the cookie.

### Registration Flow

```
Sign up → Email verification link → Account approved → Login
```

New users start with `pending` status until they verify their email.

## User Roles

| Role | Permissions |
|------|-------------|
| **user** | Create/edit/delete own articles and comments |
| **admin** | Full access — manage all users, articles, and comments |

## Roadmap

The following features are **planned** and will be implemented incrementally:

- [ ] Automated testing (unit & integration)
- [ ] CI/CD pipeline (GitHub Actions)
- [ ] Response caching (Redis)
- [ ] Load balancing
- [ ] MongoDB replication
- [ ] Security hardening (`helmet`, stricter CORS)

> Swagger descriptions may reference some of these planned capabilities. The README and this roadmap reflect the **current** state of the project honestly.

## Author

**Md Ismile Hosen Siam**

- Email: ismile.20cse034@gstu.edu.bd

## License

ISC
