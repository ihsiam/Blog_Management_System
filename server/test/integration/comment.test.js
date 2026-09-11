/**
 * Integration Testing — Phase 4
 * Comment
 *
 * Verifies real Comment components working together:
 * HTTP → authenticate/authorize/ownership → route → controller →
 * comment service / service registry → Article business rules →
 * MongoDB (in-memory) → response.
 *
 * Auth and Article fixtures reuse Phase 2–3 helpers.
 * Comment service and database are NOT mocked.
 */

const request = require("supertest");
const mongoose = require("mongoose");

const app = require("../../src/app");
const Comment = require("../../src/model/Comment");
const db = require("./helpers/db");
const { expiredAccessToken } = require("./helpers/auth");
const {
  seedComment,
  createArticleContext,
  createAuthedUser,
  seedArticle,
} = require("./helpers/comment");

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

// ─── POST /api/v1/articles/:id/comments (user/admin) ─────────────────────────
describe("POST /api/v1/articles/:id/comments", () => {
  it("should let an authenticated user comment on a published article", async () => {
    const { article } = await createArticleContext();
    const { user: commenter, accessToken } = await createAuthedUser({
      name: "Commenter",
    });

    const res = await request(app)
      .post(`/api/v1/articles/${article.id}/comments`)
      .set(authHeader(accessToken))
      .send({ body: "Great article!" });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      code: 201,
      message: "comment posted",
      data: {
        body: "Great article!",
        status: "public",
      },
      links: {
        self: `/api/v1/articles/${article.id}/comments`,
        article: `/api/v1/articles/${article.id}`,
      },
    });
    expect(String(res.body.data.author)).toBe(String(commenter.id));
    expect(String(res.body.data.article)).toBe(String(article.id));

    const stored = await Comment.findById(res.body.data.id);
    expect(stored).not.toBeNull();
    expect(stored.body).toBe("Great article!");
    expect(stored.status).toBe("public");
  });

  it("should allow an admin to comment on a published article", async () => {
    const { article } = await createArticleContext();
    const { accessToken } = await createAuthedUser({ role: "admin" });

    const res = await request(app)
      .post(`/api/v1/articles/${article.id}/comments`)
      .set(authHeader(accessToken))
      .send({ body: "Admin note" });

    expect(res.status).toBe(201);
    expect(await Comment.countDocuments()).toBe(1);
  });

  it("should reject commenting on a draft article and persist nothing", async () => {
    const { draft } = await createArticleContext({ withDraft: true });
    const { accessToken } = await createAuthedUser();

    const res = await request(app)
      .post(`/api/v1/articles/${draft.id}/comments`)
      .set(authHeader(accessToken))
      .send({ body: "Should fail" });

    // serviceRegistry → findSingleItem hides drafts as not found
    expect(res.status).toBe(404);
    expect(res.body.message).toBe("Article not found");
    expect(await Comment.countDocuments()).toBe(0);
  });

  it("should reject commenting on a nonexistent article", async () => {
    const { accessToken } = await createAuthedUser();
    const missingId = new mongoose.Types.ObjectId().toString();

    const res = await request(app)
      .post(`/api/v1/articles/${missingId}/comments`)
      .set(authHeader(accessToken))
      .send({ body: "Orphan?" });

    expect(res.status).toBe(404);
    expect(await Comment.countDocuments()).toBe(0);
  });

  it("should reject unauthenticated, invalid, and expired tokens", async () => {
    const { article, user } = await createArticleContext();

    const unauth = await request(app)
      .post(`/api/v1/articles/${article.id}/comments`)
      .send({ body: "Nope" });
    expect(unauth.status).toBe(401);
    expect(unauth.body.message).toBe("Authorization token missing");

    const invalid = await request(app)
      .post(`/api/v1/articles/${article.id}/comments`)
      .set(authHeader("not.a.valid.token"))
      .send({ body: "Nope" });
    expect(invalid.status).toBe(401);

    const expired = expiredAccessToken({
      id: user.id,
      role: user.role,
      email: user.email,
    });
    const expiredRes = await request(app)
      .post(`/api/v1/articles/${article.id}/comments`)
      .set(authHeader(expired))
      .send({ body: "Nope" });
    expect(expiredRes.status).toBe(401);
    expect(expiredRes.body.message).toBe("Access token expired");

    expect(await Comment.countDocuments()).toBe(0);
  });

  it("should reject missing body and invalid article id", async () => {
    const { article, accessToken } = await createArticleContext();

    const missingBody = await request(app)
      .post(`/api/v1/articles/${article.id}/comments`)
      .set(authHeader(accessToken))
      .send({});
    expectBadRequest(missingBody, "body", "body");

    const blank = await request(app)
      .post(`/api/v1/articles/${article.id}/comments`)
      .set(authHeader(accessToken))
      .send({ body: "   " });
    expectBadRequest(blank, "body", "body");

    const badId = await request(app)
      .post("/api/v1/articles/not-an-id/comments")
      .set(authHeader(accessToken))
      .send({ body: "Hi" });
    expectBadRequest(badId, "id", "params");

    expect(await Comment.countDocuments()).toBe(0);
  });
});

