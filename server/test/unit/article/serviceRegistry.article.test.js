/**
 * Unit tests for the Article-related methods of
 * src/lib/service registry/index.js
 *
 * This module cross-orchestrates article/comment/user services. Only the
 * methods actually consumed by Article controllers are covered here:
 * - deleteArticle       (used by article "deleteItem" controller)
 * - getCommentByArticle (used by "getArticleComments" controller)
 * - createComment       (used by "postCommentOnArticle" controller)
 * - getArticleAuthor    (used by "getArticleAuthor" controller)
 *
 * `getComments` and `deleteUser` are User/Comment-module concerns and
 * are intentionally left for their respective phases.
 */

const mockFindArticleById = jest.fn();
const mockDeleteItem = jest.fn();
const mockFindSingleItem = jest.fn();
jest.doMock("../../../src/lib/articles", () => ({
  findArticleById: mockFindArticleById,
  deleteItem: mockDeleteItem,
  findSingleItem: mockFindSingleItem,
}));

const mockCommentDeleteMany = jest.fn();
const mockGetCommentsByArticle = jest.fn();
const mockCommentCreate = jest.fn();
jest.doMock("../../../src/lib/comments", () => ({
  deleteMany: mockCommentDeleteMany,
  getCommentsByArticle: mockGetCommentsByArticle,
  create: mockCommentCreate,
}));

const mockFindUserById = jest.fn();
jest.doMock("../../../src/lib/user", () => ({
  findUserById: mockFindUserById,
}));

const serviceRegistry = require("../../../src/lib/service registry");

describe("service registry - article-related orchestration", () => {
  beforeEach(() => {
    mockFindArticleById.mockReset();
    mockDeleteItem.mockReset();
    mockFindSingleItem.mockReset();
    mockCommentDeleteMany.mockReset();
    mockGetCommentsByArticle.mockReset();
    mockCommentCreate.mockReset();
    mockFindUserById.mockReset();
  });

  describe("deleteArticle", () => {
    it("should delete all comments of the article and then the article itself", async () => {
      mockFindArticleById.mockResolvedValue({ id: "1" });
      mockCommentDeleteMany.mockResolvedValue(true);
      mockDeleteItem.mockResolvedValue(true);

      const result = await serviceRegistry.deleteArticle("1");

      expect(mockCommentDeleteMany).toHaveBeenCalledWith({ article: "1" });
      expect(mockDeleteItem).toHaveBeenCalledWith("1");
      expect(result).toBe(true);
    });

    it("should reject when the article does not exist", async () => {
      mockFindArticleById.mockResolvedValue(null);

      await expect(
        serviceRegistry.deleteArticle("missing"),
      ).rejects.toMatchObject({ statusCode: 404 });
      expect(mockCommentDeleteMany).not.toHaveBeenCalled();
      expect(mockDeleteItem).not.toHaveBeenCalled();
    });

    it("should propagate the error when deleting the article's comments fails", async () => {
      mockFindArticleById.mockResolvedValue({ id: "1" });
      mockCommentDeleteMany.mockRejectedValue(new Error("db down"));

      await expect(serviceRegistry.deleteArticle("1")).rejects.toThrow(
        "db down",
      );
      expect(mockDeleteItem).not.toHaveBeenCalled();
    });
  });

  describe("getCommentByArticle", () => {
    it("should return the article's comments once the article is confirmed to exist", async () => {
      mockFindSingleItem.mockResolvedValue({ id: "1" });
      const comments = [{ id: "c1" }];
      mockGetCommentsByArticle.mockResolvedValue(comments);

      const result = await serviceRegistry.getCommentByArticle({
        articleID: "1",
        page: 1,
        limit: 10,
        status: "public",
      });

      expect(mockFindSingleItem).toHaveBeenCalledWith({ id: "1" });
      expect(mockGetCommentsByArticle).toHaveBeenCalledWith({
        articleID: "1",
        page: 1,
        limit: 10,
        status: "public",
      });
      expect(result).toBe(comments);
    });

    it("should propagate the error when the article does not exist or is not published", async () => {
      // Realistic behavior: articleServices.findSingleItem always throws
      // (never resolves falsy) for a missing/unpublished article.
      mockFindSingleItem.mockRejectedValue(
        Object.assign(new Error("Article not found"), { statusCode: 404 }),
      );

      await expect(
        serviceRegistry.getCommentByArticle({ articleID: "missing" }),
      ).rejects.toMatchObject({ statusCode: 404 });
      expect(mockGetCommentsByArticle).not.toHaveBeenCalled();
    });
  });

  describe("createComment", () => {
    it("should create a comment once the article is confirmed to exist", async () => {
      mockFindSingleItem.mockResolvedValue({ id: "1" });
      const createdComment = { id: "c1", body: "hi" };
      mockCommentCreate.mockResolvedValue(createdComment);

      const result = await serviceRegistry.createComment({
        articleID: "1",
        body: "hi",
        author: "user-1",
      });

      expect(mockCommentCreate).toHaveBeenCalledWith({
        articleID: "1",
        body: "hi",
        status: "public",
        author: "user-1",
      });
      expect(result).toBe(createdComment);
    });

    it("should propagate the error when the article does not exist or is not published", async () => {
      mockFindSingleItem.mockRejectedValue(
        Object.assign(new Error("Article not found"), { statusCode: 404 }),
      );

      await expect(
        serviceRegistry.createComment({
          articleID: "missing",
          body: "hi",
          author: "user-1",
        }),
      ).rejects.toMatchObject({ statusCode: 404 });
      expect(mockCommentCreate).not.toHaveBeenCalled();
    });
  });

  describe("getArticleAuthor", () => {
    it("should return the article's author", async () => {
      mockFindSingleItem.mockResolvedValue({ id: "1", author: "user-1" });
      const author = { id: "user-1", name: "Jane" };
      mockFindUserById.mockResolvedValue(author);

      const result = await serviceRegistry.getArticleAuthor("1");

      expect(mockFindSingleItem).toHaveBeenCalledWith({ id: "1" });
      expect(mockFindUserById).toHaveBeenCalledWith("user-1");
      expect(result).toBe(author);
    });

    it("should resolve to null when the author user record no longer exists", async () => {
      mockFindSingleItem.mockResolvedValue({ id: "1", author: "deleted-user" });
      mockFindUserById.mockResolvedValue(null);

      const result = await serviceRegistry.getArticleAuthor("1");

      expect(result).toBeNull();
    });

    it("should propagate the error when the article does not exist", async () => {
      mockFindSingleItem.mockRejectedValue(
        Object.assign(new Error("Article not found"), { statusCode: 404 }),
      );

      await expect(
        serviceRegistry.getArticleAuthor("missing"),
      ).rejects.toMatchObject({ statusCode: 404 });
      expect(mockFindUserById).not.toHaveBeenCalled();
    });
  });
});
