/**
 * Unit tests for src/api/v1/article/controllers/create.js
 *
 * Dependencies mocked:
 * - src/lib/articles (create business logic)
 */

const mockCreate = jest.fn();
jest.doMock("../../../src/lib/articles", () => ({ create: mockCreate }));

const createController = require("../../../src/api/v1/article/controllers/create");
const { createMockResponse } = require("../helpers/mockExpress");

describe("article create controller", () => {
  let res;
  let next;

  beforeEach(() => {
    mockCreate.mockReset();
    res = createMockResponse();
    next = jest.fn();
  });

  describe("input validation", () => {
    it("should reject when title is missing", async () => {
      const req = { body: {}, user: { id: "user-1" } };

      await createController(req, res, next);

      expect(mockCreate).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 400, error: "Bad request" }),
      );
    });

    it("should reject a blank title", async () => {
      const req = { body: { title: "   " }, user: { id: "user-1" } };

      await createController(req, res, next);

      expect(mockCreate).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 400 }),
      );
    });
  });

  describe("successful creation", () => {
    it("should create an article authored by the authenticated user with system defaults", async () => {
      const createdArticle = {
        id: "1",
        title: "Hello",
        body: "",
        cover: "",
        status: "published",
        author: "user-1",
      };
      mockCreate.mockResolvedValue(createdArticle);

      const req = { body: { title: "Hello" }, user: { id: "user-1" } };
      await createController(req, res, next);

      expect(mockCreate).toHaveBeenCalledWith({
        title: "Hello",
        body: "",
        cover: "",
        status: "published",
        author: "user-1",
      });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 201,
          data: createdArticle,
          links: { self: "/api/v1/articles/1" },
        }),
      );
      expect(next).not.toHaveBeenCalled();
    });

    it("should forward optional body and cover fields when provided", async () => {
      mockCreate.mockResolvedValue({ id: "1" });

      const req = {
        body: { title: "Hello", body: "content", cover: "cover.png" },
        user: { id: "user-1" },
      };
      await createController(req, res, next);

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ body: "content", cover: "cover.png" }),
      );
    });
  });

  describe("dependency failures", () => {
    it("should propagate the error when article creation fails", async () => {
      const dbError = new Error("db down");
      mockCreate.mockRejectedValue(dbError);

      const req = { body: { title: "Hello" }, user: { id: "user-1" } };
      await createController(req, res, next);

      expect(next).toHaveBeenCalledWith(dbError);
      expect(res.status).not.toHaveBeenCalled();
    });
  });
});
