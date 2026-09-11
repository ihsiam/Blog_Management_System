/**
 * Unit tests for src/api/v1/comments/controllers/getComments.js
 *
 * Dependencies mocked:
 * - src/lib/service registry (getComments orchestration)
 * - src/lib/comments         (count)
 */

const mockGetComments = jest.fn();
jest.doMock("../../../src/lib/service registry", () => ({
  getComments: mockGetComments,
}));

const mockCount = jest.fn();
jest.doMock("../../../src/lib/comments", () => ({ count: mockCount }));

const getCommentsController = require("../../../src/api/v1/comments/controllers/getComments");
const { createMockResponse } = require("../helpers/mockExpress");

describe("comments getComments controller", () => {
  let res;
  let next;

  beforeEach(() => {
    mockGetComments.mockReset();
    mockCount.mockReset();
    res = createMockResponse();
    next = jest.fn();
  });

  const buildRequest = (query = {}) => ({
    query,
    url: "/api/v1/comments",
    path: "/api/v1/comments",
  });

  describe("input validation", () => {
    it("should reject an invalid page number", async () => {
      const req = buildRequest({ page: "0" });

      await getCommentsController(req, res, next);

      expect(mockGetComments).not.toHaveBeenCalled();
      const err = next.mock.calls[0][0];
      expect(err.data).toEqual(
        expect.arrayContaining([expect.objectContaining({ field: "page" })]),
      );
    });

    it("should reject an invalid limit", async () => {
      const req = buildRequest({ limit: "0" });

      await getCommentsController(req, res, next);

      expect(mockGetComments).not.toHaveBeenCalled();
      const err = next.mock.calls[0][0];
      expect(err.data).toEqual(
        expect.arrayContaining([expect.objectContaining({ field: "limit" })]),
      );
    });

    it("should reject an invalid sortType", async () => {
      const req = buildRequest({ sortType: "sideways" });

      await getCommentsController(req, res, next);

      const err = next.mock.calls[0][0];
      expect(err.data).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: "sort_type" }),
        ]),
      );
    });

    it("should reject an invalid sortBy field", async () => {
      const req = buildRequest({ sortBy: "title" });

      await getCommentsController(req, res, next);

      const err = next.mock.calls[0][0];
      expect(err.data).toEqual(
        expect.arrayContaining([expect.objectContaining({ field: "sort_by" })]),
      );
    });

    it("should reject an invalid articleId format", async () => {
      const req = buildRequest({ articleId: "not-an-id" });

      await getCommentsController(req, res, next);

      expect(mockGetComments).not.toHaveBeenCalled();
      const err = next.mock.calls[0][0];
      expect(err.data).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: "articleId" }),
        ]),
      );
    });
  });

  describe("successful retrieval", () => {
    it("should fetch comments with defaults and no article/status filter", async () => {
      mockGetComments.mockResolvedValue([]);
      mockCount.mockResolvedValue(0);

      await getCommentsController(buildRequest(), res, next);

      expect(mockGetComments).toHaveBeenCalledWith(
        expect.objectContaining({
          page: 1,
          limit: 10,
          postId: undefined,
          status: undefined,
        }),
      );
      expect(mockCount).toHaveBeenCalledWith({
        article: undefined,
        status: undefined,
      });
    });

    it("should forward the articleId and status filters", async () => {
      mockGetComments.mockResolvedValue([]);
      mockCount.mockResolvedValue(0);

      const validId = "507f1f77bcf86cd799439011";
      const req = buildRequest({ articleId: validId, status: "hidden" });
      await getCommentsController(req, res, next);

      expect(mockGetComments).toHaveBeenCalledWith(
        expect.objectContaining({ postId: validId, status: "hidden" }),
      );
      expect(mockCount).toHaveBeenCalledWith({
        article: validId,
        status: "hidden",
      });
    });

    it("should return the paginated response with links", async () => {
      const comments = [{ id: "c1", body: "hi" }];
      mockGetComments.mockResolvedValue(comments);
      mockCount.mockResolvedValue(1);

      await getCommentsController(buildRequest(), res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      const payload = res.json.mock.calls[0][0];
      expect(payload.data).toBe(comments);
      expect(payload.pagination).toMatchObject({
        page: 1,
        limit: 10,
        totalItems: 1,
      });
      expect(payload.links.self).toBe("/api/v1/comments");
      expect(next).not.toHaveBeenCalled();
    });

    it("should return an empty list when there are no comments", async () => {
      mockGetComments.mockResolvedValue([]);
      mockCount.mockResolvedValue(0);

      await getCommentsController(buildRequest(), res, next);

      const payload = res.json.mock.calls[0][0];
      expect(payload.data).toEqual([]);
    });
  });

  describe("dependency failures", () => {
    it("should propagate the error when the filtered article does not exist", async () => {
      const notFoundError = Object.assign(new Error("Not found"), {
        statusCode: 404,
      });
      mockGetComments.mockRejectedValue(notFoundError);

      await getCommentsController(buildRequest(), res, next);

      expect(next).toHaveBeenCalledWith(notFoundError);
    });

    it("should propagate the error when counting comments fails", async () => {
      mockGetComments.mockResolvedValue([]);
      const dbError = new Error("db down");
      mockCount.mockRejectedValue(dbError);

      await getCommentsController(buildRequest(), res, next);

      expect(next).toHaveBeenCalledWith(dbError);
    });
  });
});
