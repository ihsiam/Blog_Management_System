/**
 * Integration Testing — Phase 5 (final)
 * User + remaining module coverage
 *
 * Domain modules in this codebase: Auth, Article, Comment, User.
 * Auth/Article/Comment integration suites already exist. This file
 * covers User HTTP flows and cross-module cascade delete
 * (User → Articles → Comments via service registry).
 *
 * Supporting libs (email, token, hashing) are exercised through Auth
 * and are not separate HTTP modules.
 *
 * Auth is real. User service and database are NOT mocked.
 */

const request = require("supertest");
const mongoose = require("mongoose");

const app = require("../../src/app");
const User = require("../../src/model/User");
const Article = require("../../src/model/Article");
const Comment = require("../../src/model/Comment");
const { hashing } = require("../../src/utils");
const db = require("./helpers/db");
const { expiredAccessToken } = require("./helpers/auth");
const {
  createAuthedUser,
  seedArticle,
  seedComment,
  seedUser,
  issueSession,
} = require("./helpers/user");

beforeAll(async () => {
  await db.connect();
});

afterEach(async () => {
  await db.clearCollections();
});

afterAll(async () => {
  await db.disconnect();
});

beforeEach(() => {
  jest.spyOn(console, "log").mockImplementation(() => {});
  jest.spyOn(console, "error").mockImplementation(() => {});
  jest.spyOn(console, "warn").mockImplementation(() => {});
});

const authHeader = (token) => ({ Authorization: `Bearer ${token}` });

const expectBadRequest = (res, field, location) => {
  expect(res.status).toBe(400);
  expect(res.body).toMatchObject({
    code: 400,
    error: "Bad request",
  });
  expect(Array.isArray(res.body.data)).toBe(true);
  if (field) {
    expect(
      res.body.data.some((e) => e.field === field && e.in === location),
    ).toBe(true);
  }
};

// ─── GET /api/v1/users (admin) ───────────────────────────────────────────────
describe("GET /api/v1/users", () => {
  it("should let an admin list users with pagination and filters", async () => {
    await seedUser({
      name: "Alice AdminTarget",
      email: "alice@example.com",
      password: "password123",
      status: "approved",
    });
    await seedUser({
      name: "Bob Pending",
      email: "bob@example.com",
      password: "password123",
      status: "pending",
    });
    const { accessToken: adminToken } = await createAuthedUser({
      role: "admin",
      name: "Root",
    });

    const all = await request(app)
      .get("/api/v1/users")
      .set(authHeader(adminToken));

    expect(all.status).toBe(200);
    expect(all.body).toMatchObject({
      code: 200,
      message: "Data retrieved",
    });
    expect(all.body.data.length).toBeGreaterThanOrEqual(3);
    expect(all.body.data[0]).toEqual(
      expect.objectContaining({
        id: expect.anything(),
        name: expect.any(String),
        email: expect.any(String),
        role: expect.any(String),
        status: expect.any(String),
      }),
    );
    expect(all.body.data[0].password).toBeUndefined();
    expect(all.body.pagination.totalItems).toBeGreaterThanOrEqual(3);

    const pending = await request(app)
      .get("/api/v1/users")
      .query({ status: "pending" })
      .set(authHeader(adminToken));
    expect(pending.status).toBe(200);
    expect(pending.body.data.every((u) => u.status === "pending")).toBe(true);

    const byName = await request(app)
      .get("/api/v1/users")
      .query({ name: "Alice" })
      .set(authHeader(adminToken));
    expect(byName.body.data.some((u) => u.email === "alice@example.com")).toBe(
      true,
    );
  });

  it("should forbid a regular user and reject unauthenticated/invalid queries", async () => {
    const { accessToken } = await createAuthedUser();

    const forbidden = await request(app)
      .get("/api/v1/users")
      .set(authHeader(accessToken));
    expect(forbidden.status).toBe(403);

    const unauth = await request(app).get("/api/v1/users");
    expect(unauth.status).toBe(401);

    const { accessToken: adminToken } = await createAuthedUser({
      role: "admin",
    });
    const bad = await request(app)
      .get("/api/v1/users")
      .query({
        page: 0,
        limit: -1,
        sortType: "nope",
        sortBy: "password",
        status: "archived",
      })
      .set(authHeader(adminToken));
    expect(bad.status).toBe(400);
    expect(bad.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "page", in: "query" }),
        expect.objectContaining({ field: "limit", in: "query" }),
        expect.objectContaining({ field: "sort_type", in: "query" }),
        expect.objectContaining({ field: "sort_by", in: "query" }),
        expect.objectContaining({ field: "status", in: "query" }),
      ]),
    );
  });
});

