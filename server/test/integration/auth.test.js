/**
 * Integration Testing — Phase 2
 * Authentication
 *
 * Verifies real Auth components working together:
 * HTTP → middleware → route → controller → auth/user services →
 * MongoDB (in-memory) → JWT/password hashing → response.
 *
 * External SMTP is replaced with a Jest mock so no real email is sent.
 * Auth business logic, controllers, repositories, JWT, and bcrypt are NOT mocked.
 *
 * Rate limiting is stubbed to a no-op so brute-force protection does not
 * interfere with a high-volume Auth suite (same IP via SuperTest).
 */

jest.mock("express-rate-limit", () => () => (_req, _res, next) => next());

jest.mock("../../src/lib/email", () => ({
  sendMail: jest.fn().mockResolvedValue({ messageId: "integration-test-mail" }),
}));

const request = require("supertest");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");

const app = require("../../src/app");
const emailService = require("../../src/lib/email");
const User = require("../../src/model/User");
const Session = require("../../src/model/Session");
const { hashing } = require("../../src/utils");
const tokenServices = require("../../src/lib/token");
const db = require("./helpers/db");
const {
  seedUser,
  issueSession,
  extractTokenFromMail,
  refreshCookie,
  parseRefreshCookie,
  expiredActiveResetToken,
  expiredAccessToken,
  expiredRefreshToken,
} = require("./helpers/auth");

beforeAll(async () => {
  await db.connect();
});

afterEach(async () => {
  emailService.sendMail.mockClear();
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

const expectValidationError = (res, field) => {
  expect(res.status).toBe(400);
  expect(res.body).toMatchObject({
    code: 400,
    error: "Bad request",
  });
  expect(Array.isArray(res.body.data)).toBe(true);
  if (field) {
    expect(
      res.body.data.some((e) => e.field === field && e.in === "body"),
    ).toBe(true);
  }
};

// ─── Registration ────────────────────────────────────────────────────────────
describe("POST /api/v1/auth/sign-up", () => {
  const validBody = {
    name: "Jane Doe",
    email: "jane@example.com",
    password: "password123",
  };

  it("should register a pending user, hash the password, and send activation email", async () => {
    const res = await request(app).post("/api/v1/auth/sign-up").send(validBody);

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      code: 201,
      message:
        "Account created successfully. Please check your email to activate your account.",
      data: {
        name: "Jane Doe",
        email: "jane@example.com",
        status: "pending",
      },
      links: { self: "/api/v1/auth/sign-up" },
    });
    expect(res.body.data.id).toBeTruthy();
    expect(res.body.data.password).toBeUndefined();

    const stored = await User.findOne({ email: validBody.email });
    expect(stored).not.toBeNull();
    expect(stored.account_status).toBe("pending");
    expect(stored.role).toBe("user");
    expect(stored.password_hash).not.toBe(validBody.password);
    expect(
      await hashing.compareHash(validBody.password, stored.password_hash),
    ).toBe(true);

    expect(emailService.sendMail).toHaveBeenCalledTimes(1);
    const mail = emailService.sendMail.mock.calls[0][0];
    expect(mail).toMatchObject({
      email: validBody.email,
      subject: "Activate your account",
    });
    expect(mail.text).toMatch(/email verification code is: \d{6}/);
  });

  it("should reject missing required fields with the validation contract", async () => {
    const res = await request(app).post("/api/v1/auth/sign-up").send({});

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({
      code: 400,
      error: "Bad request",
      message: "Validation failed",
    });
    expect(res.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "name", in: "body" }),
        expect.objectContaining({ field: "email", in: "body" }),
        expect.objectContaining({ field: "password", in: "body" }),
      ]),
    );
    expect(emailService.sendMail).not.toHaveBeenCalled();
  });

  it("should reject an invalid email format", async () => {
    const res = await request(app)
      .post("/api/v1/auth/sign-up")
      .send({ ...validBody, email: "not-an-email" });

    expectValidationError(res, "email");
  });

  it("should reject a password shorter than 8 characters", async () => {
    const res = await request(app)
      .post("/api/v1/auth/sign-up")
      .send({ ...validBody, password: "short" });

    expectValidationError(res, "password");
  });

  it("should reject a duplicate email", async () => {
    await seedUser({
      email: validBody.email,
      password: "password123",
      status: "pending",
    });

    const res = await request(app).post("/api/v1/auth/sign-up").send(validBody);

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({
      code: 400,
      error: "Bad request",
      message: "Validation error",
    });
    expect(res.body.data).toEqual([
      { field: "email", message: "User already exists", in: "body" },
    ]);
  });
});

