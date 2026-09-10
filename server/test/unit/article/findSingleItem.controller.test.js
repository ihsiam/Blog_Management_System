/**
 * Unit tests for src/api/v1/article/controllers/findSingleItem.js
 *
 * Dependencies mocked:
 * - src/lib/articles (findSingleItem)
 */

const mockFindSingleItem = jest.fn();
jest.doMock("../../../src/lib/articles", () => ({
  findSingleItem: mockFindSingleItem,
}));

const findSingleItemController = require("../../../src/api/v1/article/controllers/findSingleItem");
const { createMockResponse } = require("../helpers/mockExpress");

describe("article findSingleItem controller", () => {
  let res;
  let next;

  beforeEach(() => {
    mockFindSingleItem.mockReset();
    res = createMockResponse();
    next = jest.fn();
  });

  const validId = "507f1f77bcf86cd799439011";

  describe("input validation", () => {
    it("should reject an invalid article id", async () => {
      const req = { params: { id: "not-an-id" }, query: {} };

      await findSingleItemController(req, res, next);

      expect(mockFindSingleItem).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 400 }),
      );
    });
  });

  describe("successful retrieval", () => {
    it("should return the article with navigation links", async () => {
      const article = { id: validId, title: "Hello" };
      mockFindSingleItem.mockResolvedValue(article);

      const req = { params: { id: validId }, query: {} };
      await findSingleItemController(req, res, next);

      expect(mockFindSingleItem).toHaveBeenCalledWith({
        id: validId,
        expand: "",
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        code: 200,
        message: "Data retrieved",
        data: article,
        links: {
          self: `/api/v1/articles/${validId}`,
          author: `/api/v1/articles/${validId}/author`,
          comments: `/api/v1/articles/${validId}/comments`,
        },
      });
      expect(next).not.toHaveBeenCalled();
    });

    it("should forward the expand query parameter", async () => {
      mockFindSingleItem.mockResolvedValue({ id: validId });

      const req = {
        params: { id: validId },
        query: { expand: "author,comments" },
      };
      await findSingleItemController(req, res, next);

      expect(mockFindSingleItem).toHaveBeenCalledWith({
        id: validId,
        expand: "author,comments",
      });
    });
  });

  describe("dependency failures", () => {
    it("should propagate the error when the article does not exist", async () => {
      const notFoundError = Object.assign(new Error("Article not found"), {
        statusCode: 404,
      });
      mockFindSingleItem.mockRejectedValue(notFoundError);

      const req = { params: { id: validId }, query: {} };
      await findSingleItemController(req, res, next);

      expect(next).toHaveBeenCalledWith(notFoundError);
      expect(res.status).not.toHaveBeenCalled();
    });
  });
});