// ─── GET /api/v1/articles/:id/comments (public) ───────────────────────────────
describe("GET /api/v1/articles/:id/comments", () => {
  it("should list only public comments for a published article", async () => {
    const { user, article } = await createArticleContext();
    await seedComment({
      article: article.id,
      author: user.id,
      body: "Public one",
      status: "public",
    });
    await seedComment({
      article: article.id,
      author: user.id,
      body: "Hidden one",
      status: "hidden",
    });

    const res = await request(app).get(
      `/api/v1/articles/${article.id}/comments`,
    );

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      code: 200,
      message: "Data retrieved",
    });
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].body).toBe("Public one");
    expect(res.body.data[0].status).toBeUndefined();
    expect(res.body.pagination.totalItems).toBe(1);
    expect(res.body.links.article).toBe(`/api/v1/articles/${article.id}`);
  });

  it("should support pagination on article comments", async () => {
    const { user, article } = await createArticleContext();
    await seedComment({ article: article.id, author: user.id, body: "C1" });
    await seedComment({ article: article.id, author: user.id, body: "C2" });
    await seedComment({ article: article.id, author: user.id, body: "C3" });

    const res = await request(app)
      .get(`/api/v1/articles/${article.id}/comments`)
      .query({ page: 1, limit: 2 });

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.pagination).toMatchObject({
      page: 1,
      limit: 2,
      totalItems: 3,
      totalPage: 2,
      next: 2,
    });
  });

  it("should return 404 when listing comments for a draft article", async () => {
    const { draft } = await createArticleContext({ withDraft: true });

    const res = await request(app).get(`/api/v1/articles/${draft.id}/comments`);

    expect(res.status).toBe(404);
    expect(res.body.message).toBe("Article not found");
  });

  it("should return 404 for a nonexistent article", async () => {
    const id = new mongoose.Types.ObjectId().toString();
    const res = await request(app).get(`/api/v1/articles/${id}/comments`);
    expect(res.status).toBe(404);
  });

  it("should reject invalid article id and query params", async () => {
    const badId = await request(app).get("/api/v1/articles/bad-id/comments");
    expectBadRequest(badId, "id", "params");

    const { article } = await createArticleContext();
    const badQuery = await request(app)
      .get(`/api/v1/articles/${article.id}/comments`)
      .query({ page: 0, limit: -1 });
    expect(badQuery.status).toBe(400);
    expect(badQuery.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "page", in: "query" }),
        expect.objectContaining({ field: "limit", in: "query" }),
      ]),
    );
  });
});