// ─── Setup admin ─────────────────────────────────────────────────────────────
describe("POST /api/v1/auth/setup-admin", () => {
  const adminBody = {
    name: "Root Admin",
    email: "admin@example.com",
    password: "password123",
  };

  it("should create the first approved admin and return an access token cookie session", async () => {
    const res = await request(app)
      .post("/api/v1/auth/setup-admin")
      .send(adminBody);

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      code: 201,
      message: "System administrator created successfully",
      data: { accessToken: expect.any(String) },
      links: { "sign-in": "/api/v1/auth/sign-in" },
    });

    const cookie = parseRefreshCookie(res.headers["set-cookie"]);
    expect(cookie).toBeTruthy();

    const stored = await User.findOne({ email: adminBody.email });
    expect(stored.role).toBe("admin");
    expect(stored.account_status).toBe("active");
    expect(
      await mongoose.model("Session").countDocuments({ user_id: stored.id }),
    ).toBe(1);
  });

  it("should forbid creating a second system admin", async () => {
    await seedUser({
      email: "first-admin@example.com",
      password: "password123",
      role: "admin",
      status: "approved",
    });

    const res = await request(app)
      .post("/api/v1/auth/setup-admin")
      .send(adminBody);

    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({
      code: 403,
      error: "Forbidden",
      message: "System admin already exists",
    });
  });

  it("should reject invalid setup-admin payloads", async () => {
    const res = await request(app).post("/api/v1/auth/setup-admin").send({});

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Validation failed");
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});

// ─── Email verification ──────────────────────────────────────────────────────
describe("POST /api/v1/auth/verify-email-otp", () => {
  it("should activate a pending account", async () => {
    const registerRes = await request(app).post("/api/v1/auth/sign-up").send({
      name: "Verify Me",
      email: "verify@example.com",
      password: "password123",
    });
    expect(registerRes.status).toBe(201);

    const code = emailService.sendMail.mock.calls[0][0].text.match(/\d{6}/)[0];

    const res = await request(app)
      .post("/api/v1/auth/verify-email-otp")
      .send({ email: "verify@example.com", otp: code });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      code: 200,
      message: "Email verified successfully.",
      links: { "sign-in": "/api/v1/auth/sign-in" },
    });

    const stored = await User.findOne({ email: "verify@example.com" });
    expect(stored.account_status).toBe("active");
  });

  it("should reject an invalid verification code", async () => {
    const res = await request(app)
      .post("/api/v1/auth/verify-email-otp")
      .send({ email: "missing@example.com", otp: "123456" });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({
      code: 400,
      error: "Bad request",
      message: "Invalid or expired OTP",
    });
  });

  it("should reject verification for an already active account", async () => {
    await seedUser({ email: "already@example.com", status: "approved" });

    const res = await request(app)
      .post("/api/v1/auth/verify-email-otp")
      .send({ email: "already@example.com", otp: "123456" });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Invalid or expired OTP");
  });
});

// ─── Resend verification ─────────────────────────────────────────────────────
describe("POST /api/v1/auth/resend-verification-otp", () => {
  it("should resend a verification email for a pending user", async () => {
    await seedUser({
      email: "pending@example.com",
      password: "password123",
      status: "pending",
    });

    const res = await request(app)
      .post("/api/v1/auth/resend-verification-otp")
      .send({ email: "pending@example.com" });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      code: 200,
      message:
        "If an account with that email exists, a verification code has been sent.",
    });
    expect(emailService.sendMail).toHaveBeenCalledTimes(1);
  });

  it("should reject missing/invalid email", async () => {
    const missing = await request(app)
      .post("/api/v1/auth/resend-verification-otp")
      .send({});
    expectValidationError(missing, "email");

    const invalid = await request(app)
      .post("/api/v1/auth/resend-verification-otp")
      .send({ email: "bad" });
    expectValidationError(invalid, "email");
  });

  it("should return 404 when the user does not exist", async () => {
    const res = await request(app)
      .post("/api/v1/auth/resend-verification-otp")
      .send({ email: "nobody@example.com" });

    expect(res.status).toBe(200);
    expect(res.body.message).toContain("If an account");
  });

  it("should forbid resend for an already active account", async () => {
    await seedUser({
      email: "active@example.com",
      password: "password123",
      status: "approved",
    });

    const res = await request(app)
      .post("/api/v1/auth/resend-verification-otp")
      .send({ email: "active@example.com" });

    expect(res.status).toBe(200);
    expect(res.body.message).toContain("If an account");
  });
});

