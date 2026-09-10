/**
 * Unit tests for src/api/v1/article/controllers/postCommentOnArticle.js
 *
 * Dependencies mocked:
 * - src/lib/service registry (createComment orchestration)
 */

const mockCreateComment = jest.fn();
jest.doMock("../../../src/lib/service registry", () => ({
  createComment: mockCreateComment,
}));

const postCommentOnArticleController = require("../../../src/api/v1/article/controllers/postCommentOnArticle");
const { createMockResponse } = require("../helpers/mockExpress");

describe("article postCommentOnArticle controller", () => {
  let res;
  let next;

  const validId = "507f1f77bcf86cd799439011";

  beforeEach(() => {
    mockCreateComment.mockReset();
    res = createMockResponse();
    next = jest.fn();
  });

  describe("input validation", () => {
    it("should reject an invalid article id", async () => {
      const req = {
        params: { id: "not-an-id" },
        body: { body: "Nice post" },
        user: { id: "user-1" },
      };

      await postCommentOnArticleController(req, res, next);

      expect(mockCreateComment).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 400 }),
      );
    });

    it("should reject a missing comment body", async () => {
      const req = {
        params: { id: validId },
        body: {},
        user: { id: "user-1" },
      };

      await postCommentOnArticleController(req, res, next);

      expect(mockCreateComment).not.toHaveBeenCalled();
      const err = next.mock.calls[0][0];
      expect(err.data).toEqual([
        { field: "body", message: "invalid input", in: "body" },
      ]);
    });

    it("should reject a blank comment body", async () => {
      const req = {
        params: { id: validId },
        body: { body: "   " },
        user: { id: "user-1" },
      };

      await postCommentOnArticleController(req, res, next);

      expect(mockCreateComment).not.toHaveBeenCalled();
    });
  });

  describe("successful comment creation", () => {
    it("should create the comment with the authenticated user as author and default status", async () => {
      const createdComment = { id: "c1", body: "Nice post", author: "user-1" };
      mockCreateComment.mockResolvedValue(createdComment);

      const req = {
        params: { id: validId },
        body: { body: "Nice post" },
        user: { id: "user-1" },
      };
      await postCommentOnArticleController(req, res, next);

      expect(mockCreateComment).toHaveBeenCalledWith({
        articleID: validId,
        body: "Nice post",
        status: "public",
        author: "user-1",
      });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        code: 201,
        message: "comment posted",
        data: createdComment,
        links: {
          self: `/api/v1/articles/${validId}/comments`,
          article: `/api/v1/articles/${validId}`,
        },
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe("dependency failures", () => {
    it("should propagate the error when the article does not exist", async () => {
      const invalidArticleError = Object.assign(new Error("invalid id"), {
        statusCode: 400,
      });
      mockCreateComment.mockRejectedValue(invalidArticleError);

      const req = {
        params: { id: validId },
        body: { body: "Nice post" },
        user: { id: "user-1" },
      };
      await postCommentOnArticleController(req, res, next);

      expect(next).toHaveBeenCalledWith(invalidArticleError);
      expect(res.status).not.toHaveBeenCalled();
    });
  });
});