// ─── Admin POST /api/v1/comments ─────────────────────────────────────────────
describe("POST /api/v1/comments (admin)", () => {
  it("should let an admin create a public comment on a published article", async () => {
    const { article } = await createArticleContext();
    const { user: admin, accessToken } = await createAuthedUser({
      role: "admin",
    });

    const res = await request(app)
      .post("/api/v1/comments")
      .set(authHeader(accessToken))
      .send({ body: "Moderated post", articleID: String(article.id) });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      code: 201,
      message: "comment posted",
      data: {
        body: "Moderated post",
        status: "public",
      },
      links: {
        self: expect.stringMatching(/^\/api\/v1\/comments\//),
      },
    });
    expect(String(res.body.data.author)).toBe(String(admin.id));
    expect(String(res.body.data.article)).toBe(String(article.id));
  });

  it("should forbid a regular user from the admin create endpoint", async () => {
    const { article, accessToken } = await createArticleContext();

    const res = await request(app)
      .post("/api/v1/comments")
      .set(authHeader(accessToken))
      .send({ body: "Nope", articleID: String(article.id) });

    expect(res.status).toBe(403);
    expect(await Comment.countDocuments()).toBe(0);
  });

  it("should reject create on draft/nonexistent article via admin endpoint", async () => {
    const { draft } = await createArticleContext({ withDraft: true });
    const { accessToken } = await createAuthedUser({ role: "admin" });

    const draftRes = await request(app)
      .post("/api/v1/comments")
      .set(authHeader(accessToken))
      .send({ body: "Draft comment", articleID: String(draft.id) });
    expect(draftRes.status).toBe(404);
    expect(await Comment.countDocuments()).toBe(0);

    const missing = await request(app)
      .post("/api/v1/comments")
      .set(authHeader(accessToken))
      .send({
        body: "Missing article",
        articleID: new mongoose.Types.ObjectId().toString(),
      });
    expect(missing.status).toBe(404);
    expect(await Comment.countDocuments()).toBe(0);
  });

  it("should reject invalid body/articleID and unauthenticated requests", async () => {
    const { article } = await createArticleContext();
    const { accessToken } = await createAuthedUser({ role: "admin" });

    const unauth = await request(app)
      .post("/api/v1/comments")
      .send({ body: "X", articleID: String(article.id) });
    expect(unauth.status).toBe(401);

    const invalid = await request(app)
      .post("/api/v1/comments")
      .set(authHeader(accessToken))
      .send({ body: "  ", articleID: "bad" });
    expect(invalid.status).toBe(400);
    expect(invalid.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "body", in: "body" }),
        expect.objectContaining({ field: "articleId", in: "body" }),
      ]),
    );
  });
});

