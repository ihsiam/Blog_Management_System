/**
 * Unit tests for src/api/v1/article/controllers/getArticleComments.js
 *
 * Dependencies mocked:
 * - src/lib/service registry (getCommentByArticle orchestration)
 * - src/lib/comments        (count)
 */

const mockGetCommentByArticle = jest.fn();
jest.doMock("../../../src/lib/service registry", () => ({
  getCommentByArticle: mockGetCommentByArticle,
}));

const mockCommentCount = jest.fn();
jest.doMock("../../../src/lib/comments", () => ({ count: mockCommentCount }));

const getArticleCommentsController = require("../../../src/api/v1/article/controllers/getArticleComments");
const { createMockResponse } = require("../helpers/mockExpress");

describe("article getArticleComments controller", () => {
  let res;
  let next;

  const validId = "507f1f77bcf86cd799439011";

  beforeEach(() => {
    mockGetCommentByArticle.mockReset();
    mockCommentCount.mockReset();
    res = createMockResponse();
    next = jest.fn();
  });

  const buildRequest = (query = {}) => ({
    params: { id: validId },
    query,
    url: `/api/v1/articles/${validId}/comments`,
    path: `/api/v1/articles/${validId}/comments`,
  });

  describe("input validation", () => {
    it("should reject an invalid article id", async () => {
      const req = { ...buildRequest(), params: { id: "not-an-id" } };

      await getArticleCommentsController(req, res, next);

      expect(mockGetCommentByArticle).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 400 }),
      );
    });

    it("should reject an invalid page value", async () => {
      const req = buildRequest({ page: "0" });

      await getArticleCommentsController(req, res, next);

      expect(mockGetCommentByArticle).not.toHaveBeenCalled();
      const err = next.mock.calls[0][0];
      expect(err.data).toEqual(
        expect.arrayContaining([expect.objectContaining({ field: "page" })]),
      );
    });

    it("should reject an invalid limit value", async () => {
      const req = buildRequest({ limit: "abc" });

      await getArticleCommentsController(req, res, next);

      expect(mockGetCommentByArticle).not.toHaveBeenCalled();
      const err = next.mock.calls[0][0];
      expect(err.data).toEqual(
        expect.arrayContaining([expect.objectContaining({ field: "limit" })]),
      );
    });
  });

  describe("successful retrieval", () => {
    it("should only request public comments for the article", async () => {
      mockGetCommentByArticle.mockResolvedValue([]);
      mockCommentCount.mockResolvedValue(0);

      await getArticleCommentsController(buildRequest(), res, next);

      expect(mockGetCommentByArticle).toHaveBeenCalledWith(
        expect.objectContaining({ articleID: validId, status: "public" }),
      );
      expect(mockCommentCount).toHaveBeenCalledWith({
        article: validId,
        status: "public",
      });
    });

    it("should return transformed comments with pagination and an article link", async () => {
      mockGetCommentByArticle.mockResolvedValue([
        {
          id: "c1",
          body: "Nice post",
          author: "user-1",
          createdAt: "2024-01-01",
          updatedAt: "2024-01-01",
          status: "public",
        },
      ]);
      mockCommentCount.mockResolvedValue(1);

      const req = buildRequest({ page: "1", limit: "10" });
      await getArticleCommentsController(req, res, next);

      const payload = res.json.mock.calls[0][0];
      expect(payload.data).toEqual([
        {
          id: "c1",
          body: "Nice post",
          author: "user-1",
          createdAt: "2024-01-01",
          updatedAt: "2024-01-01",
        },
      ]);
      expect(payload.links.article).toBe(`/api/v1/articles/${validId}`);
      expect(payload.pagination).toMatchObject({
        page: 1,
        limit: 10,
        totalItems: 1,
      });
      expect(next).not.toHaveBeenCalled();
    });

    it("should return an empty list when the article has no public comments", async () => {
      mockGetCommentByArticle.mockResolvedValue([]);
      mockCommentCount.mockResolvedValue(0);

      await getArticleCommentsController(buildRequest(), res, next);

      const payload = res.json.mock.calls[0][0];
      expect(payload.data).toEqual([]);
    });
  });

  describe("dependency failures", () => {
    it("should propagate the error when the article does not exist", async () => {
      const notFoundError = Object.assign(new Error("Not found"), {
        statusCode: 404,
      });
      mockGetCommentByArticle.mockRejectedValue(notFoundError);

      await getArticleCommentsController(buildRequest(), res, next);

      expect(next).toHaveBeenCalledWith(notFoundError);
    });
  });
});
