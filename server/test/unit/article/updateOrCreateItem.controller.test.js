/**
 * Unit tests for src/api/v1/article/controllers/updateOrCreateItem.js
 *
 * Dependencies mocked:
 * - src/lib/articles (updateOrCreate)
 */

const mockUpdateOrCreate = jest.fn();
jest.doMock("../../../src/lib/articles", () => ({
  updateOrCreate: mockUpdateOrCreate,
}));

const updateOrCreateItemController = require("../../../src/api/v1/article/controllers/updateOrCreateItem");
const { createMockResponse } = require("../helpers/mockExpress");

describe("article updateOrCreateItem controller", () => {
  let res;
  let next;

  const validId = "507f1f77bcf86cd799439011";

  beforeEach(() => {
    mockUpdateOrCreate.mockReset();
    res = createMockResponse();
    next = jest.fn();
  });

  describe("input validation", () => {
    it("should reject an invalid article id", async () => {
      const req = {
        params: { id: "not-an-id" },
        body: { title: "Hello" },
        user: { id: "user-1" },
      };

      await updateOrCreateItemController(req, res, next);

      expect(mockUpdateOrCreate).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 400 }),
      );
    });

    it("should reject a non-string title when provided", async () => {
      const req = {
        params: { id: validId },
        body: { title: 123 },
        user: { id: "user-1" },
      };

      await updateOrCreateItemController(req, res, next);

      expect(mockUpdateOrCreate).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 400 }),
      );
    });
  });

  describe("successful create-or-update", () => {
    it("should respond with 201 and a created message when a new article is created", async () => {
      mockUpdateOrCreate.mockResolvedValue({
        article: { id: validId, title: "Hello" },
        statusCode: 201,
      });

      const req = {
        params: { id: validId },
        body: { title: "Hello" },
        user: { id: "user-1" },
      };
      await updateOrCreateItemController(req, res, next);

      expect(mockUpdateOrCreate).toHaveBeenCalledWith(validId, {
        title: "Hello",
        body: undefined,
        cover: undefined,
        status: "published",
        author: "user-1",
      });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 201,
          message: "Article created successfully",
        }),
      );
    });

    it("should respond with 200 and an updated message when an existing article is updated", async () => {
      mockUpdateOrCreate.mockResolvedValue({
        article: { id: validId, title: "Updated" },
        statusCode: 200,
      });

      const req = {
        params: { id: validId },
        body: { title: "Updated" },
        user: { id: "user-1" },
      };
      await updateOrCreateItemController(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 200,
          message: "Successfully updated article",
        }),
      );
    });

    it("should always set the author to the authenticated user's id", async () => {
      mockUpdateOrCreate.mockResolvedValue({
        article: { id: validId },
        statusCode: 200,
      });

      const req = {
        params: { id: validId },
        body: { title: "Hello" },
        user: { id: "user-1" },
      };
      await updateOrCreateItemController(req, res, next);

      expect(mockUpdateOrCreate).toHaveBeenCalledWith(
        validId,
        expect.objectContaining({ author: "user-1" }),
      );
    });
  });

  describe("dependency failures", () => {
    it("should propagate the error when the update/create fails", async () => {
      const dbError = new Error("db down");
      mockUpdateOrCreate.mockRejectedValue(dbError);

      const req = {
        params: { id: validId },
        body: { title: "Hello" },
        user: { id: "user-1" },
      };
      await updateOrCreateItemController(req, res, next);

      expect(next).toHaveBeenCalledWith(dbError);
      expect(res.status).not.toHaveBeenCalled();
    });
  });
});