// ─── Admin GET /api/v1/comments ──────────────────────────────────────────────
describe("GET /api/v1/comments (admin)", () => {
  it("should let an admin list all comments including hidden, with filters", async () => {
    const { user, article } = await createArticleContext();
    const otherArticle = await seedArticle({
      author: user.id,
      title: "Other",
    });
    await seedComment({
      article: article.id,
      author: user.id,
      body: "Public A",
      status: "public",
    });
    await seedComment({
      article: article.id,
      author: user.id,
      body: "Hidden A",
      status: "hidden",
    });
    await seedComment({
      article: otherArticle.id,
      author: user.id,
      body: "Other public",
      status: "public",
    });

    const { accessToken: adminToken } = await createAuthedUser({
      role: "admin",
    });

    const all = await request(app)
      .get("/api/v1/comments")
      .set(authHeader(adminToken));
    expect(all.status).toBe(200);
    expect(all.body.data).toHaveLength(3);
    expect(all.body.pagination.totalItems).toBe(3);

    const hidden = await request(app)
      .get("/api/v1/comments")
      .query({ status: "hidden" })
      .set(authHeader(adminToken));
    expect(hidden.status).toBe(200);
    expect(hidden.body.data).toHaveLength(1);
    expect(hidden.body.data[0].body).toBe("Hidden A");

    const byArticle = await request(app)
      .get("/api/v1/comments")
      .query({ articleId: String(article.id) })
      .set(authHeader(adminToken));
    expect(byArticle.status).toBe(200);
    expect(byArticle.body.data).toHaveLength(2);
  });

  it("should forbid a regular user from the admin comment list", async () => {
    const { accessToken } = await createAuthedUser();
    const res = await request(app)
      .get("/api/v1/comments")
      .set(authHeader(accessToken));
    expect(res.status).toBe(403);
  });

  it("should reject unauthenticated access and invalid query params", async () => {
    const unauth = await request(app).get("/api/v1/comments");
    expect(unauth.status).toBe(401);

    const { accessToken } = await createAuthedUser({ role: "admin" });
    const bad = await request(app)
      .get("/api/v1/comments")
      .query({
        page: 0,
        limit: 0,
        sortType: "nope",
        sortBy: "body",
        articleId: "bad",
      })
      .set(authHeader(accessToken));
    expect(bad.status).toBe(400);
    expect(bad.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "page", in: "query" }),
        expect.objectContaining({ field: "limit", in: "query" }),
        expect.objectContaining({ field: "sort_type", in: "query" }),
        expect.objectContaining({ field: "sort_by", in: "query" }),
        expect.objectContaining({ field: "articleId", in: "query" }),
      ]),
    );
  });

  it("should return 404 when filtering by a nonexistent articleId", async () => {
    const { accessToken } = await createAuthedUser({ role: "admin" });
    const id = new mongoose.Types.ObjectId().toString();

    const res = await request(app)
      .get("/api/v1/comments")
      .query({ articleId: id })
      .set(authHeader(accessToken));

    expect(res.status).toBe(404);
  });
});

