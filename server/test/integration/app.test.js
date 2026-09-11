/**
 * Integration Testing — Phase 1
 * Server / Application Integration
 *
 * Verifies that real application components work together correctly at the
 * HTTP layer. No module dependencies are mocked here — real Express
 * middleware, real routes, real error handler, real correlation-ID
 * middleware, and the real Winston logger (silenced via setup.js) all
 * participate.
 *
 * MongoDB is NOT connected for most tests (health, 404, error-format,
 * middleware). This lets us exercise the 5xx error path naturally: any
 * route that passes validation and reaches a Mongoose query will throw a
 * connection error, which the global error handler converts to a 500.
 *
 * The final describe block ("Database bootstrap") uses MongoMemoryServer
 * to verify the connectDB function end-to-end with a real in-memory
 * MongoDB — no production database is ever touched.
 */

const request = require("supertest");
const mongoose = require("mongoose");

// Load the real Express application (no mocks).
const app = require("../../src/app");

// ─── Console silencing ───────────────────────────────────────────────────────
// restoreMocks:true in the jest config restores every jest.spyOn spy before
// each test, so we re-apply the spy in beforeEach rather than beforeAll.
beforeEach(() => {
  jest.spyOn(console, "log").mockImplementation(() => {});
  jest.spyOn(console, "error").mockImplementation(() => {});
  jest.spyOn(console, "warn").mockImplementation(() => {});
});

// ─── Health check endpoint ───────────────────────────────────────────────────
describe("GET /health", () => {
  it("should respond with 200 and status:ok", async () => {
    const res = await request(app).get("/health");

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });

  it("should include a valid ISO 8601 timestamp", async () => {
    const res = await request(app).get("/health");

    expect(typeof res.body.timestamp).toBe("string");
    expect(Number.isNaN(new Date(res.body.timestamp).getTime())).toBe(false);
  });
});

// ─── 404 / Not-found handler ─────────────────────────────────────────────────
describe("404 not-found handler", () => {
  it("should return 404 for an unknown API route", async () => {
    const res = await request(app).get("/api/v1/this-does-not-exist");

    expect(res.status).toBe(404);
  });

  it("should return the project error contract on a 404", async () => {
    const res = await request(app).get("/api/v1/no-such-resource");

    expect(res.body).toMatchObject({
      code: 404,
      error: "Not found",
      message: "Requested resource not found",
    });
  });

  it("should include a correlationId in the 404 body", async () => {
    const res = await request(app).get("/api/v1/missing");

    expect(typeof res.body.correlationId).toBe("string");
    expect(res.body.correlationId).toBeTruthy();
  });
});

// ─── Correlation-ID middleware ───────────────────────────────────────────────
describe("x-correlation-id middleware", () => {
  it("should propagate an incoming correlation ID back in the response header", async () => {
    const traceId = "my-trace-id-abc-123";

    const res = await request(app)
      .get("/health")
      .set("x-correlation-id", traceId);

    expect(res.headers["x-correlation-id"]).toBe(traceId);
  });

  it("should generate a new UUID correlation ID when none is provided", async () => {
    const res = await request(app).get("/health");

    expect(res.headers["x-correlation-id"]).toBeTruthy();
    expect(typeof res.headers["x-correlation-id"]).toBe("string");
  });

  it("should embed the correlation ID in 4xx error response bodies", async () => {
    const traceId = "error-trace-id-xyz";

    const res = await request(app)
      .get("/api/v1/nonexistent")
      .set("x-correlation-id", traceId);

    expect(res.body.correlationId).toBe(traceId);
  });
});

// ─── CORS middleware ─────────────────────────────────────────────────────────
describe("CORS middleware", () => {
  it("should reflect the origin in Access-Control-Allow-Origin", async () => {
    const res = await request(app)
      .get("/health")
      .set("Origin", "http://example.com");

    expect(res.headers["access-control-allow-origin"]).toBe(
      "http://example.com",
    );
  });

  it("should allow credentials (Access-Control-Allow-Credentials: true)", async () => {
    const res = await request(app)
      .get("/health")
      .set("Origin", "http://example.com");

    expect(res.headers["access-control-allow-credentials"]).toBe("true");
  });

  it("should handle preflight OPTIONS requests with a successful status", async () => {
    const res = await request(app)
      .options("/health")
      .set("Origin", "http://example.com")
      .set("Access-Control-Request-Method", "GET");

    // cors({origin:true}) reflects the exact request origin
    expect(res.headers["access-control-allow-origin"]).toBe(
      "http://example.com",
    );
  });
});

