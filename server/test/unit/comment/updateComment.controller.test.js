/**
 * Unit tests for src/api/v1/comments/controllers/updateComment.js
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
      await updateCommentController(
        { params: { id: "not-an-id" }, body: { body: "hi" } },
        res,
        next,
      );

      expect(mockUpdateComment).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 400 }),
      );
    });

    it("should reject a missing or blank body", async () => {
      await updateCommentController(
        { params: { id: validId }, body: { body: " " } },
        res,
        next,
      );

      expect(mockUpdateComment).not.toHaveBeenCalled();
      expect(next.mock.calls[0][0].data).toEqual(
        expect.arrayContaining([expect.objectContaining({ field: "body" })]),
      );
    });
  });

  describe("successful update", () => {
    it("should update the comment body and return the service result", async () => {
      const updatedComment = { id: validId, body: "new" };
      mockUpdateComment.mockResolvedValue(updatedComment);

      await updateCommentController(
        { params: { id: validId }, body: { body: "new", status: "hidden" } },
        res,
        next,
      );

      expect(mockUpdateComment).toHaveBeenCalledWith({
        id: validId,
        body: "new",
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        code: 200,
        message: "comment updated",
        data: updatedComment,
        links: { self: `/api/v1/comments/${validId}` },
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe("dependency failures", () => {
    it("should propagate the error when the comment does not exist", async () => {
      const notFoundError = Object.assign(new Error("Not found"), {
        statusCode: 404,
      });
      mockUpdateComment.mockRejectedValue(notFoundError);

      await updateCommentController(
        { params: { id: validId }, body: { body: "new" } },
        res,
        next,
      );

      expect(next).toHaveBeenCalledWith(notFoundError);
      expect(res.status).not.toHaveBeenCalled();
    });
  });
});