// ─── Login ───────────────────────────────────────────────────────────────────
describe("POST /api/v1/auth/sign-in", () => {
  it("should login an approved user, return access token, set refresh cookie, and store refresh token", async () => {
    await seedUser({
      email: "login@example.com",
      password: "password123",
      status: "approved",
    });

    const res = await request(app)
      .post("/api/v1/auth/sign-in")
      .send({ email: "login@example.com", password: "password123" });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      code: 200,
      message: "Login successful",
      data: { accessToken: expect.any(String) },
      links: { self: "/api/v1/auth/sign-in" },
    });
    expect(res.body.data.refreshToken).toBeUndefined();

    const cookie = parseRefreshCookie(res.headers["set-cookie"]);
    expect(cookie).toBeTruthy();

    const stored = await User.findOne({ email: "login@example.com" });
    expect(
      await mongoose.model("Session").countDocuments({ user_id: stored.id }),
    ).toBe(1);

    const decoded = jwt.verify(
      res.body.data.accessToken,
      process.env.JWT_ACCESS_SECRET,
    );
    expect(decoded).toMatchObject({
      email: "login@example.com",
      role: "user",
    });
  });

  it("should reject unknown email with a generic unauthorized message", async () => {
    const res = await request(app)
      .post("/api/v1/auth/sign-in")
      .send({ email: "missing@example.com", password: "password123" });

    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({
      code: 401,
      error: "Unauthorized",
      message: "Invalid credentials",
    });
  });

  it("should reject an incorrect password with the same generic message", async () => {
    await seedUser({
      email: "login2@example.com",
      password: "password123",
      status: "approved",
    });

    const res = await request(app)
      .post("/api/v1/auth/sign-in")
      .send({ email: "login2@example.com", password: "wrong-password" });

    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Invalid credentials");
  });

  it("should forbid login for a pending (unverified) account", async () => {
    await seedUser({
      email: "pending-login@example.com",
      password: "password123",
      status: "pending",
    });

    const res = await request(app)
      .post("/api/v1/auth/sign-in")
      .send({ email: "pending-login@example.com", password: "password123" });

    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({
      code: 403,
      error: "Forbidden",
      message: "Account is not active",
    });
  });

  it("should forbid login for a blocked account", async () => {
    await seedUser({
      email: "blocked@example.com",
      password: "password123",
      status: "blocked",
    });

    const res = await request(app)
      .post("/api/v1/auth/sign-in")
      .send({ email: "blocked@example.com", password: "password123" });

    expect(res.status).toBe(403);
    expect(res.body.message).toBe("Account is not active");
  });

  it("should reject invalid login payloads", async () => {
    const res = await request(app).post("/api/v1/auth/sign-in").send({});

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Validation failed");
    expect(res.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "email", in: "body" }),
        expect.objectContaining({ field: "password", in: "body" }),
      ]),
    );
  });
});

