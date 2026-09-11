/**
 * Unit tests for the "comment" branch of src/middleware/ownership.js
 *
 * `ownership.js` is shared across article/comment/user resources. The
 * shared request-level guard checks (auth required, resource id
 * required/valid) were already fully covered in Phase 3 using the
 * "article" model - they are not duplicated here. This file focuses
 * only on the "comment" branch's own rules.
 *
 * Dependencies mocked:
 * - src/lib/comments (ownership lookup)
 *
 * `src/lib/articles` and `src/lib/user` are provided as empty mocks
 * since `ownership.js` requires them at import time, but neither is
 * invoked when model === "comment".
 */

const mockCheckOwner = jest.fn();
jest.doMock("../../../src/lib/comments", () => ({
  checkOwner: mockCheckOwner,
}));
jest.doMock("../../../src/lib/articles", () => ({ checkOwner: jest.fn() }));
jest.doMock("../../../src/lib/user", () => ({ checkOwner: jest.fn() }));

const ownership = require("../../../src/middleware/ownership");

describe("ownership middleware - comment resource", () => {
  let next;

  const validCommentId = "507f1f77bcf86cd799439011";

  beforeEach(() => {
    mockCheckOwner.mockReset();
    next = jest.fn();
  });

  it("should allow the request when the user owns the comment", async () => {
    mockCheckOwner.mockResolvedValue(true);

    const req = {
      user: { id: "user-1", role: "user" },
      params: { id: validCommentId },
    };
    await ownership("comment")(req, {}, next);

    expect(mockCheckOwner).toHaveBeenCalledWith({
      resourceId: validCommentId,
      userId: "user-1",
    });
    expect(next).toHaveBeenCalledWith();
    expect(req.adminOverride).toBeUndefined();
  });

  it("should grant an admin override when a non-owning admin accesses the comment", async () => {
    mockCheckOwner.mockResolvedValue(false);

    const req = {
      user: { id: "admin-1", role: "admin" },
      params: { id: validCommentId },
    };
    await ownership("comment")(req, {}, next);

    expect(req.adminOverride).toBe(true);
    expect(next).toHaveBeenCalledWith();
  });

  it("should reject a non-owner, non-admin user", async () => {
    mockCheckOwner.mockResolvedValue(false);

    const req = {
      user: { id: "user-2", role: "user" },
      params: { id: validCommentId },
    };
    await ownership("comment")(req, {}, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 403,
        message: "You do not have permission to access this comment",
      }),
    );
  });

  it("should propagate the error when the comment does not exist", async () => {
    const notFoundError = Object.assign(new Error("Not found"), {
      statusCode: 404,
    });
    mockCheckOwner.mockRejectedValue(notFoundError);

    const req = {
      user: { id: "user-1", role: "user" },
      params: { id: validCommentId },
    };
    await ownership("comment")(req, {}, next);

    expect(next).toHaveBeenCalledWith(notFoundError);
  });

  it("should propagate the error when the ownership lookup fails for another reason", async () => {
    const dbError = new Error("db down");
    mockCheckOwner.mockRejectedValue(dbError);

    const req = {
      user: { id: "user-1", role: "user" },
      params: { id: validCommentId },
    };
    await ownership("comment")(req, {}, next);

    expect(next).toHaveBeenCalledWith(dbError);
  });
});