// ─── POST /api/v1/users (admin create) ───────────────────────────────────────
describe("POST /api/v1/users", () => {
  it("should let an admin create an approved user with a hashed password", async () => {
    const { accessToken } = await createAuthedUser({ role: "admin" });

    const res = await request(app)
      .post("/api/v1/users")
      .set(authHeader(accessToken))
      .send({
        name: "New User",
        email: "newuser@example.com",
        password: "password123",
      });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      code: 201,
      message: "Account created",
      data: {
        name: "New User",
        email: "newuser@example.com",
        status: "approved",
        role: "user",
      },
    });
    expect(res.body.data.password).toBeUndefined();
    expect(res.body.data.refreshToken).toBeUndefined();

    const stored = await User.findOne({ email: "newuser@example.com" });
    expect(stored).not.toBeNull();
    expect(stored.status).toBe("approved");
    expect(stored.password).not.toBe("password123");
    expect(await hashing.compareHash("password123", stored.password)).toBe(
      true,
    );
  });

  it("should reject duplicate email and invalid payloads", async () => {
    const { accessToken } = await createAuthedUser({ role: "admin" });
    await seedUser({
      email: "dup@example.com",
      password: "password123",
    });

    const dup = await request(app)
      .post("/api/v1/users")
      .set(authHeader(accessToken))
      .send({
        name: "Dup",
        email: "dup@example.com",
        password: "password123",
      });
    expect(dup.status).toBe(400);
    expect(dup.body.data).toEqual([
      { field: "email", message: "User already exists", in: "body" },
    ]);

    const invalid = await request(app)
      .post("/api/v1/users")
      .set(authHeader(accessToken))
      .send({ name: " ", email: "bad", password: "short" });
    expect(invalid.status).toBe(400);
    expect(invalid.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "name", in: "body" }),
        expect.objectContaining({ field: "email", in: "body" }),
        expect.objectContaining({ field: "password", in: "body" }),
      ]),
    );
  });

  it("should forbid non-admin create and reject missing auth", async () => {
    const { accessToken } = await createAuthedUser();

    const forbidden = await request(app)
      .post("/api/v1/users")
      .set(authHeader(accessToken))
      .send({
        name: "Nope",
        email: "nope@example.com",
        password: "password123",
      });
    expect(forbidden.status).toBe(403);
    expect(await User.countDocuments({ email: "nope@example.com" })).toBe(0);

    const unauth = await request(app).post("/api/v1/users").send({
      name: "Nope",
      email: "nope2@example.com",
      password: "password123",
    });
    expect(unauth.status).toBe(401);
  });
});

