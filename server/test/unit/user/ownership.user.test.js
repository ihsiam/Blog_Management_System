/**
 * Unit tests for the "user" branch of src/middleware/ownership.js
 *
 * `ownership.js` is shared across article/comment/user resources. The
 * shared request-level guard checks (auth required, resource id
 * required/valid) were already fully covered in Phase 3 using the
 * "article" model - they are not duplicated here. This file focuses
 * only on the "user" branch's own rules, which notably differ from the
 * "article"/"comment" branches:
 * - There is no `req.adminOverride` flag for this model - an allowed
 *   admin simply falls through to `next()` directly.
 * - Admin access is opt-in per route via `options.allowAdmin`, unlike
 *   the article/comment branches which grant admin access by default.
 *
 * Dependencies mocked:
 * - src/lib/user (ownership lookup)
 */

const mockCheckOwner = jest.fn();
jest.doMock("../../../src/lib/user", () => ({ checkOwner: mockCheckOwner }));
jest.doMock("../../../src/lib/articles", () => ({ checkOwner: jest.fn() }));
jest.doMock("../../../src/lib/comments", () => ({ checkOwner: jest.fn() }));

const ownership = require("../../../src/middleware/ownership");

describe("ownership middleware - user resource", () => {
  let next;

  const validUserId = "507f1f77bcf86cd799439011";

  beforeEach(() => {
    mockCheckOwner.mockReset();
    next = jest.fn();
  });

  it("should allow the request when the user is accessing their own resource", async () => {
    mockCheckOwner.mockResolvedValue(true);

    const req = {
      user: { id: "user-1", role: "user" },
      params: { id: validUserId },
    };
    await ownership("user")(req, {}, next);

    expect(mockCheckOwner).toHaveBeenCalledWith({
      resourceId: validUserId,
      userId: "user-1",
    });
    expect(next).toHaveBeenCalledWith();
    expect(req.adminOverride).toBeUndefined();
  });

  it("should reject a non-owning admin when allowAdmin is not enabled", async () => {
    mockCheckOwner.mockResolvedValue(false);

    const req = {
      user: { id: "admin-1", role: "admin" },
      params: { id: validUserId },
    };
    await ownership("user")(req, {}, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 403,
        message: "You do not have permission to access this user",
      }),
    );
    expect(req.adminOverride).toBeUndefined();
  });

  it("should allow a non-owning admin when allowAdmin is enabled", async () => {
    mockCheckOwner.mockResolvedValue(false);

    const req = {
      user: { id: "admin-1", role: "admin" },
      params: { id: validUserId },
    };
    await ownership("user", { allowAdmin: true })(req, {}, next);

    expect(next).toHaveBeenCalledWith();
    // Unlike the article/comment branches, no override flag is set here.
    expect(req.adminOverride).toBeUndefined();
  });

  it("should reject a non-owner, non-admin user even with allowAdmin enabled", async () => {
    mockCheckOwner.mockResolvedValue(false);

    const req = {
      user: { id: "user-2", role: "user" },
      params: { id: validUserId },
    };
    await ownership("user", { allowAdmin: true })(req, {}, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 403,
        message: "You do not have permission to access this user",
      }),
    );
  });

  it("should propagate the error when the ownership lookup fails", async () => {
    const notFoundError = Object.assign(new Error("Not found"), {
      statusCode: 404,
    });
    mockCheckOwner.mockRejectedValue(notFoundError);

    const req = {
      user: { id: "user-1", role: "user" },
      params: { id: validUserId },
    };
    await ownership("user")(req, {}, next);

    expect(next).toHaveBeenCalledWith(notFoundError);
  });
});