// ─── PATCH /api/v1/comments/:id ──────────────────────────────────────────────
describe("PATCH /api/v1/comments/:id", () => {
  it("should let the comment owner update the body", async () => {
    const { user, accessToken, article } = await createArticleContext();
    const comment = await seedComment({
      article: article.id,
      author: user.id,
      body: "Before",
    });

    const res = await request(app)
      .patch(`/api/v1/comments/${comment.id}`)
      .set(authHeader(accessToken))
      .send({ body: "After" });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      code: 200,
      message: "comment updated",
      data: { body: "After" },
    });

    const stored = await Comment.findById(comment.id);
    expect(stored.body).toBe("After");
  });

  it("should ignore status changes from a regular owner", async () => {
    const { user, accessToken, article } = await createArticleContext();
    const comment = await seedComment({
      article: article.id,
      author: user.id,
      body: "Stay public",
      status: "public",
    });

    const res = await request(app)
      .patch(`/api/v1/comments/${comment.id}`)
      .set(authHeader(accessToken))
      .send({ body: "Updated text", status: "hidden" });

    expect(res.status).toBe(200);
    const stored = await Comment.findById(comment.id);
    expect(stored.body).toBe("Updated text");
    expect(stored.status).toBe("public");
  });

  it("should let an admin owner update body and status", async () => {
    const { user, accessToken, article } = await createArticleContext({
      user: { role: "admin" },
    });
    const comment = await seedComment({
      article: article.id,
      author: user.id,
      body: "Admin owned",
      status: "public",
    });

    const res = await request(app)
      .patch(`/api/v1/comments/${comment.id}`)
      .set(authHeader(accessToken))
      .send({ body: "Edited", status: "hidden" });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("comment updated");
    const stored = await Comment.findById(comment.id);
    expect(stored.body).toBe("Edited");
    expect(stored.status).toBe("hidden");
  });

  it("should let an admin non-owner change only status (adminOverride)", async () => {
    const { user: owner, article } = await createArticleContext();
    const comment = await seedComment({
      article: article.id,
      author: owner.id,
      body: "Do not edit",
      status: "public",
    });
    const { accessToken: adminToken } = await createAuthedUser({
      role: "admin",
    });

    const res = await request(app)
      .patch(`/api/v1/comments/${comment.id}`)
      .set(authHeader(adminToken))
      .send({ status: "hidden", body: "Should be ignored" });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("comment status updated");

    const stored = await Comment.findById(comment.id);
    expect(stored.status).toBe("hidden");
    expect(stored.body).toBe("Do not edit");
  });

  it("should require a valid status on admin override", async () => {
    const { user: owner, article } = await createArticleContext();
    const comment = await seedComment({
      article: article.id,
      author: owner.id,
      body: "Needs status",
    });
    const { accessToken: adminToken } = await createAuthedUser({
      role: "admin",
    });

    const res = await request(app)
      .patch(`/api/v1/comments/${comment.id}`)
      .set(authHeader(adminToken))
      .send({ body: "Only body" });

    expectBadRequest(res, "status", "body");
    const stored = await Comment.findById(comment.id);
    expect(stored.body).toBe("Needs status");
  });

  it("should forbid a non-owner regular user from updating", async () => {
    const { user: owner, article } = await createArticleContext();
    const comment = await seedComment({
      article: article.id,
      author: owner.id,
      body: "Protected",
    });
    const { accessToken: otherToken } = await createAuthedUser();

    const res = await request(app)
      .patch(`/api/v1/comments/${comment.id}`)
      .set(authHeader(otherToken))
      .send({ body: "Stolen" });

    expect(res.status).toBe(403);
    expect(res.body.message).toBe(
      "You do not have permission to access this comment",
    );
    const stored = await Comment.findById(comment.id);
    expect(stored.body).toBe("Protected");
  });

  it("should return 404 for nonexistent comment and reject invalid input", async () => {
    const { accessToken } = await createAuthedUser();
    const missing = await request(app)
      .patch(`/api/v1/comments/${new mongoose.Types.ObjectId().toString()}`)
      .set(authHeader(accessToken))
      .send({ body: "Ghost" });
    expect(missing.status).toBe(404);

    const badId = await request(app)
      .patch("/api/v1/comments/not-valid")
      .set(authHeader(accessToken))
      .send({ body: "X" });
    expectBadRequest(badId, "id", "params");

    const {
      user,
      accessToken: ownerToken,
      article,
    } = await createArticleContext();
    const comment = await seedComment({
      article: article.id,
      author: user.id,
      body: "Keep",
    });
    const blank = await request(app)
      .patch(`/api/v1/comments/${comment.id}`)
      .set(authHeader(ownerToken))
      .send({ body: "  " });
    expectBadRequest(blank, "body", "body");

    const unauth = await request(app)
      .patch(`/api/v1/comments/${comment.id}`)
      .send({ body: "X" });
    expect(unauth.status).toBe(401);
  });
});