// ─── GET /api/v1/users/:id ───────────────────────────────────────────────────
describe("GET /api/v1/users/:id", () => {
  it("should let a user retrieve their own profile", async () => {
    const { user, accessToken } = await createAuthedUser({
      name: "Self",
      email: "self@example.com",
    });

    const res = await request(app)
      .get(`/api/v1/users/${user.id}`)
      .set(authHeader(accessToken));

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      code: 200,
      message: "Data retrieved",
      data: {
        id: String(user.id),
        name: "Self",
        email: "self@example.com",
        role: "user",
        status: "approved",
      },
    });
    expect(res.body.data.password).toBeUndefined();
    expect(res.body.data.refreshToken).toBeUndefined();
  });

  it("should let an admin retrieve another user's profile", async () => {
    const target = await seedUser({
      name: "Target",
      email: "target@example.com",
      password: "password123",
    });
    const { accessToken: adminToken } = await createAuthedUser({
      role: "admin",
    });

    const res = await request(app)
      .get(`/api/v1/users/${target.id}`)
      .set(authHeader(adminToken));

    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe("target@example.com");
  });

  it("should forbid a regular user from viewing another user's profile", async () => {
    const other = await seedUser({
      email: "other@example.com",
      password: "password123",
    });
    const { accessToken } = await createAuthedUser();

    const res = await request(app)
      .get(`/api/v1/users/${other.id}`)
      .set(authHeader(accessToken));

    expect(res.status).toBe(403);
    expect(res.body.message).toBe(
      "You do not have permission to access this user",
    );
  });

  it("should expand articles and comments when requested", async () => {
    const { user, accessToken } = await createAuthedUser({ name: "Author" });
    const article = await seedArticle({
      author: user.id,
      title: "My Post",
    });
    await seedComment({
      article: article.id,
      author: user.id,
      body: "My note",
    });

    const res = await request(app)
      .get(`/api/v1/users/${user.id}`)
      .query({ expand: "articles,comments" })
      .set(authHeader(accessToken));

    expect(res.status).toBe(200);
    expect(res.body.data.articles).toEqual(
      expect.arrayContaining([expect.objectContaining({ title: "My Post" })]),
    );
    expect(res.body.data.comments).toEqual(
      expect.arrayContaining([expect.objectContaining({ body: "My note" })]),
    );
  });

  it("should reject unauthenticated, expired token, invalid id, and missing user", async () => {
    const { user } = await createAuthedUser();

    const unauth = await request(app).get(`/api/v1/users/${user.id}`);
    expect(unauth.status).toBe(401);

    const expired = expiredAccessToken({
      id: user.id,
      role: user.role,
      email: user.email,
    });
    // session still exists, but token is expired
    const expiredRes = await request(app)
      .get(`/api/v1/users/${user.id}`)
      .set(authHeader(expired));
    expect(expiredRes.status).toBe(401);
    expect(expiredRes.body.message).toBe("Access token expired");

    const { accessToken } = await createAuthedUser({ role: "admin" });
    const badId = await request(app)
      .get("/api/v1/users/not-an-id")
      .set(authHeader(accessToken));
    expectBadRequest(badId, "id", "params");

    const missing = await request(app)
      .get(`/api/v1/users/${new mongoose.Types.ObjectId().toString()}`)
      .set(authHeader(accessToken));
    expect(missing.status).toBe(404);
  });
});

// ─── PATCH /api/v1/users/:id (admin) ─────────────────────────────────────────
describe("PATCH /api/v1/users/:id", () => {
  it("should let an admin update name, role, and status", async () => {
    const target = await seedUser({
      name: "Before",
      email: "update-me@example.com",
      password: "password123",
      role: "user",
      status: "approved",
    });
    const { accessToken } = await createAuthedUser({ role: "admin" });

    const res = await request(app)
      .patch(`/api/v1/users/${target.id}`)
      .set(authHeader(accessToken))
      .send({ name: "After", role: "admin", status: "blocked" });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      code: 200,
      message: "Account updated",
      data: {
        name: "After",
        role: "admin",
        status: "blocked",
      },
    });

    const stored = await User.findById(target.id);
    expect(stored.name).toBe("After");
    expect(stored.role).toBe("admin");
    expect(stored.status).toBe("blocked");
  });

  it("should forbid regular users from updating accounts", async () => {
    const { user, accessToken } = await createAuthedUser({ name: "Self" });

    const res = await request(app)
      .patch(`/api/v1/users/${user.id}`)
      .set(authHeader(accessToken))
      .send({ name: "Hacked" });

    expect(res.status).toBe(403);
    const stored = await User.findById(user.id);
    expect(stored.name).toBe("Self");
  });

  it("should reject invalid update values and missing users", async () => {
    const { accessToken } = await createAuthedUser({ role: "admin" });
    const target = await seedUser({
      email: "valid-target@example.com",
      password: "password123",
    });

    const invalid = await request(app)
      .patch(`/api/v1/users/${target.id}`)
      .set(authHeader(accessToken))
      .send({ name: " ", role: "super", status: "archived" });
    expect(invalid.status).toBe(400);
    expect(invalid.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "name", in: "body" }),
        expect.objectContaining({ field: "role", in: "body" }),
        expect.objectContaining({ field: "status", in: "body" }),
      ]),
    );

    const badId = await request(app)
      .patch("/api/v1/users/bad-id")
      .set(authHeader(accessToken))
      .send({ name: "X" });
    expectBadRequest(badId, "id", "params");

    const missing = await request(app)
      .patch(`/api/v1/users/${new mongoose.Types.ObjectId().toString()}`)
      .set(authHeader(accessToken))
      .send({ name: "Ghost" });
    expect(missing.status).toBe(404);

    const unauth = await request(app)
      .patch(`/api/v1/users/${target.id}`)
      .send({ name: "X" });
    expect(unauth.status).toBe(401);
  });
});