// ─── Refresh ─────────────────────────────────────────────────────────────────
describe("POST /api/v1/auth/refresh", () => {
  it("should rotate tokens when a valid refresh cookie is present", async () => {
    const user = await seedUser({
      email: "refresh@example.com",
      password: "password123",
    });
    const { refreshToken } = await issueSession(user);

    const res = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", refreshCookie(refreshToken));

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      code: 200,
      message: "Token refreshed successfully",
      data: { accessToken: expect.any(String) },
    });

    const newRefresh = parseRefreshCookie(res.headers["set-cookie"]);
    expect(newRefresh).toBeTruthy();

    const stored = await User.findById(user.id);
    expect(
      await mongoose.model("Session").countDocuments({ user_id: stored.id }),
    ).toBe(1);
    // Access token must verify with the access secret
    jwt.verify(res.body.data.accessToken, process.env.JWT_ACCESS_SECRET);
  });

  it("should reject a missing refresh cookie", async () => {
    const res = await request(app).post("/api/v1/auth/refresh");

    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Refresh token is missing");
  });

  it("should reject an invalid refresh token", async () => {
    const res = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", refreshCookie("not.a.valid.token"));

    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(
      /Invalid Refresh token|Authentication failed/,
    );
  });

  it("should reject an expired refresh token", async () => {
    const user = await seedUser({
      email: "expired-refresh@example.com",
      password: "password123",
    });
    const token = expiredRefreshToken({
      id: user.id,
      role: user.role,
      email: user.email,
    });
    await mongoose.model("Session").create({
      user_id: user.id,
      refresh_token_hash: await hashing.generateHash(token),
      device_info: "integration-test",
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });

    const res = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", refreshCookie(token));

    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Refresh token expired");
  });

  it("should reject a revoked/mismatched refresh token and clear the stored session", async () => {
    const user = await seedUser({
      email: "revoked@example.com",
      password: "password123",
    });
    const { refreshToken: current } = await issueSession(user);
    // Different expiry produces a distinct JWT even within the same second
    const stale = jwt.sign(
      { id: user.id, role: user.role, email: user.email },
      process.env.JWT_REFRESH_SECRET,
      { algorithm: "HS256", expiresIn: "6d" },
    );
    // DB still holds `current`; client presents `stale`
    expect(stale).not.toBe(current);

    const res = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", refreshCookie(stale));

    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Refresh token is invalid or revoked");

    const stored = await User.findById(user.id);
    expect(
      await mongoose.model("Session").countDocuments({ user_id: stored.id }),
    ).toBe(1);
  });

  it("should reject refresh after logout (no stored refresh token)", async () => {
    const user = await seedUser({
      email: "after-logout-refresh@example.com",
      password: "password123",
    });
    const { accessToken, refreshToken } = await issueSession(user);

    await request(app)
      .post("/api/v1/auth/logout")
      .set("Authorization", `Bearer ${accessToken}`)
      .set("Cookie", refreshCookie(refreshToken));

    const res = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", refreshCookie(refreshToken));

    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Refresh token is invalid or revoked");
  });
});

// ─── Logout ──────────────────────────────────────────────────────────────────
describe("POST /api/v1/auth/logout", () => {
  it("should clear the DB session and refresh cookie for an authenticated user", async () => {
    const user = await seedUser({
      email: "logout@example.com",
      password: "password123",
    });
    const { accessToken, refreshToken } = await issueSession(user);

    const res = await request(app)
      .post("/api/v1/auth/logout")
      .set("Authorization", `Bearer ${accessToken}`)
      .set("Cookie", refreshCookie(refreshToken));

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      code: 200,
      message: "Logged out successfully",
    });

    const setCookie = res.headers["set-cookie"] || [];
    expect(setCookie.some((c) => c.startsWith("refreshToken=;"))).toBe(true);

    const stored = await User.findById(user.id);
    expect(
      await mongoose.model("Session").countDocuments({ user_id: stored.id }),
    ).toBe(0);
  });

  it("should reject logout without an Authorization header", async () => {
    const res = await request(app).post("/api/v1/auth/logout");

    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Authorization token missing");
  });

  it("should reject logout when the refresh cookie is missing (already logged out)", async () => {
    const user = await seedUser({
      email: "logout-no-cookie@example.com",
      password: "password123",
    });
    const { accessToken } = await issueSession(user);

    const res = await request(app)
      .post("/api/v1/auth/logout")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Already logged out");
  });

  it("should reject logout with an invalid access token", async () => {
    const res = await request(app)
      .post("/api/v1/auth/logout")
      .set("Authorization", "Bearer totally.invalid.token");

    expect(res.status).toBe(401);
  });

  it("should reject logout with an expired access token", async () => {
    const user = await seedUser({
      email: "logout-expired@example.com",
      password: "password123",
    });
    const { refreshToken } = await issueSession(user);
    const accessToken = expiredAccessToken({
      id: user.id,
      role: user.role,
      email: user.email,
    });

    const res = await request(app)
      .post("/api/v1/auth/logout")
      .set("Authorization", `Bearer ${accessToken}`)
      .set("Cookie", refreshCookie(refreshToken));

    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Access token expired");
  });
});

// ─── Forgot / reset password ─────────────────────────────────────────────────
describe("POST /api/v1/auth/forgot-password", () => {
  it("should send a reset email for a registered user and return a generic message", async () => {
    await seedUser({
      email: "forgot@example.com",
      password: "password123",
    });

    const res = await request(app)
      .post("/api/v1/auth/forgot-password")
      .send({ email: "forgot@example.com" });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      code: 200,
      message:
        "If an account with that email exists, a password reset code has been sent.",
    });
    expect(emailService.sendMail).toHaveBeenCalledTimes(1);
    expect(emailService.sendMail.mock.calls[0][0].subject).toBe(
      "Reset your password",
    );
  });

  it("should return the same generic message for an unknown email (no mail sent)", async () => {
    const res = await request(app)
      .post("/api/v1/auth/forgot-password")
      .send({ email: "unknown@example.com" });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe(
      "If an account with that email exists, a password reset code has been sent.",
    );
    expect(emailService.sendMail).not.toHaveBeenCalled();
  });

  it("should not email a blocked account but still return the generic message", async () => {
    await seedUser({
      email: "blocked-reset@example.com",
      password: "password123",
      status: "blocked",
    });

    const res = await request(app)
      .post("/api/v1/auth/forgot-password")
      .send({ email: "blocked-reset@example.com" });

    expect(res.status).toBe(200);
    expect(emailService.sendMail).not.toHaveBeenCalled();
  });

  it("should reject invalid email input", async () => {
    const res = await request(app)
      .post("/api/v1/auth/forgot-password")
      .send({ email: "bad" });

    expectValidationError(res, "email");
  });
});

