/**
 * Unit tests for src/api/v1/comments/controllers/updateCommentStatus.js
 *
 * Dependencies mocked:
 * - src/lib/comments (updateStatus)
 */

const mockUpdateStatus = jest.fn();
jest.doMock("../../../src/lib/comments", () => ({
  updateStatus: mockUpdateStatus,
}));

const updateCommentStatusController = require("../../../src/api/v1/comments/controllers/updateCommentStatus");
const { createMockResponse } = require("../helpers/mockExpress");

describe("comments updateCommentStatus controller", () => {
  let res;
  let next;
  const validId = "507f1f77bcf86cd799439011";

  beforeEach(() => {
    mockUpdateStatus.mockReset();
    res = createMockResponse();
    next = jest.fn();
  });

  describe("input validation", () => {
    it("should reject an invalid id", async () => {
      await updateCommentStatusController(
        { params: { id: "not-an-id" }, body: { status: "hidden" } },
        res,
        next,
      );

      expect(mockUpdateStatus).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 400 }),
      );
    });

    it("should reject a status outside public/hidden", async () => {
      await updateCommentStatusController(
        { params: { id: validId }, body: { status: "archived" } },
        res,
        next,
      );

      expect(mockUpdateStatus).not.toHaveBeenCalled();
      expect(next.mock.calls[0][0].data).toEqual([
        { field: "status", message: "invalid input", in: "body" },
      ]);
    });
  });

  describe("successful update", () => {
    it("should update the status and return the service result", async () => {
      const updatedComment = { id: validId, status: "hidden" };
      mockUpdateStatus.mockResolvedValue(updatedComment);

      await updateCommentStatusController(
        { params: { id: validId }, body: { status: "hidden" } },
        res,
        next,
      );

      expect(mockUpdateStatus).toHaveBeenCalledWith({
        id: validId,
        status: "hidden",
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        code: 200,
        message: "comment status updated",
        data: updatedComment,
        links: { self: `/api/v1/comments/${validId}` },
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe("dependency failures", () => {
    it("should propagate the service error", async () => {
      const dbError = new Error("db down");
      mockUpdateStatus.mockRejectedValue(dbError);

      await updateCommentStatusController(
        { params: { id: validId }, body: { status: "public" } },
        res,
        next,
      );

      expect(next).toHaveBeenCalledWith(dbError);
    });
  });
});