// ─── DELETE /api/v1/comments/:id ─────────────────────────────────────────────
describe("DELETE /api/v1/comments/:id", () => {
  it("should let the owner delete their comment", async () => {
    const { user, accessToken, article } = await createArticleContext();
    const comment = await seedComment({
      article: article.id,
      author: user.id,
      body: "Delete me",
    });

    const res = await request(app)
      .delete(`/api/v1/comments/${comment.id}`)
      .set(authHeader(accessToken));

    expect(res.status).toBe(204);
    expect(await Comment.findById(comment.id)).toBeNull();
  });

  it("should forbid a non-owner from deleting and leave the comment intact", async () => {
    const { user: owner, article } = await createArticleContext();
    const comment = await seedComment({
      article: article.id,
      author: owner.id,
      body: "Stay",
    });
    const { accessToken: otherToken } = await createAuthedUser();

    const res = await request(app)
      .delete(`/api/v1/comments/${comment.id}`)
      .set(authHeader(otherToken));

    expect(res.status).toBe(403);
    expect(await Comment.findById(comment.id)).not.toBeNull();
  });

  it("should let an admin delete another user's comment", async () => {
    const { user: owner, article } = await createArticleContext();
    const comment = await seedComment({
      article: article.id,
      author: owner.id,
      body: "Admin delete",
    });
    const { accessToken: adminToken } = await createAuthedUser({
      role: "admin",
    });

    const res = await request(app)
      .delete(`/api/v1/comments/${comment.id}`)
      .set(authHeader(adminToken));

    expect(res.status).toBe(204);
    expect(await Comment.findById(comment.id)).toBeNull();
  });

  it("should reject unauthenticated delete and invalid/missing ids", async () => {
    const { user, article } = await createArticleContext();
    const comment = await seedComment({
      article: article.id,
      author: user.id,
      body: "Safe",
    });

    const unauth = await request(app).delete(`/api/v1/comments/${comment.id}`);
    expect(unauth.status).toBe(401);
    expect(await Comment.findById(comment.id)).not.toBeNull();

    const { accessToken } = await createAuthedUser();
    const missing = await request(app)
      .delete(`/api/v1/comments/${new mongoose.Types.ObjectId().toString()}`)
      .set(authHeader(accessToken));
    expect(missing.status).toBe(404);

    const badId = await request(app)
      .delete("/api/v1/comments/not-valid")
      .set(authHeader(accessToken));
    expectBadRequest(badId, "id", "params");
  });
});

// ─── Visibility after moderation ─────────────────────────────────────────────
describe("Comment visibility after status changes", () => {
  it("should hide a moderated comment from the public article comments list", async () => {
    const { user, article } = await createArticleContext();
    const comment = await seedComment({
      article: article.id,
      author: user.id,
      body: "Will be hidden",
      status: "public",
    });
    const { accessToken: adminToken } = await createAuthedUser({
      role: "admin",
    });

    await request(app)
      .patch(`/api/v1/comments/${comment.id}`)
      .set(authHeader(adminToken))
      .send({ status: "hidden" });

    const publicList = await request(app).get(
      `/api/v1/articles/${article.id}/comments`,
    );
    expect(publicList.status).toBe(200);
    expect(publicList.body.data).toHaveLength(0);

    const adminList = await request(app)
      .get("/api/v1/comments")
      .query({ status: "hidden", articleId: String(article.id) })
      .set(authHeader(adminToken));
    expect(adminList.body.data).toHaveLength(1);
    expect(adminList.body.data[0].body).toBe("Will be hidden");
  });

  it("should restore a hidden comment to the public list when set back to public", async () => {
    const { user, article } = await createArticleContext();
    const comment = await seedComment({
      article: article.id,
      author: user.id,
      body: "Back again",
      status: "hidden",
    });
    const { accessToken: adminToken } = await createAuthedUser({
      role: "admin",
    });

    await request(app)
      .patch(`/api/v1/comments/${comment.id}`)
      .set(authHeader(adminToken))
      .send({ status: "public" });

    const publicList = await request(app).get(
      `/api/v1/articles/${article.id}/comments`,
    );
    expect(publicList.body.data).toHaveLength(1);
    expect(publicList.body.data[0].body).toBe("Back again");
  });
});

// ─── Database failure ────────────────────────────────────────────────────────
describe("Comment routes when the database is unavailable", () => {
  it("should return 500 when listing article comments cannot reach MongoDB", async () => {
    const { article } = await createArticleContext();
    const uri = process.env.DB_URL;
    await mongoose.disconnect();

    const res = await request(app).get(
      `/api/v1/articles/${article.id}/comments`,
    );

    expect(res.status).toBe(500);
    expect(res.body).toMatchObject({
      code: 500,
      error: "Internal server error",
      message: "We are sorry for the inconvenience. Please try again later.",
    });

    await mongoose.connect(uri);
  });
});