describe("POST /api/v1/auth/verify-reset-otp + PATCH /api/v1/auth/reset-password", () => {
  it("should verify the reset OTP, reset the password, and invalidate sessions", async () => {
    const user = await seedUser({
      email: "reset@example.com",
      password: "old-password",
    });
    await issueSession(user);

    await request(app)
      .post("/api/v1/auth/forgot-password")
      .send({ email: "reset@example.com" });
    const code = emailService.sendMail.mock.calls[0][0].text.match(/\d{6}/)[0];
    const verifyRes = await request(app)
      .post("/api/v1/auth/verify-reset-otp")
      .send({ email: "reset@example.com", otp: code });
    const resetToken = verifyRes.headers["set-cookie"][0].split(";")[0];

    const res = await request(app)
      .patch("/api/v1/auth/reset-password")
      .set("Cookie", resetToken)
      .send({ password: "new-password" });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      code: 200,
      message: "Password reset successful",
      links: { "sign-in": "/api/v1/auth/sign-in" },
    });

    const stored = await User.findById(user.id);
    expect(
      await mongoose.model("Session").countDocuments({ user_id: user.id }),
    ).toBe(0);
    expect(
      await hashing.compareHash("new-password", stored.password_hash),
    ).toBe(true);
    expect(
      await hashing.compareHash("old-password", stored.password_hash),
    ).toBe(false);

    const oldLogin = await request(app)
      .post("/api/v1/auth/sign-in")
      .send({ email: "reset@example.com", password: "old-password" });
    expect(oldLogin.status).toBe(401);

    const newLogin = await request(app)
      .post("/api/v1/auth/sign-in")
      .send({ email: "reset@example.com", password: "new-password" });
    expect(newLogin.status).toBe(200);
  });

  it("should reject a missing reset cookie", async () => {
    const res = await request(app)
      .patch("/api/v1/auth/reset-password")
      .send({ password: "new-password" });

    expect(res.status).toBe(401);
  });

  it("should reject a short password", async () => {
    const res = await request(app)
      .patch("/api/v1/auth/reset-password")
      .send({ password: "short" });

    expectValidationError(res, "password");
  });
});

