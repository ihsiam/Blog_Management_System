/**
 * Integration Testing — Phase 3
 * Article
 *
 * Verifies real Article components working together:
 * HTTP → authenticate/authorize/ownership → route → controller →
 * article service / service registry → MongoDB (in-memory) → response.
 *
 * Nested `/articles/:id/comments` endpoints are deferred to Comment phase.
 * Auth is real (Phase 2 helpers: seedUser + issueSession + JWT).
 * Article service and database are NOT mocked.
 */

const request = require("supertest");
const mongoose = require("mongoose");

const app = require("../../src/app");
const Article = require("../../src/model/Article");
const Category = require("../../src/model/Category");
const db = require("./helpers/db");
const { expiredAccessToken } = require("./helpers/auth");
const { createAuthedUser, seedArticle } = require("./helpers/article");
const { createArticleContext, seedComment } = require("./helpers/comment");

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

const expectBadRequest = (res, field, location = "body") => {
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

// ─── Create ──────────────────────────────────────────────────────────────────
describe("POST /api/v1/articles", () => {
  it("should let an authenticated user create a published article persisted with their author id", async () => {
    const { user, accessToken } = await createAuthedUser();

    const res = await request(app)
      .post("/api/v1/articles")
      .set(authHeader(accessToken))
      .field("title", "My First Post")
      .field("body", "Hello world")
      .field(
        "category",
        String((await Category.create({ name: "Create Category" })).id),
      )
      .attach("cover", Buffer.from("cover"), "cover.png");

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      code: 201,
      message: "Article created",
      data: {
        title: "My First Post",
        body: "Hello world",
        cover: expect.any(String),
        status: "published",
      },
      links: { self: expect.stringMatching(/^\/api\/v1\/articles\//) },
    });
    expect(String(res.body.data.author.id)).toBe(String(user.id));

    const stored = await Article.findById(res.body.data.id);
    expect(stored).not.toBeNull();
    expect(stored.title).toBe("My First Post");
    expect(String(stored.author_id)).toBe(String(user.id));
    expect(stored.status).toBe("published");
  });

  it("should apply default body/cover and always use published status on create", async () => {
    const { accessToken } = await createAuthedUser();

    const res = await request(app)
      .post("/api/v1/articles")
      .set(authHeader(accessToken))
      .field("title", "Defaults Only")
      .field("body", "Default body")
      .field(
        "category",
        String((await Category.create({ name: "Default Category" })).id),
      )
      .attach("cover", Buffer.from("cover"), "cover.png");

    expect(res.status).toBe(201);
    expect(res.body.data.body).toBe("Default body");
    expect(res.body.data.cover).toEqual(expect.any(String));
    expect(res.body.data.status).toBe("published");
  });

  it("should allow an admin to create an article", async () => {
    const { user, accessToken } = await createAuthedUser({ role: "admin" });

    const res = await request(app)
      .post("/api/v1/articles")
      .set(authHeader(accessToken))
      .field("title", "Admin Post")
      .field("body", "Admin body")
      .field(
        "category",
        String((await Category.create({ name: "Admin Category" })).id),
      )
      .attach("cover", Buffer.from("cover"), "cover.png");

    expect(res.status).toBe(201);
    expect(String(res.body.data.author.id)).toBe(String(user.id));
  });

  it("should reject unauthenticated create requests", async () => {
    const res = await request(app)
      .post("/api/v1/articles")
      .send({ title: "Nope" });

    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Authorization token missing");
    expect(await Article.countDocuments()).toBe(0);
  });

  it("should reject an invalid access token", async () => {
    const res = await request(app)
      .post("/api/v1/articles")
      .set(authHeader("not.a.valid.token"))
      .send({ title: "Nope" });

    expect(res.status).toBe(401);
    expect(await Article.countDocuments()).toBe(0);
  });

  it("should reject an expired access token", async () => {
    const { user } = await createAuthedUser();
    const token = expiredAccessToken({
      id: user.id,
      role: user.role,
      email: user.email,
    });

    const res = await request(app)
      .post("/api/v1/articles")
      .set(authHeader(token))
      .send({ title: "Nope" });

    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Access token expired");
  });

  it("should reject missing/blank title with the validation contract", async () => {
    const { accessToken } = await createAuthedUser();

    const missing = await request(app)
      .post("/api/v1/articles")
      .set(authHeader(accessToken))
      .send({});
    expectBadRequest(missing, "title", "body");
    expect(missing.body.message).toBe("invalid input");

    const blank = await request(app)
      .post("/api/v1/articles")
      .set(authHeader(accessToken))
      .send({ title: "   " });
    expectBadRequest(blank, "title", "body");

    expect(await Article.countDocuments()).toBe(0);
  });
});

// ─── Public list ─────────────────────────────────────────────────────────────
describe("GET /api/v1/articles", () => {
  it("should list only published articles with pagination metadata", async () => {
    const { user } = await createAuthedUser();
    await seedArticle({
      author: user.id,
      title: "Published A",
      status: "published",
    });
    await seedArticle({
      author: user.id,
      title: "Published B",
      status: "published",
    });
    await seedArticle({
      author: user.id,
      title: "Hidden Draft",
      status: "draft",
    });

    const res = await request(app).get("/api/v1/articles");

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      code: 200,
      message: "Data retrieved",
    });
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data.every((a) => a.title !== "Hidden Draft")).toBe(true);
    expect(res.body.data[0]).toEqual(
      expect.objectContaining({
        id: expect.anything(),
        title: expect.any(String),
        link: expect.stringMatching(/^\/api\/v1\/articles\//),
      }),
    );
    expect(res.body.data[0].status).toBeUndefined();
    expect(res.body.pagination).toMatchObject({
      page: 1,
      limit: 10,
      totalItems: 2,
    });
  });

  it("should support search and pagination query params", async () => {
    const { user } = await createAuthedUser();
    await seedArticle({ author: user.id, title: "Alpha Unique" });
    await seedArticle({ author: user.id, title: "Beta Unique" });
    await seedArticle({ author: user.id, title: "Gamma Other" });

    const search = await request(app).get("/api/v1/articles").query({
      search: "Unique",
    });
    expect(search.status).toBe(200);
    expect(search.body.data).toHaveLength(2);
    expect(search.body.pagination.totalItems).toBe(2);

    const page1 = await request(app).get("/api/v1/articles").query({
      limit: 1,
      page: 1,
      sortBy: "title",
      sortType: "asc",
    });
    expect(page1.status).toBe(200);
    expect(page1.body.data).toHaveLength(1);
    expect(page1.body.pagination).toMatchObject({
      page: 1,
      limit: 1,
      totalItems: 3,
      totalPage: 3,
      next: 2,
    });
  });

  it("should reject invalid list query parameters", async () => {
    const res = await request(app).get("/api/v1/articles").query({
      page: 0,
      limit: -1,
      sortType: "sideways",
      sortBy: "body",
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("invalid input");
    expect(res.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "page", in: "query" }),
        expect.objectContaining({ field: "limit", in: "query" }),
        expect.objectContaining({ field: "sort_type", in: "query" }),
        expect.objectContaining({ field: "sort_by", in: "query" }),
      ]),
    );
  });
});

