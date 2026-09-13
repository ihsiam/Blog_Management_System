# Blog Management System

A REST API for managing blog articles, comments, users, and authentication in a modular Node.js backend. The project uses Express, MongoDB, JWT-based auth, structured logging, and Docker-based infrastructure for local development.

## Overview

This repository contains a complete backend service for a blog platform. It supports:

- User registration and email verification
- JWT access and refresh token flows
- Role-based authorization for admin and user access
- Article CRUD with ownership checks
- Comment management on articles
- Admin user management
- Swagger/OpenAPI documentation
- Dockerized local stack with MongoDB replica set and Elasticsearch/Kibana

## Project Structure

```text
Blog Management System/
├── .github/                  # GitHub workflow or automation files
├── docs/                     # Project documents and design assets
├── mongo-init/               # MongoDB replica initialization script
├── server/                   # Application source code and runtime config
│   ├── coverage/             # Generated test coverage reports
│   ├── logs/                 # Winston log output files
│   ├── src/                  # Main application source
│   │   ├── api/v1/           # Route controllers by module
│   │   │   ├── article/
│   │   │   ├── authentication/
│   │   │   ├── comments/
│   │   │   └── user/
│   │   ├── config/           # Default app config values
│   │   ├── db/               # MongoDB connection logic
│   │   ├── lib/              # Business logic/services
│   │   │   ├── articles/
│   │   │   ├── authentication/
│   │   │   ├── comments/
│   │   │   ├── email/
│   │   │   ├── token/
│   │   │   └── user/
│   │   ├── middleware/       # Auth, authorization, ownership, logging
│   │   ├── model/            # Mongoose schemas and model definitions
│   │   ├── routes/           # API route registration
│   │   ├── utils/            # Shared helpers, logger, hashing, errors
│   │   ├── app.js            # Express app setup
│   │   ├── index.js          # Bootstraps the app and DB connection
│   │   └── ...
│   ├── test/                 # Unit and integration tests
│   │   ├── unit/
│   │   └── integration/
│   ├── default.env           # Template for environment variables
│   ├── dockerfile            # Server container definition
│   ├── jest.integration.config.js
│   ├── package.json          # Scripts and dependencies
│   ├── swagger.yaml          # OpenAPI definition
│   └── yarn.lock             # Dependency lock file
├── docker-compose.yml       # Full local stack orchestration
├── README.md                # Project documentation
└── .gitignore               # Git ignore rules
```

## Tech Stack

| Layer                | Technology                         |
| -------------------- | ---------------------------------- |
| Runtime              | Node.js                            |
| Framework            | Express.js                         |
| Database             | MongoDB with Mongoose              |
| Auth                 | JWT, bcryptjs                      |
| Email                | Nodemailer                         |
| Validation & Routing | Express middleware and controllers |
| Logging              | Winston, express-winston           |
| Search/Logs          | Elasticsearch + Kibana             |
| Docs                 | Swagger UI                         |
| Testing              | Jest + Supertest                   |
| Containerization     | Docker + Docker Compose            |
| Package Manager      | Yarn 4                             |

## Features

### Authentication

- User registration with email verification
- Login and logout with access/refresh token flow
- Password reset and email verification support
- Admin bootstrap endpoint for first-time setup
- Rate-limited auth endpoints
- Middleware-based JWT authentication and authorization

### Articles

- Create, read, update, and delete articles
- Public article listing and public single-item lookup
- Admin-only article listing including drafts
- Ownership checks for article modification and deletion
- Comment association on article routes

### Comments

- Add comments to articles
- Update and delete own comments
- Admin access for list and moderation operations

### Users

- Admin user management
- User profile retrieval with role-aware access
- Password change support
- Account management and relationship cleanup on delete

### Infrastructure

- Centralized error handling
- Correlation IDs for request tracing
- Daily rotating log files
- Optional Elasticsearch log aggregation
- Containerized MongoDB replica set setup
- Swagger endpoint for API exploration

## Prerequisites

Before starting the service, make sure you have:

- Node.js 18+ or newer
- Yarn 4+
- Docker and Docker Compose
- MongoDB (if running outside Docker)
- SMTP credentials for email-based flows

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

- API: http://localhost:4000
- Health check: http://localhost:4000/health
- Swagger docs: http://localhost:4000/docs
- MongoDB: localhost:27017, 27018, 27019
- Elasticsearch: http://localhost:9200
- Kibana: http://localhost:5601

### Option 2: Local Development

1. Install dependencies

```bash
cd server
yarn install
```

2. Create a local `.env` file based on `default.env`

3. Start MongoDB locally or use an available database connection

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

SALT_ROUNDS=

JWT_ACCESS_SECRET=
JWT_REFRESH_SECRET=
JWT_ACTIVE_RESET_SECRET=

JWT_ACCESS_EXPIRES=
JWT_REFRESH_EXPIRES=
JWT_ACTIVE_RESET_EXPIRES=

EMAIL_SERVICE=
EMAIL_USER=
EMAIL_PASSWORD=
```

Additional runtime settings used by Docker:

- `DB_URL` used by the app when running in compose
- `ELASTIC_URL` set to `http://elasticsearch:9200` in Docker

> Never commit real secrets to version control. Use secure values for JWT secrets and email credentials in production.