// ─── Auth middleware / authorization (Auth-owned rules only) ─────────────────
describe("Authentication & authorization middleware (via protected routes)", () => {
  it("should allow an authenticated user to access a role-permitted endpoint", async () => {
    const user = await seedUser({
      email: "authed-user@example.com",
      password: "password123",
      role: "user",
    });
    const { accessToken } = await issueSession(user);

    // Ownership-gated self profile — exercises authenticate + authorize(["admin","user"])
    const res = await request(app)
      .get(`/api/v1/users/${user.id}`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data || res.body).toBeTruthy();
  });

  it("should reject a protected route when the Authorization header is missing", async () => {
    const res = await request(app).get("/api/v1/users");

    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Authorization token missing");
  });

  it("should reject a protected route with a malformed Bearer token", async () => {
    const res = await request(app)
      .get("/api/v1/users")
      .set("Authorization", "Bearer abc.def.ghi");

    expect(res.status).toBe(401);
  });

  it("should reject a protected route with an expired access token", async () => {
    const user = await seedUser({
      email: "expired-access@example.com",
      password: "password123",
      role: "admin",
    });
    await issueSession(user);
    const accessToken = expiredAccessToken({
      id: user.id,
      role: user.role,
      email: user.email,
    });

    const res = await request(app)
      .get("/api/v1/users")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Access token expired");
  });

  it("should reject access when the session was invalidated (no refresh token in DB)", async () => {
    const user = await seedUser({
      email: "no-session@example.com",
      password: "password123",
      role: "user",
    });
    const accessToken = tokenServices.generateAccessToken({
      id: user.id,
      role: user.role,
      email: user.email,
    });
    // deliberately do not store a refresh token

    const res = await request(app)
      .get(`/api/v1/users/${user.id}`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Session expired");
  });

  it("should forbid a user role from an admin-only endpoint", async () => {
    const user = await seedUser({
      email: "not-admin@example.com",
      password: "password123",
      role: "user",
    });
    const { accessToken } = await issueSession(user);

    const res = await request(app)
      .get("/api/v1/users")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({
      code: 403,
      error: "Forbidden",
      message: "You are not allowed to access this resource",
    });
  });

  it("should allow an admin through the same admin-only endpoint", async () => {
    const admin = await seedUser({
      email: "yes-admin@example.com",
      password: "password123",
      role: "admin",
    });
    const { accessToken } = await issueSession(admin);

    const res = await request(app)
      .get("/api/v1/users")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
  });
});

describe("Session management routes", () => {
  it("lists the authenticated user's sessions and marks the current cookie session", async () => {
    const user = await seedUser({ email: "sessions@example.com" });
    const first = await issueSession(user);
    const secondRefresh = crypto.randomBytes(32).toString("hex");
    await Session.create({
      user_id: user.id,
      refresh_token_hash: await hashing.generateHash(secondRefresh),
      device_info: "integration-test",
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });

    const res = await request(app)
      .get("/api/v1/auth/sessions")
      .set("Authorization", `Bearer ${first.accessToken}`)
      .set("Cookie", refreshCookie(first.refreshToken));

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ code: 200, message: "Data retrieved." });
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          deviceInfo: "integration-test",
          isCurrent: true,
          expiresAt: expect.any(String),
        }),
        expect.objectContaining({ isCurrent: false }),
      ]),
    );
    expect(secondRefresh).toBeTruthy();
  });

  it("requires authentication to list sessions", async () => {
    const res = await request(app).get("/api/v1/auth/sessions");
    expect(res.status).toBe(401);
  });

  it("deletes only the authenticated user's selected session", async () => {
    const user = await seedUser({ email: "delete-session@example.com" });
    const { accessToken } = await issueSession(user);
    const other = await seedUser({ email: "other-session@example.com" });
    await issueSession(other);
    const session = await Session.findOne({ user_id: user.id });

    const res = await request(app)
      .delete(`/api/v1/auth/sessions/${session.id}`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(res.status).toBe(204);
    expect(await Session.findById(session.id)).toBeNull();
    expect(await Session.countDocuments({ user_id: other.id })).toBe(1);
  });

  it("rejects invalid and missing sessions", async () => {
    const user = await seedUser({ email: "missing-session@example.com" });
    const { accessToken } = await issueSession(user);

    const invalid = await request(app)
      .delete("/api/v1/auth/sessions/not-an-id")
      .set("Authorization", `Bearer ${accessToken}`);
    expect(invalid.status).toBe(400);
    expect(invalid.body.message).toBe("Invalid session ID");

    const missing = await request(app)
      .delete(`/api/v1/auth/sessions/${new mongoose.Types.ObjectId()}`)
      .set("Authorization", `Bearer ${accessToken}`);
    expect(missing.status).toBe(404);
    expect(missing.body.message).toBe("Session not found");
  });

  it("logs out all sessions and clears the refresh cookie", async () => {
    const user = await seedUser({ email: "logout-all@example.com" });
    const { accessToken } = await issueSession(user);
    await issueSession(user);

    const res = await request(app)
      .post("/api/v1/auth/logout-all")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      code: 200,
      message: "Logged out from all devices successfully.",
    });
    expect(await Session.countDocuments({ user_id: user.id })).toBe(0);
    expect(
      (res.headers["set-cookie"] || []).some((c) =>
        c.startsWith("refreshToken=;"),
      ),
    ).toBe(true);
  });
});

// ─── Database failure surface ────────────────────────────────────────────────
describe("Auth routes when the database is unavailable", () => {
  it("should return 500 when login cannot reach MongoDB", async () => {
    const uri = process.env.DB_URL;
    await mongoose.disconnect();

    const res = await request(app)
      .post("/api/v1/auth/sign-in")
      .send({ email: "any@example.com", password: "password123" });

    expect(res.status).toBe(500);
    expect(res.body).toMatchObject({
      code: 500,
      error: "Internal server error",
      message: "We are sorry for the inconvenience. Please try again later.",
    });

    await mongoose.connect(uri);
  });
});