// ─── Admin list ──────────────────────────────────────────────────────────────
describe("GET /api/v1/articles/admin/all", () => {
  it("should let an admin list published and draft articles and filter by status", async () => {
    const { user: author } = await createAuthedUser();
    const { accessToken: adminToken } = await createAuthedUser({
      role: "admin",
      name: "Admin",
    });

    await seedArticle({ author: author.id, title: "Pub", status: "published" });
    await seedArticle({ author: author.id, title: "Drf", status: "draft" });

    const all = await request(app)
      .get("/api/v1/articles/admin/all")
      .set(authHeader(adminToken));

    expect(all.status).toBe(200);
    expect(all.body.data).toHaveLength(2);
    expect(all.body.data.some((a) => a.status === "draft")).toBe(true);

    const drafts = await request(app)
      .get("/api/v1/articles/admin/all")
      .query({ status: "draft" })
      .set(authHeader(adminToken));

    expect(drafts.status).toBe(200);
    expect(drafts.body.data).toHaveLength(1);
    expect(drafts.body.data[0].title).toBe("Drf");
    expect(drafts.body.data[0].status).toBe("draft");
  });

  it("should forbid a regular user from the admin article list", async () => {
    const { accessToken } = await createAuthedUser();

    const res = await request(app)
      .get("/api/v1/articles/admin/all")
      .set(authHeader(accessToken));

    expect(res.status).toBe(403);
    expect(res.body.message).toBe(
      "You are not allowed to access this resource",
    );
  });

  it("should reject unauthenticated admin-list requests", async () => {
    const res = await request(app).get("/api/v1/articles/admin/all");
    expect(res.status).toBe(401);
  });

  it("should reject an invalid status filter", async () => {
    const { accessToken } = await createAuthedUser({ role: "admin" });

    const res = await request(app)
      .get("/api/v1/articles/admin/all")
      .query({ status: "archived" })
      .set(authHeader(accessToken));

    expectBadRequest(res, "status", "query");
  });
});

