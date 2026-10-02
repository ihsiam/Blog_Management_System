const request = require("supertest");
const mongoose = require("mongoose");

const app = require("../../src/app");
const Category = require("../../src/model/Category");
const db = require("./helpers/db");
const { createAuthedUser } = require("./helpers/article");

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

const seedCategory = async (overrides = {}) =>
  Category.create({
    name: overrides.name || `Category ${Date.now()}-${Math.random()}`,
    description: overrides.description || "Seeded description",
    status: overrides.status || "active",
  });

const expectBadRequest = (res, field, location) => {
  expect(res.status).toBe(400);
  expect(res.body).toMatchObject({ code: 400, error: "Bad request" });
  expect(res.body.data).toEqual(
    expect.arrayContaining([expect.objectContaining({ field, in: location })]),
  );
};

describe("GET /api/v1/categories", () => {
  it("lists active categories with pagination and search", async () => {
    await seedCategory({ name: "Technology" });
    await seedCategory({ name: "Travel" });
    await seedCategory({ name: "Hidden", status: "unavailable" });

    const res = await request(app)
      .get("/api/v1/categories")
      .query({ search: "tech", sortBy: "name", sortType: "asc" });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ code: 200, message: "Data retrieved" });
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]).toMatchObject({
      name: "Technology",
      description: expect.any(String),
      status: "active",
      link: expect.stringMatching(/^\/api\/v1\/categories\//),
    });
    expect(res.body.pagination).toMatchObject({
      page: 1,
      limit: 10,
      totalItems: 1,
    });
  });

  it("rejects invalid query parameters", async () => {
    const res = await request(app)
      .get("/api/v1/categories")
      .query({ page: 0, limit: -1, sortType: "sideways", sortBy: "status" });

    expect(res.status).toBe(400);
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

describe("POST /api/v1/categories", () => {
  it("allows an admin to create a category", async () => {
    const { accessToken } = await createAuthedUser({ role: "admin" });
    const res = await request(app)
      .post("/api/v1/categories")
      .set(authHeader(accessToken))
      .send({ name: "New Category", description: "Description" });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      code: 201,
      message: "Category created",
      data: {
        name: "New Category",
        description: "Description",
        status: "active",
      },
      links: { self: expect.stringMatching(/^\/api\/v1\/categories\//) },
    });
  });

  it("requires admin authorization and validates fields", async () => {
    const unauth = await request(app)
      .post("/api/v1/categories")
      .send({ name: "Nope" });
    expect(unauth.status).toBe(401);

    const { accessToken } = await createAuthedUser();
    const forbidden = await request(app)
      .post("/api/v1/categories")
      .set(authHeader(accessToken))
      .send({ name: "Nope" });
    expect(forbidden.status).toBe(403);

    const { accessToken: adminToken } = await createAuthedUser({
      role: "admin",
    });
    const invalid = await request(app)
      .post("/api/v1/categories")
      .set(authHeader(adminToken))
      .send({ name: " ", description: 42 });
    expectBadRequest(invalid, "name", "body");
    const invalidDescription = await request(app)
      .post("/api/v1/categories")
      .set(authHeader(adminToken))
      .send({ name: "Valid", description: 42 });
    expectBadRequest(invalidDescription, "description", "body");
  });

  it("rejects duplicate names with conflict", async () => {
    await seedCategory({ name: "Duplicate" });
    const { accessToken } = await createAuthedUser({ role: "admin" });

    const res = await request(app)
      .post("/api/v1/categories")
      .set(authHeader(accessToken))
      .send({ name: "Duplicate" });

    expect(res.status).toBe(409);
    expect(res.body.message).toBe("A category with this name already exists.");
  });
});

describe("GET /api/v1/categories/:id", () => {
  it("returns an active category", async () => {
    const category = await seedCategory({ name: "Visible" });
    const res = await request(app).get(`/api/v1/categories/${category.id}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      code: 200,
      message: "Data retrieved",
      data: { id: String(category.id), name: "Visible" },
      links: { self: `/api/v1/categories/${category.id}` },
    });
  });

  it("hides unavailable and missing categories and rejects invalid ids", async () => {
    const unavailable = await seedCategory({ status: "unavailable" });
    const hidden = await request(app).get(
      `/api/v1/categories/${unavailable.id}`,
    );
    expect(hidden.status).toBe(404);
    expect(hidden.body.message).toBe("Category not found");

    const missing = await request(app).get(
      `/api/v1/categories/${new mongoose.Types.ObjectId()}`,
    );
    expect(missing.status).toBe(404);

    const invalid = await request(app).get("/api/v1/categories/not-an-id");
    expectBadRequest(invalid, "id", "params");
  });
});

describe("PATCH /api/v1/categories/:id", () => {
  it("allows an admin to update category details", async () => {
    const category = await seedCategory({ name: "Before" });
    const { accessToken } = await createAuthedUser({ role: "admin" });
    const res = await request(app)
      .patch(`/api/v1/categories/${category.id}`)
      .set(authHeader(accessToken))
      .send({ name: "After", description: "Updated" });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      code: 200,
      message: "Successfully updated category",
      data: { name: "After", description: "Updated" },
    });
  });

  it("validates authorization, payload, duplicate, and missing category cases", async () => {
    const category = await seedCategory({ name: "Original" });
    const { accessToken } = await createAuthedUser({ role: "admin" });
    const invalid = await request(app)
      .patch(`/api/v1/categories/${category.id}`)
      .set(authHeader(accessToken))
      .send({ name: "", description: 7 });
    expectBadRequest(invalid, "name", "body");

    const duplicate = await seedCategory({ name: "Other" });
    const conflict = await request(app)
      .patch(`/api/v1/categories/${category.id}`)
      .set(authHeader(accessToken))
      .send({ name: duplicate.name });
    expect(conflict.status).toBe(409);

    const missing = await request(app)
      .patch(`/api/v1/categories/${new mongoose.Types.ObjectId()}`)
      .set(authHeader(accessToken))
      .send({ name: "Missing" });
    expect(missing.status).toBe(404);

    const badId = await request(app)
      .patch("/api/v1/categories/bad-id")
      .set(authHeader(accessToken))
      .send({ name: "Bad" });
    expectBadRequest(badId, "id", "params");
  });
});

describe("PATCH /api/v1/categories/:id/status", () => {
  it("allows an admin to change availability and affects public visibility", async () => {
    const category = await seedCategory({ name: "Availability" });
    const { accessToken } = await createAuthedUser({ role: "admin" });
    const res = await request(app)
      .patch(`/api/v1/categories/${category.id}/status`)
      .set(authHeader(accessToken))
      .send({ status: "unavailable" });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      code: 200,
      message: "Category status updated",
      data: { status: "unavailable" },
    });
    expect(
      (await request(app).get(`/api/v1/categories/${category.id}`)).status,
    ).toBe(404);
  });

  it("rejects unauthorized, invalid, and missing status updates", async () => {
    const category = await seedCategory();
    const unauth = await request(app)
      .patch(`/api/v1/categories/${category.id}/status`)
      .send({ status: "unavailable" });
    expect(unauth.status).toBe(401);

    const { accessToken } = await createAuthedUser();
    const forbidden = await request(app)
      .patch(`/api/v1/categories/${category.id}/status`)
      .set(authHeader(accessToken))
      .send({ status: "unavailable" });
    expect(forbidden.status).toBe(403);

    const { accessToken: adminToken } = await createAuthedUser({
      role: "admin",
    });
    const invalid = await request(app)
      .patch(`/api/v1/categories/${category.id}/status`)
      .set(authHeader(adminToken))
      .send({ status: "bad" });
    expectBadRequest(invalid, "status", "body");

    const missing = await request(app)
      .patch(`/api/v1/categories/${new mongoose.Types.ObjectId()}/status`)
      .set(authHeader(adminToken))
      .send({ status: "active" });
    expect(missing.status).toBe(404);
  });
});