// ─── PATCH /api/v1/users/:id/change-password ─────────────────────────────────
describe("PATCH /api/v1/users/:id/change-password", () => {
  it("should let the owner change password and allow login with the new password", async () => {
    const { user, accessToken } = await createAuthedUser({
      email: "pwd@example.com",
      password: "old-password",
    });

    const res = await request(app)
      .patch(`/api/v1/users/${user.id}/change-password`)
      .set(authHeader(accessToken))
      .send({ oldPassword: "old-password", newPassword: "new-password" });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      code: 200,
      message: "Password updated successfully",
    });

    const stored = await User.findById(user.id);
    expect(await hashing.compareHash("new-password", stored.password)).toBe(
      true,
    );
    expect(await hashing.compareHash("old-password", stored.password)).toBe(
      false,
    );

    const oldLogin = await request(app)
      .post("/api/v1/auth/sign-in")
      .send({ email: "pwd@example.com", password: "old-password" });
    expect(oldLogin.status).toBe(401);

    const newLogin = await request(app)
      .post("/api/v1/auth/sign-in")
      .send({ email: "pwd@example.com", password: "new-password" });
    expect(newLogin.status).toBe(200);
  });

  it("should reject an incorrect old password without changing the hash", async () => {
    const { user, accessToken } = await createAuthedUser({
      password: "correct-password",
    });
    const before = (await User.findById(user.id)).password;

    const res = await request(app)
      .patch(`/api/v1/users/${user.id}/change-password`)
      .set(authHeader(accessToken))
      .send({ oldPassword: "wrong-password", newPassword: "new-password" });

    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Old password is incorrect");
    const after = (await User.findById(user.id)).password;
    expect(after).toBe(before);
  });

  it("should forbid another user (and a non-owning admin) from changing password", async () => {
    // ownership("user") without allowAdmin — admin cannot change others' passwords
    const target = await seedUser({
      email: "target-pwd@example.com",
      password: "password123",
    });
    await issueSession(target);

    const { accessToken: otherToken } = await createAuthedUser();
    const otherRes = await request(app)
      .patch(`/api/v1/users/${target.id}/change-password`)
      .set(authHeader(otherToken))
      .send({ oldPassword: "password123", newPassword: "hacked-password" });
    expect(otherRes.status).toBe(403);

    const { accessToken: adminToken } = await createAuthedUser({
      role: "admin",
    });
    const adminRes = await request(app)
      .patch(`/api/v1/users/${target.id}/change-password`)
      .set(authHeader(adminToken))
      .send({ oldPassword: "password123", newPassword: "hacked-password" });
    expect(adminRes.status).toBe(403);
    expect(adminRes.body.message).toBe(
      "You do not have permission to access this user",
    );

    const stored = await User.findById(target.id);
    expect(await hashing.compareHash("password123", stored.password)).toBe(
      true,
    );
  });

  it("should reject validation errors and unauthenticated requests", async () => {
    const { user, accessToken } = await createAuthedUser({
      password: "password123",
    });

    const invalid = await request(app)
      .patch(`/api/v1/users/${user.id}/change-password`)
      .set(authHeader(accessToken))
      .send({ oldPassword: "", newPassword: "short" });
    expect(invalid.status).toBe(400);
    expect(invalid.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "oldPassword", in: "body" }),
        expect.objectContaining({ field: "newPassword", in: "body" }),
      ]),
    );

    const unauth = await request(app)
      .patch(`/api/v1/users/${user.id}/change-password`)
      .send({ oldPassword: "password123", newPassword: "new-password" });
    expect(unauth.status).toBe(401);

    const badId = await request(app)
      .patch("/api/v1/users/bad-id/change-password")
      .set(authHeader(accessToken))
      .send({ oldPassword: "password123", newPassword: "new-password" });
    expectBadRequest(badId, "id", "params");
  });
});