## API Overview

The API is grouped under `/api/v1` and uses JSON responses.

### Health and Docs

| Method | Endpoint  | Description              |
| ------ | --------- | ------------------------ |
| GET    | `/health` | Server health check      |
| GET    | `/docs`   | Swagger UI documentation |

### Authentication

| Method | Endpoint                             | Description                           |
| ------ | ------------------------------------ | ------------------------------------- |
| POST   | `/api/v1/auth/setup-admin`           | Create the initial admin user         |
| POST   | `/api/v1/auth/sign-up`               | Register a new user                   |
| GET    | `/api/v1/auth/verify-email/:token`   | Verify email address                  |
| POST   | `/api/v1/auth/resend-verification`   | Resend verification email             |
| POST   | `/api/v1/auth/sign-in`               | Sign in and receive tokens            |
| POST   | `/api/v1/auth/refresh`               | Refresh access token                  |
| POST   | `/api/v1/auth/logout`                | Logout the current authenticated user |
| POST   | `/api/v1/auth/forgot-password`       | Request password reset email          |
| PATCH  | `/api/v1/auth/reset-password/:token` | Reset password using token            |

### Articles

| Method | Endpoint                        | Description                  |
| ------ | ------------------------------- | ---------------------------- |
| GET    | `/api/v1/articles`              | List published articles      |
| POST   | `/api/v1/articles`              | Create article               |
| GET    | `/api/v1/articles/all`          | List all articles for admins |
| GET    | `/api/v1/articles/:id`          | Get a specific article       |
| PUT    | `/api/v1/articles/:id`          | Update or create article     |
| PATCH  | `/api/v1/articles/:id`          | Partially update article     |
| DELETE | `/api/v1/articles/:id`          | Delete article               |
| GET    | `/api/v1/articles/:id/author`   | Get article author           |
| GET    | `/api/v1/articles/:id/comments` | List comments on article     |
| POST   | `/api/v1/articles/:id/comments` | Add comment to article       |

### Comments

| Method | Endpoint               | Description                 |
| ------ | ---------------------- | --------------------------- |
| GET    | `/api/v1/comments`     | List comments (admin only)  |
| POST   | `/api/v1/comments`     | Create comment (admin only) |
| PATCH  | `/api/v1/comments/:id` | Update comment              |
| DELETE | `/api/v1/comments/:id` | Delete comment              |

### Users

| Method | Endpoint                            | Description              |
| ------ | ----------------------------------- | ------------------------ |
| GET    | `/api/v1/users`                     | List users (admin only)  |
| POST   | `/api/v1/users`                     | Create user (admin only) |
| GET    | `/api/v1/users/:id`                 | Get single user          |
| PATCH  | `/api/v1/users/:id`                 | Update user (admin only) |
| DELETE | `/api/v1/users/:id`                 | Delete user (admin only) |
| PATCH  | `/api/v1/users/:id/change-password` | Change password          |

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

- The root project orchestrates the full stack through Docker Compose.
- The backend server itself lives under the `server/` folder.
- The app uses MongoDB replica sets in Docker for multi-node local database setup.
- Elastic and Kibana are included for centralized log monitoring but are optional depending on the environment.

## Repository Status

This project is currently a backend-first blog management service, with the API server and supporting infrastructure in place for local development and deployment.

### Comments

| Method | Endpoint               | Description                     | Access       |
| ------ | ---------------------- | ------------------------------- | ------------ |
| GET    | `/api/v1/comments`     | List all comments (admin panel) | Admin        |
| POST   | `/api/v1/comments`     | Create a comment (admin)        | Admin        |
| PATCH  | `/api/v1/comments/:id` | Update a comment                | Owner, Admin |
| DELETE | `/api/v1/comments/:id` | Delete a comment                | Owner, Admin |

### Users

| Method | Endpoint                            | Description                      | Access       |
| ------ | ----------------------------------- | -------------------------------- | ------------ |
| GET    | `/api/v1/users`                     | List all users                   | Admin        |
| POST   | `/api/v1/users`                     | Create a user (auto-approved)    | Admin        |
| GET    | `/api/v1/users/:id`                 | Get a single user                | Owner, Admin |
| PATCH  | `/api/v1/users/:id`                 | Update user (name, role, status) | Admin        |
| DELETE | `/api/v1/users/:id`                 | Delete user and related data     | Admin        |
| PATCH  | `/api/v1/users/:id/change-password` | Change user password             | Owner, Admin |

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

| Role      | Permissions                                            |
| --------- | ------------------------------------------------------ |
| **user**  | Create/edit/delete own articles and comments           |
| **admin** | Full access — manage all users, articles, and comments |

## Roadmap

The following features are **planned** and will be implemented incrementally:

- [ ] Response caching (Redis)
- [ ] Load balancing
- [ ] Security hardening (`helmet`, stricter CORS)

> Swagger descriptions may reference some of these planned capabilities. The README and this roadmap reflect the **current** state of the project honestly.

## Author

**Md Ismile Hosen Siam**

- GitHub: [@ihsiam](https://github.com/ihsiam)
- Repository: [Blog_Management_System](https://github.com/ihsiam/Blog_Management_System)
- Email: ismile.20cse034@gstu.edu.bd

## License

ISC
