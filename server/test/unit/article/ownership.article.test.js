/**
 * Unit tests for the "article" branch of src/middleware/ownership.js
 *
 * `ownership.js` is shared across article/comment/user resources. This
 * phase covers the request-level guard checks (auth required, resource
 * id required/valid) and the "article" branch specifically. The
 * "comment" and "user" branches belong to their own module phases.
 *
 * Dependencies mocked:
 * - src/lib/articles (ownership lookup)
 *
 * `src/lib/comments` and `src/lib/user` are provided as empty mocks
 * since `ownership.js` requires them at import time, but they are never
 * invoked by any test in this file (only the "article" model branch is
 * exercised).
 */

const mockCheckOwner = jest.fn();
jest.doMock("../../../src/lib/articles", () => ({
  checkOwner: mockCheckOwner,
}));
jest.doMock("../../../src/lib/comments", () => ({ checkOwner: jest.fn() }));
jest.doMock("../../../src/lib/user", () => ({ checkOwner: jest.fn() }));

const ownership = require("../../../src/middleware/ownership");

describe("ownership middleware - article resource", () => {
  let next;

  beforeEach(() => {
    mockCheckOwner.mockReset();
    next = jest.fn();
  });

  const validArticleId = "507f1f77bcf86cd799439011";

  describe("common guard checks", () => {
    it("should reject when there is no authenticated user", async () => {
      const req = { params: { id: validArticleId } };

      await ownership("article")(req, {}, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 401,
          message: "Authentication required",
        }),
      );
      expect(mockCheckOwner).not.toHaveBeenCalled();
    });

    it("should reject when the resource id is missing", async () => {
      const req = { user: { id: "user-1" }, params: {} };

      await ownership("article")(req, {}, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 403,
          message: "Resource ID is required",
        }),
      );
      expect(mockCheckOwner).not.toHaveBeenCalled();
    });

    it("should reject when the resource id is not a valid ObjectId", async () => {
      const req = { user: { id: "user-1" }, params: { id: "not-an-id" } };

      await ownership("article")(req, {}, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 400 }),
      );
      expect(mockCheckOwner).not.toHaveBeenCalled();
    });
  });

  describe("article ownership rules", () => {
    it("should allow the request when the user owns the article", async () => {
      mockCheckOwner.mockResolvedValue(true);

      const req = {
        user: { id: "user-1", role: "user" },
        params: { id: validArticleId },
      };
      await ownership("article")(req, {}, next);

      expect(mockCheckOwner).toHaveBeenCalledWith({
        resourceId: validArticleId,
        userId: "user-1",
        allowMissing: undefined,
      });
      expect(next).toHaveBeenCalledWith();
      expect(req.adminOverride).toBeUndefined();
    });

    it("should allow the request when the article is missing and allowMissing is enabled", async () => {
      mockCheckOwner.mockResolvedValue(null);

      const req = {
        user: { id: "user-1", role: "user" },
        params: { id: validArticleId },
      };
      await ownership("article", { allowMissing: true })(req, {}, next);

      expect(mockCheckOwner).toHaveBeenCalledWith({
        resourceId: validArticleId,
        userId: "user-1",
        allowMissing: true,
      });
      expect(next).toHaveBeenCalledWith();
    });

    it("should grant an admin override when the admin does not own the article and allowMissing is not set", async () => {
      mockCheckOwner.mockResolvedValue(false);

      const req = {
        user: { id: "admin-1", role: "admin" },
        params: { id: validArticleId },
      };
      await ownership("article")(req, {}, next);

      expect(req.adminOverride).toBe(true);
      expect(next).toHaveBeenCalledWith();
    });

    it("should NOT grant an admin override when allowMissing is enabled", async () => {
      mockCheckOwner.mockResolvedValue(false);

      const req = {
        user: { id: "admin-1", role: "admin" },
        params: { id: validArticleId },
      };
      await ownership("article", { allowMissing: true })(req, {}, next);

      expect(req.adminOverride).toBeUndefined();
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 403,
          message: "You do not have permission to access this article",
        }),
      );
    });

    it("should reject a non-owner, non-admin user", async () => {
      mockCheckOwner.mockResolvedValue(false);

      const req = {
        user: { id: "user-2", role: "user" },
        params: { id: validArticleId },
      };
      await ownership("article")(req, {}, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 403,
          message: "You do not have permission to access this article",
        }),
      );
    });

    it("should propagate the error when the ownership lookup fails", async () => {
      const dbError = new Error("db down");
      mockCheckOwner.mockRejectedValue(dbError);

      const req = {
        user: { id: "user-1", role: "user" },
        params: { id: validArticleId },
      };
      await ownership("article")(req, {}, next);

      expect(next).toHaveBeenCalledWith(dbError);
    });
  });
});