// ─── DELETE /api/v1/users/:id (admin + cascade) ──────────────────────────────
describe("DELETE /api/v1/users/:id", () => {
  it("should let an admin delete a user and cascade articles/comments", async () => {
    const target = await seedUser({
      name: "Cascade User",
      email: "cascade@example.com",
      password: "password123",
    });
    const other = await seedUser({
      email: "survivor@example.com",
      password: "password123",
    });

    const article = await seedArticle({
      author: target.id,
      title: "Cascade Article",
    });
    const otherArticle = await seedArticle({
      author: other.id,
      title: "Keep Me",
    });

    // comment by target on own article + comment by other on target's article
    await seedComment({
      article: article.id,
      author: target.id,
      body: "Own comment",
    });
    await seedComment({
      article: article.id,
      author: other.id,
      body: "On doomed article",
    });
    await seedComment({
      article: otherArticle.id,
      author: target.id,
      body: "Target commented elsewhere",
    });
    await seedComment({
      article: otherArticle.id,
      author: other.id,
      body: "Survivor comment",
    });

    const { accessToken: adminToken } = await createAuthedUser({
      role: "admin",
    });

    const res = await request(app)
      .delete(`/api/v1/users/${target.id}`)
      .set(authHeader(adminToken));

    expect(res.status).toBe(204);
    expect(await User.findById(target.id)).toBeNull();
    expect(await Article.findById(article.id)).toBeNull();
    expect(await Article.findById(otherArticle.id)).not.toBeNull();
    expect(await Comment.countDocuments({ article: article.id })).toBe(0);
    expect(await Comment.countDocuments({ author: target.id })).toBe(0);
    expect(
      await Comment.countDocuments({
        article: otherArticle.id,
        author: other.id,
      }),
    ).toBe(1);
    expect(await User.findById(other.id)).not.toBeNull();
  });

  it("should forbid regular users from deleting accounts", async () => {
    const { user, accessToken } = await createAuthedUser();

    const res = await request(app)
      .delete(`/api/v1/users/${user.id}`)
      .set(authHeader(accessToken));

    expect(res.status).toBe(403);
    expect(await User.findById(user.id)).not.toBeNull();
  });

  it("should reject unauthenticated delete, invalid id, and missing user", async () => {
    const target = await seedUser({
      email: "del@example.com",
      password: "password123",
    });

    const unauth = await request(app).delete(`/api/v1/users/${target.id}`);
    expect(unauth.status).toBe(401);
    expect(await User.findById(target.id)).not.toBeNull();

    const { accessToken } = await createAuthedUser({ role: "admin" });
    const badId = await request(app)
      .delete("/api/v1/users/not-valid")
      .set(authHeader(accessToken));
    expectBadRequest(badId, "id", "params");

    const missing = await request(app)
      .delete(`/api/v1/users/${new mongoose.Types.ObjectId().toString()}`)
      .set(authHeader(accessToken));
    expect(missing.status).toBe(404);
  });
});

// ─── Database failure ────────────────────────────────────────────────────────
describe("User routes when the database is unavailable", () => {
  it("should return 500 when listing users cannot reach MongoDB", async () => {
    const { accessToken } = await createAuthedUser({ role: "admin" });
    const uri = process.env.DB_URL;
    await mongoose.disconnect();

    const res = await request(app)
      .get("/api/v1/users")
      .set(authHeader(accessToken));

    expect(res.status).toBe(500);
    expect(res.body).toMatchObject({
      code: 500,
      error: "Internal server error",
      message: "We are sorry for the inconvenience. Please try again later.",
    });

    await mongoose.connect(uri);
  });
});
