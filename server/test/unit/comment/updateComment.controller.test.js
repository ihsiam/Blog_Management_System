/**
 * Unit tests for src/api/v1/comments/controllers/updateComment.js
 *
 * This controller implements the ownership/authorization boundary for
 * comment updates:
 * - Admin override (ownership bypass, `req.adminOverride`): only status
 *   may be changed, and only to a valid value ("public"/"hidden").
 * - Regular user (owner, no override): may update body; status is
 *   silently dropped even if sent.
 * - Admin (owner, no override): may update body and optionally status,
 *   with status strictly validated when provided.
 *
 * Dependencies mocked:
 * - src/lib/comments (updateComment)
 */

const mockUpdateComment = jest.fn();
jest.doMock("../../../src/lib/comments", () => ({
  updateComment: mockUpdateComment,
}));

const updateCommentController = require("../../../src/api/v1/comments/controllers/updateComment");
const { createMockResponse } = require("../helpers/mockExpress");

describe("comments updateComment controller", () => {
  let res;
  let next;

  const validId = "507f1f77bcf86cd799439011";

  beforeEach(() => {
    mockUpdateComment.mockReset();
    res = createMockResponse();
    next = jest.fn();
  });

  describe("input validation", () => {
    it("should reject an invalid comment id", async () => {
      const req = {
        params: { id: "not-an-id" },
        body: { body: "hi" },
        user: { role: "user" },
      };

      await updateCommentController(req, res, next);

      expect(mockUpdateComment).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 400 }),
      );
    });
  });

  describe("admin override (ownership bypass)", () => {
    it("should require a valid status field", async () => {
      const req = {
        params: { id: validId },
        body: { body: "Trying to sneak in a body change" },
        user: { role: "admin" },
        adminOverride: true,
      };

      await updateCommentController(req, res, next);

      expect(mockUpdateComment).not.toHaveBeenCalled();
      const err = next.mock.calls[0][0];
      expect(err).toMatchObject({ statusCode: 400 });
      expect(err.data).toEqual([
        { field: "status", message: "invalid input", in: "body" },
      ]);
    });

    it("should reject a status value outside of public/hidden", async () => {
      const req = {
        params: { id: validId },
        body: { status: "archived" },
        user: { role: "admin" },
        adminOverride: true,
      };

      await updateCommentController(req, res, next);

      expect(mockUpdateComment).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 400 }),
      );
    });

    it("should update only the status, ignoring any other provided fields", async () => {
      mockUpdateComment.mockResolvedValue({ id: validId, status: "hidden" });

      const req = {
        params: { id: validId },
        body: { body: "Should be ignored", status: "hidden" },
        user: { role: "admin" },
        adminOverride: true,
      };
      await updateCommentController(req, res, next);

      expect(mockUpdateComment).toHaveBeenCalledWith({
        id: validId,
        status: "hidden",
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: "comment status updated" }),
      );
    });
  });

  describe("owner updates (no admin override)", () => {
    it("should reject a non-string or blank body when provided", async () => {
      const req = {
        params: { id: validId },
        body: { body: "   " },
        user: { role: "user" },
      };

      await updateCommentController(req, res, next);

      expect(mockUpdateComment).not.toHaveBeenCalled();
      const err = next.mock.calls[0][0];
      expect(err.data).toEqual(
        expect.arrayContaining([expect.objectContaining({ field: "body" })]),
      );
    });

    it("should strip the status field for a regular user, even the comment owner", async () => {
      mockUpdateComment.mockResolvedValue({ id: validId, body: "new" });

      const req = {
        params: { id: validId },
        body: { body: "new", status: "hidden" },
        user: { role: "user" },
      };
      await updateCommentController(req, res, next);

      expect(mockUpdateComment).toHaveBeenCalledWith({
        id: validId,
        body: "new",
      });
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: "comment updated" }),
      );
    });

    it("should allow an admin updating their own comment to change status alongside the body", async () => {
      mockUpdateComment.mockResolvedValue({ id: validId, body: "new", status: "hidden" });

      const req = {
        params: { id: validId },
        body: { body: "new", status: "hidden" },
        user: { role: "admin" },
      };
      await updateCommentController(req, res, next);

      expect(mockUpdateComment).toHaveBeenCalledWith({
        id: validId,
        body: "new",
        status: "hidden",
      });
    });

    it("should reject an invalid status value from an admin owner", async () => {
      const req = {
        params: { id: validId },
        body: { body: "new", status: "archived" },
        user: { role: "admin" },
      };

      await updateCommentController(req, res, next);

      expect(mockUpdateComment).not.toHaveBeenCalled();
      const err = next.mock.calls[0][0];
      expect(err.data).toEqual(
        expect.arrayContaining([expect.objectContaining({ field: "status" })]),
      );
    });

    it("should allow updating the body without touching status for a non-admin owner", async () => {
      mockUpdateComment.mockResolvedValue({ id: validId, body: "new" });

      const req = {
        params: { id: validId },
        body: { body: "new" },
        user: { role: "user" },
      };
      await updateCommentController(req, res, next);

      expect(mockUpdateComment).toHaveBeenCalledWith({
        id: validId,
        body: "new",
      });
    });
  });

  describe("dependency failures", () => {
    it("should propagate the error when the comment does not exist", async () => {
      const notFoundError = Object.assign(new Error("Not found"), {
        statusCode: 404,
      });
      mockUpdateComment.mockRejectedValue(notFoundError);

      const req = {
        params: { id: validId },
        body: { body: "new" },
        user: { role: "user" },
      };
      await updateCommentController(req, res, next);

      expect(next).toHaveBeenCalledWith(notFoundError);
      expect(res.status).not.toHaveBeenCalled();
    });
  });
});