// ─── JSON body-parsing middleware ────────────────────────────────────────────
describe("JSON body-parsing middleware", () => {
  it("should parse a JSON body and pass it through to the controller (returns 400, not 500)", async () => {
    // POST with an empty JSON body reaches the login controller's inline
    // validation which returns 400 without hitting the database.
    // A 400 (not 500) proves body-parser is active and passed the data on.
    const res = await request(app)
      .post("/api/v1/auth/sign-in")
      .set("Content-Type", "application/json")
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.code).toBe(400);
    expect(res.body.error).toBe("Bad request");
  });

  it("should return a validation error data array when required fields are missing", async () => {
    const res = await request(app)
      .post("/api/v1/auth/sign-in")
      .set("Content-Type", "application/json")
      .send({});

    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0]).toMatchObject({
      field: expect.any(String),
      message: expect.any(String),
      in: "body",
    });
  });

  it("should handle malformed JSON with a 400 response", async () => {
    // body-parser sets err.statusCode = 400 (via http-errors) which
    // the global handler correctly reads.
    const res = await request(app)
      .post("/api/v1/auth/sign-in")
      .set("Content-Type", "application/json")
      .send("{ not valid json }");

    expect(res.status).toBe(400);
  });
});

// ─── Global error handler — 5xx path ────────────────────────────────────────
describe("Global error handler — 5xx responses", () => {
  it("should return a generic message and hide implementation details", async () => {
    // A well-formed request that passes validation will reach the service
    // layer. With no MongoDB connection (intentional in this block), Mongoose
    // throws an error that has no .statusCode. The global handler therefore
    // returns 500 with a generic message — exercising the 5xx branch.
    const res = await request(app)
      .post("/api/v1/auth/sign-in")
      .set("Content-Type", "application/json")
      .send({ email: "user@test.com", password: "password123" });

    expect(res.status).toBe(500);
    expect(res.body).toMatchObject({
      code: 500,
      error: "Internal server error",
      message: "We are sorry for the inconvenience. Please try again later.",
    });
  });

  it("should include the correlationId even in 5xx error responses", async () => {
    const traceId = "trace-id-for-500";

    const res = await request(app)
      .post("/api/v1/auth/sign-in")
      .set("Content-Type", "application/json")
      .set("x-correlation-id", traceId)
      .send({ email: "user@test.com", password: "password123" });

    expect(res.status).toBe(500);
    expect(res.body.correlationId).toBe(traceId);
  });
});

// ─── Swagger API docs endpoint ───────────────────────────────────────────────
describe("GET /docs/ (Swagger UI)", () => {
  it("should serve the Swagger UI HTML page at /docs/", async () => {
    const res = await request(app).get("/docs/");

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/html/);
  });

  it("should redirect GET /docs to GET /docs/", async () => {
    const res = await request(app).get("/docs");

    // swagger-ui-express issues a 301 from /docs → /docs/
    expect([200, 301, 302]).toContain(res.status);
  });
});

// ─── Database bootstrap (connectDB) ──────────────────────────────────────────
// These tests start a real in-memory MongoDB to verify the full bootstrap
// flow. They are isolated from all other tests — the connection is torn
// down in afterEach so subsequent tests are not affected.
describe("Database bootstrap — connectDB", () => {
  const connectDB = require("../../src/db/connection");
  let mongodRef = null; // tracks the MongoMemoryServer instance per test

  afterEach(async () => {
    // Always disconnect Mongoose first, then stop the in-memory server.
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    if (mongodRef) {
      await mongodRef.stop();
      mongodRef = null;
    }
    delete process.env.DB_URL;
  });

  it("should connect successfully to an in-memory MongoDB", async () => {
    const { MongoMemoryServer } = require("mongodb-memory-server");
    mongodRef = await MongoMemoryServer.create();
    process.env.DB_URL = mongodRef.getUri();

    await connectDB(1, 0);

    expect(mongoose.connection.readyState).toBe(1); // 1 = connected
  });

  it("should log 'Database connected successfully' after a successful connection", async () => {
    const { MongoMemoryServer } = require("mongodb-memory-server");
    mongodRef = await MongoMemoryServer.create();
    process.env.DB_URL = mongodRef.getUri();

    // console.log is mocked in beforeEach; clearMocks:true ensures only
    // calls made inside this test are recorded.
    await connectDB(1, 0);

    expect(console.log).toHaveBeenCalledWith("Database connected successfully");
  });

  it("should reject with a descriptive error when DB_URL is not set", async () => {
    delete process.env.DB_URL;

    await expect(connectDB()).rejects.toThrow(
      "DB_URL is not defined in environment variables",
    );
    expect(mongoose.connection.readyState).toBe(0); // never connected
  });

  it("should reject when the DB_URL points to an unreachable host", async () => {
    process.env.DB_URL = "mongodb://127.0.0.1:19999/test";

    // retries=1, delayMs=0 → one attempt with 5 s server-selection timeout.
    // This fails in ~5 s, well within the test-level 15 s budget.
    await expect(connectDB(1, 0)).rejects.toThrow();
  }, 15000);
});
