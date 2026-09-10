/**
 * Unit tests for src/api/v1/article/controllers/updateItemPatch.js
 *
 * This controller implements the ownership/authorization boundary for
 * partial article updates:
 * - Admin override (ownership bypass, `req.adminOverride`): only status
 *   may be changed.
 * - Owner who is an admin (no override): may change status plus other
 *   fields.
 * - Owner who is a regular user: status changes are silently dropped.
 *
 * Dependencies mocked:
 * - src/lib/articles (updateItemPatch)
 */

const mockUpdateItemPatch = jest.fn();
jest.doMock("../../../src/lib/articles", () => ({
  updateItemPatch: mockUpdateItemPatch,
}));

const updateItemPatchController = require("../../../src/api/v1/article/controllers/updateItemPatch");
const { createMockResponse } = require("../helpers/mockExpress");

describe("article updateItemPatch controller", () => {
  let res;
  let next;

  const validId = "507f1f77bcf86cd799439011";

  beforeEach(() => {
    mockUpdateItemPatch.mockReset();
    res = createMockResponse();
    next = jest.fn();
  });

  describe("input validation", () => {
    it("should reject an invalid article id", async () => {
      const req = {
        params: { id: "not-an-id" },
        body: {},
        user: { role: "user" },
      };

      await updateItemPatchController(req, res, next);

      expect(mockUpdateItemPatch).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 400 }),
      );
    });

    it("should reject a non-string title when provided", async () => {
      const req = {
        params: { id: validId },
        body: { title: 42 },
        user: { role: "user" },
      };

      await updateItemPatchController(req, res, next);

      expect(mockUpdateItemPatch).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 400 }),
      );
    });
  });

  describe("admin override (ownership bypass)", () => {
    it("should require a status field", async () => {
      const req = {
        params: { id: validId },
        body: { title: "Trying to sneak in a title change" },
        user: { role: "admin" },
        adminOverride: true,
      };

      await updateItemPatchController(req, res, next);

      expect(mockUpdateItemPatch).not.toHaveBeenCalled();
      const err = next.mock.calls[0][0];
      expect(err).toMatchObject({ statusCode: 400 });
      expect(err.data).toEqual([
        { field: "status", message: "invalid input", in: "body" },
      ]);
    });

    it("should update only the status, ignoring any other provided fields", async () => {
      mockUpdateItemPatch.mockResolvedValue({ id: validId, status: "draft" });

      const req = {
        params: { id: validId },
        body: { title: "Should be ignored", status: "draft" },
        user: { role: "admin" },
        adminOverride: true,
      };
      await updateItemPatchController(req, res, next);

      expect(mockUpdateItemPatch).toHaveBeenCalledWith(validId, {
        status: "draft",
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Successfully updated article status",
        }),
      );
    });
  });

  describe("owner updates (no admin override)", () => {
    it("should strip the status field for a regular user, even the article owner", async () => {
      mockUpdateItemPatch.mockResolvedValue({ id: validId });

      const req = {
        params: { id: validId },
        body: { title: "New title", status: "draft" },
        user: { role: "user" },
      };
      await updateItemPatchController(req, res, next);

      expect(mockUpdateItemPatch).toHaveBeenCalledWith(validId, {
        title: "New title",
        body: undefined,
        cover: undefined,
      });
    });

    it("should allow an admin updating their own article to change status alongside other fields", async () => {
      mockUpdateItemPatch.mockResolvedValue({ id: validId });

      const req = {
        params: { id: validId },
        body: { title: "New title", status: "draft" },
        user: { role: "admin" },
      };
      await updateItemPatchController(req, res, next);

      expect(mockUpdateItemPatch).toHaveBeenCalledWith(validId, {
        title: "New title",
        body: undefined,
        cover: undefined,
        status: "draft",
      });
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Successfully updated article data",
        }),
      );
    });
  });

  describe("dependency failures", () => {
    it("should propagate the error when the article does not exist", async () => {
      const notFoundError = Object.assign(new Error("Not found"), {
        statusCode: 404,
      });
      mockUpdateItemPatch.mockRejectedValue(notFoundError);

      const req = {
        params: { id: validId },
        body: { title: "New title" },
        user: { role: "user" },
      };
      await updateItemPatchController(req, res, next);

      expect(next).toHaveBeenCalledWith(notFoundError);
      expect(res.status).not.toHaveBeenCalled();
    });
  });
});
