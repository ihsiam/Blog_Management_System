/**
 * Unit tests for src/api/v1/comments/controllers/postComment.js
 *
 * Dependencies mocked:
 * - src/lib/service registry (createComment orchestration)
 */

const mockCreateComment = jest.fn();
jest.doMock("../../../src/lib/service registry", () => ({
  createComment: mockCreateComment,
}));

const postCommentController = require("../../../src/api/v1/comments/controllers/postComment");
const { createMockResponse } = require("../helpers/mockExpress");

describe("comments postComment controller", () => {
  let res;
  let next;

  const validArticleId = "507f1f77bcf86cd799439011";

  beforeEach(() => {
    mockCreateComment.mockReset();
    res = createMockResponse();
    next = jest.fn();
  });

  describe("input validation", () => {
    it("should reject a missing comment body", async () => {
      const req = {
        body: { articleID: validArticleId },
        user: { id: "user-1" },
      };

      await postCommentController(req, res, next);

      expect(mockCreateComment).not.toHaveBeenCalled();
      const err = next.mock.calls[0][0];
      expect(err.data).toEqual(
        expect.arrayContaining([expect.objectContaining({ field: "body" })]),
      );
    });

    it("should reject a blank comment body", async () => {
      const req = {
        body: { articleID: validArticleId, body: "   " },
        user: { id: "user-1" },
      };

      await postCommentController(req, res, next);

      expect(mockCreateComment).not.toHaveBeenCalled();
    });

    it("should reject a missing articleID", async () => {
      const req = { body: { body: "hi" }, user: { id: "user-1" } };

      await postCommentController(req, res, next);

      expect(mockCreateComment).not.toHaveBeenCalled();
      const err = next.mock.calls[0][0];
      expect(err.data).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: "articleId" }),
        ]),
      );
    });

    it("should reject an invalid articleID format", async () => {
      const req = {
        body: { articleID: "not-an-id", body: "hi" },
        user: { id: "user-1" },
      };

      await postCommentController(req, res, next);

      expect(mockCreateComment).not.toHaveBeenCalled();
    });
  });

  describe("successful creation", () => {
    it("should create the comment with the authenticated user as author and default status", async () => {
      const createdComment = { id: "c1", body: "hi", author: "user-1" };
      mockCreateComment.mockResolvedValue(createdComment);

      const req = {
        body: { articleID: validArticleId, body: "hi" },
        user: { id: "user-1" },
      };
      await postCommentController(req, res, next);

      expect(mockCreateComment).toHaveBeenCalledWith({
        articleID: validArticleId,
        body: "hi",
        status: "public",
        author: "user-1",
      });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        code: 201,
        message: "comment posted",
        data: createdComment,
        links: { self: "/api/v1/comments/c1" },
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe("dependency failures", () => {
    it("should propagate the error when the target article does not exist", async () => {
      const invalidArticleError = Object.assign(new Error("invalid id"), {
        statusCode: 400,
      });
      mockCreateComment.mockRejectedValue(invalidArticleError);

      const req = {
        body: { articleID: validArticleId, body: "hi" },
        user: { id: "user-1" },
      };
      await postCommentController(req, res, next);

      expect(next).toHaveBeenCalledWith(invalidArticleError);
      expect(res.status).not.toHaveBeenCalled();
    });
  });
});