// ─── Get single ──────────────────────────────────────────────────────────────
describe("GET /api/v1/articles/:id", () => {
  it("should retrieve a published article and hide status from the payload", async () => {
    const { user } = await createAuthedUser();
    const article = await seedArticle({
      author: user.id,
      title: "Visible",
      body: "Content",
      status: "published",
    });

    const res = await request(app).get(`/api/v1/articles/${article.id}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      code: 200,
      message: "Data retrieved",
      data: {
        id: String(article.id),
        title: "Visible",
        body: "Content",
      },
      links: {
        self: `/api/v1/articles/${article.id}`,
        author: `/api/v1/articles/${article.id}/author`,
        comments: `/api/v1/articles/${article.id}/comments`,
      },
    });
    expect(res.body.data.status).toBeUndefined();
  });

  it("should return 404 for a draft article (public visibility rule)", async () => {
    const { user } = await createAuthedUser();
    const draft = await seedArticle({
      author: user.id,
      title: "Secret Draft",
      status: "draft",
    });

    const res = await request(app).get(`/api/v1/articles/${draft.id}`);

    expect(res.status).toBe(404);
    expect(res.body.message).toBe("Article not found");
  });

  it("should return 404 for a nonexistent article", async () => {
    const id = new mongoose.Types.ObjectId().toString();
    const res = await request(app).get(`/api/v1/articles/${id}`);

    expect(res.status).toBe(404);
    expect(res.body.message).toBe("Article not found");
  });

  it("should reject an invalid article id", async () => {
    const res = await request(app).get("/api/v1/articles/not-an-id");
    expectBadRequest(res, "id", "params");
  });
});

// ─── Article author ──────────────────────────────────────────────────────────
describe("GET /api/v1/articles/:id/author", () => {
  it("should return the author of a published article", async () => {
    const { user } = await createAuthedUser({
      name: "Byline",
      email: "byline@example.com",
    });
    const article = await seedArticle({ author: user.id, title: "Story" });

    const res = await request(app).get(`/api/v1/articles/${article.id}/author`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      code: 200,
      message: "Data retrieved",
      data: {
        id: String(user.id),
        name: "Byline",
      },
      links: {
        self: `/api/v1/articles/${article.id}/author`,
        article: `/api/v1/articles/${article.id}`,
      },
    });
  });

  it("should not expose the author of a draft via the public author endpoint", async () => {
    const { user } = await createAuthedUser();
    const draft = await seedArticle({
      author: user.id,
      title: "Draft Story",
      status: "draft",
    });

    const res = await request(app).get(`/api/v1/articles/${draft.id}/author`);

    expect(res.status).toBe(404);
  });

  it("should reject an invalid article id", async () => {
    const res = await request(app).get("/api/v1/articles/bad-id/author");
    expectBadRequest(res, "id", "params");
  });
});

// ─── PATCH partial update / status ───────────────────────────────────────────
describe("PATCH /api/v1/articles/:id", () => {
  it("should let the owner patch title/body/cover", async () => {
    const { user, accessToken } = await createAuthedUser();
    const article = await seedArticle({
      author: user.id,
      title: "Patch Me",
      body: "Before",
    });

    const res = await request(app)
      .patch(`/api/v1/articles/${article.id}`)
      .set(authHeader(accessToken))
      .field("title", "Patched")
      .field("body", "After")
      .attach("cover", Buffer.from("updated-cover"), "c.png");

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Successfully updated article data");
    expect(res.body.data).toMatchObject({
      title: "Patched",
      body: "After",
      cover: expect.any(String),
    });

    const stored = await Article.findById(article.id);
    expect(stored.title).toBe("Patched");
  });

  it("should ignore status changes from a regular user (owner)", async () => {
    const { user, accessToken } = await createAuthedUser();
    const article = await seedArticle({
      author: user.id,
      title: "Stay Published",
      status: "published",
    });

    const res = await request(app)
      .patch(`/api/v1/articles/${article.id}`)
      .set(authHeader(accessToken))
      .send({ status: "draft", title: "Still Mine" });

    expect(res.status).toBe(400);
    const stored = await Article.findById(article.id);
    expect(stored.status).toBe("published");
    expect(stored.title).toBe("Stay Published");
  });

  it("should let an admin owner change article status", async () => {
    const { user, accessToken } = await createAuthedUser({ role: "admin" });
    const article = await seedArticle({
      author: user.id,
      title: "Admin Owned",
      status: "published",
    });

    const res = await request(app)
      .patch(`/api/v1/articles/${article.id}/status`)
      .set(authHeader(accessToken))
      .send({ status: "draft" });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Successfully updated article status");

    const stored = await Article.findById(article.id);
    expect(stored.status).toBe("draft");
  });

  it("should let an admin non-owner change only status (adminOverride)", async () => {
    const { user: owner } = await createAuthedUser();
    const { accessToken: adminToken } = await createAuthedUser({
      role: "admin",
    });
    const article = await seedArticle({
      author: owner.id,
      title: "Do Not Edit Content",
      body: "Original",
      status: "published",
    });

    const res = await request(app)
      .patch(`/api/v1/articles/${article.id}/status`)
      .set(authHeader(adminToken))
      .send({ status: "draft", title: "Should Be Ignored", body: "Ignored" });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Successfully updated article status");

    const stored = await Article.findById(article.id);
    expect(stored.status).toBe("draft");
    expect(stored.title).toBe("Do Not Edit Content");
    expect(stored.body).toBe("Original");
  });

  it("should require status when an admin uses ownership override", async () => {
    const { user: owner } = await createAuthedUser();
    const { accessToken: adminToken } = await createAuthedUser({
      role: "admin",
    });
    const article = await seedArticle({
      author: owner.id,
      title: "Needs Status",
    });

    const res = await request(app)
      .patch(`/api/v1/articles/${article.id}/status`)
      .set(authHeader(adminToken))
      .send({ title: "Only Title" });

    expectBadRequest(res, "status", "body");
    const stored = await Article.findById(article.id);
    expect(stored.title).toBe("Needs Status");
  });

  it("should forbid a non-owner regular user from patching", async () => {
    const { user: owner } = await createAuthedUser();
    const { accessToken: otherToken } = await createAuthedUser();
    const article = await seedArticle({
      author: owner.id,
      title: "Protected",
    });

    const res = await request(app)
      .patch(`/api/v1/articles/${article.id}`)
      .set(authHeader(otherToken))
      .send({ title: "Stolen" });

    expect(res.status).toBe(403);
    const stored = await Article.findById(article.id);
    expect(stored.title).toBe("Protected");
  });

  it("should return 404 when patching a nonexistent article", async () => {
    const { accessToken } = await createAuthedUser();
    const id = new mongoose.Types.ObjectId().toString();

    const res = await request(app)
      .patch(`/api/v1/articles/${id}`)
      .set(authHeader(accessToken))
      .send({ title: "Ghost" });

    expect(res.status).toBe(404);
  });

  it("should reject unauthenticated and invalid-id patch requests", async () => {
    const id = new mongoose.Types.ObjectId().toString();

    const unauth = await request(app)
      .patch(`/api/v1/articles/${id}`)
      .send({ title: "X" });
    expect(unauth.status).toBe(401);

    const { accessToken } = await createAuthedUser();
    const badId = await request(app)
      .patch("/api/v1/articles/bad-id")
      .set(authHeader(accessToken))
      .send({ title: "X" });
    expectBadRequest(badId, "id", "params");
  });
});

// ─── Delete ──────────────────────────────────────────────────────────────────
describe("DELETE /api/v1/articles/:id", () => {
  it("should let the owner delete their article", async () => {
    const { user, accessToken } = await createAuthedUser();
    const article = await seedArticle({ author: user.id, title: "Delete Me" });

    const res = await request(app)
      .delete(`/api/v1/articles/${article.id}`)
      .set(authHeader(accessToken));

    expect(res.status).toBe(204);
    expect(await Article.findById(article.id)).toBeNull();

    const getRes = await request(app).get(`/api/v1/articles/${article.id}`);
    expect(getRes.status).toBe(404);
  });

  it("should forbid a non-owner from deleting and leave the article intact", async () => {
    const { user: owner } = await createAuthedUser();
    const { accessToken: otherToken } = await createAuthedUser();
    const article = await seedArticle({ author: owner.id, title: "Stay" });

    const res = await request(app)
      .delete(`/api/v1/articles/${article.id}`)
      .set(authHeader(otherToken));

    expect(res.status).toBe(403);
    expect(await Article.findById(article.id)).not.toBeNull();
  });

  it("should let an admin delete another user's article", async () => {
    const { user: owner } = await createAuthedUser();
    const { accessToken: adminToken } = await createAuthedUser({
      role: "admin",
    });
    const article = await seedArticle({
      author: owner.id,
      title: "Admin Delete",
    });

    const res = await request(app)
      .delete(`/api/v1/articles/${article.id}`)
      .set(authHeader(adminToken));

    expect(res.status).toBe(204);
    expect(await Article.findById(article.id)).toBeNull();
  });

  it("should reject unauthenticated delete", async () => {
    const { user } = await createAuthedUser();
    const article = await seedArticle({ author: user.id, title: "Safe" });

    const res = await request(app).delete(`/api/v1/articles/${article.id}`);

    expect(res.status).toBe(401);
    expect(await Article.findById(article.id)).not.toBeNull();
  });

  it("should return 404 when deleting a nonexistent article", async () => {
    const { accessToken } = await createAuthedUser();
    const id = new mongoose.Types.ObjectId().toString();

    const res = await request(app)
      .delete(`/api/v1/articles/${id}`)
      .set(authHeader(accessToken));

    expect(res.status).toBe(404);
  });

  it("should reject an invalid delete id", async () => {
    const { accessToken } = await createAuthedUser();

    const res = await request(app)
      .delete("/api/v1/articles/not-valid")
      .set(authHeader(accessToken));

    expectBadRequest(res, "id", "params");
  });
});

describe("POST /api/v1/articles/:articleId/comments/:commentId/replies", () => {
  it("allows an authenticated user to reply to a comment", async () => {
    const { user, accessToken, article } = await createArticleContext();
    const parent = await seedComment({
      article: article.id,
      author: user.id,
      body: "Parent comment",
    });

    const res = await request(app)
      .post(`/api/v1/articles/${article.id}/comments/${parent.id}/replies`)
      .set(authHeader(accessToken))
      .send({ body: "A reply" });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      code: 201,
      message: "reply posted",
      data: { body: "A reply", parentCommentId: String(parent.id) },
      links: {
        self: `/api/v1/articles/${article.id}/comments/${parent.id}/replies`,
        article: `/api/v1/articles/${article.id}`,
      },
    });
  });

  it("requires authentication and validates article, comment, and body", async () => {
    const { user, article } = await createArticleContext();
    const parent = await seedComment({ article: article.id, author: user.id });

    const unauth = await request(app)
      .post(`/api/v1/articles/${article.id}/comments/${parent.id}/replies`)
      .send({ body: "No auth" });
    expect(unauth.status).toBe(401);

    const { accessToken } = await createAuthedUser();
    const invalid = await request(app)
      .post("/api/v1/articles/bad/comments/bad/replies")
      .set(authHeader(accessToken))
      .send({ body: " " });
    expect(invalid.status).toBe(400);
    expect(invalid.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "articleId", in: "params" }),
        expect.objectContaining({ field: "commentId", in: "params" }),
        expect.objectContaining({ field: "body", in: "body" }),
      ]),
    );
  });

  it("rejects a reply to a comment belonging to another article", async () => {
    const first = await createArticleContext();
    const second = await createArticleContext();
    const parent = await seedComment({
      article: first.article.id,
      author: first.user.id,
    });

    const res = await request(app)
      .post(
        `/api/v1/articles/${second.article.id}/comments/${parent.id}/replies`,
      )
      .set(authHeader(second.accessToken))
      .send({ body: "Wrong article" });

    expect(res.status).toBe(404);
    expect(res.body.message).toBe("Comment not found");
  });
});

// ─── Status / visibility edge cases ──────────────────────────────────────────
describe("Article status and visibility rules", () => {
  it("should hide a draft from public list and single-get after admin status change", async () => {
    const { user: owner } = await createAuthedUser();
    const { accessToken: adminToken } = await createAuthedUser({
      role: "admin",
    });
    const article = await seedArticle({
      author: owner.id,
      title: "Will Be Draft",
      status: "published",
    });

    await request(app)
      .patch(`/api/v1/articles/${article.id}/status`)
      .set(authHeader(adminToken))
      .send({ status: "draft" });

    const list = await request(app).get("/api/v1/articles");
    expect(list.body.data.every((a) => a.title !== "Will Be Draft")).toBe(true);

    const single = await request(app).get(`/api/v1/articles/${article.id}`);
    expect(single.status).toBe(404);

    const adminList = await request(app)
      .get("/api/v1/articles/admin/all")
      .query({ status: "draft" })
      .set(authHeader(adminToken));
    expect(
      adminList.body.data.some((a) => String(a.id) === String(article.id)),
    ).toBe(true);
  });

  it("should republish a draft via admin override so it becomes publicly visible again", async () => {
    const { user: owner } = await createAuthedUser();
    const { accessToken: adminToken } = await createAuthedUser({
      role: "admin",
    });
    const article = await seedArticle({
      author: owner.id,
      title: "Back Online",
      status: "draft",
    });

    const res = await request(app)
      .patch(`/api/v1/articles/${article.id}/status`)
      .set(authHeader(adminToken))
      .send({ status: "published" });

    expect(res.status).toBe(200);

    const single = await request(app).get(`/api/v1/articles/${article.id}`);
    expect(single.status).toBe(200);
    expect(single.body.data.title).toBe("Back Online");
  });
});

// ─── Database failure ────────────────────────────────────────────────────────
describe("Article routes when the database is unavailable", () => {
  it("should return 500 when listing articles cannot reach MongoDB", async () => {
    const uri = process.env.DB_URL;
    await mongoose.disconnect();

    const res = await request(app).get("/api/v1/articles");

    expect(res.status).toBe(500);
    expect(res.body).toMatchObject({
      code: 500,
      error: "Internal server error",
      message: "We are sorry for the inconvenience. Please try again later.",
    });

    await mongoose.connect(uri);
  });
});
