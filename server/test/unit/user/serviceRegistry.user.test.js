/**
 * Unit tests for the User-related method of
 * src/lib/service registry/index.js
 *
 * This module cross-orchestrates article/comment/user services. Only
 * `deleteUser` is covered here, since it is the one consumed by the
 * User module's own controller (`deleteUser.js`).
 *
 * `deleteArticle`, `getCommentByArticle`, `createComment`, and
 * `getArticleAuthor` were already covered in Phase 3 (Article), and
 * `getComments` was covered in Phase 4 (Comment) - none are duplicated
 * here.
 */

const mockFindUserById = jest.fn();
const mockDeleteItem = jest.fn();
jest.doMock("../../../src/lib/user", () => ({
  findUserById: mockFindUserById,
  deleteItem: mockDeleteItem,
}));

const mockFindArticlesByUser = jest.fn();
const mockArticleDeleteMany = jest.fn();
jest.doMock("../../../src/lib/articles", () => ({
  findArticlesByUser: mockFindArticlesByUser,
  deleteMany: mockArticleDeleteMany,
}));

const mockCommentDeleteMany = jest.fn();
jest.doMock("../../../src/lib/comments", () => ({
  deleteMany: mockCommentDeleteMany,
}));

const serviceRegistry = require("../../../src/lib/service registry");

describe("service registry - deleteUser", () => {
  beforeEach(() => {
    mockFindUserById.mockReset();
    mockDeleteItem.mockReset();
    mockFindArticlesByUser.mockReset();
    mockArticleDeleteMany.mockReset();
    mockCommentDeleteMany.mockReset();
  });

  it("should cascade-delete the user's comments, their articles' comments, their articles, and finally the user", async () => {
    mockFindUserById.mockResolvedValue({ id: "user-1" });
    mockFindArticlesByUser.mockResolvedValue(["article-1", "article-2"]);
    mockCommentDeleteMany.mockResolvedValue(true);
    mockArticleDeleteMany.mockResolvedValue(true);
    mockDeleteItem.mockResolvedValue(true);

    const result = await serviceRegistry.deleteUser("user-1");

    expect(mockFindArticlesByUser).toHaveBeenCalledWith("user-1");
    expect(mockCommentDeleteMany).toHaveBeenCalledWith({
      article: { $in: ["article-1", "article-2"] },
    });
    expect(mockCommentDeleteMany).toHaveBeenCalledWith({ author: "user-1" });
    expect(mockArticleDeleteMany).toHaveBeenCalledWith({ author: "user-1" });
    expect(mockDeleteItem).toHaveBeenCalledWith("user-1");
    expect(result).toBe(true);
  });

  it("should reject when the user does not exist", async () => {
    mockFindUserById.mockResolvedValue(null);

    await expect(serviceRegistry.deleteUser("missing")).rejects.toMatchObject({
      statusCode: 404,
    });
    expect(mockFindArticlesByUser).not.toHaveBeenCalled();
    expect(mockDeleteItem).not.toHaveBeenCalled();
  });

  it("should not delete the user when cleaning up their articles' comments fails", async () => {
    mockFindUserById.mockResolvedValue({ id: "user-1" });
    mockFindArticlesByUser.mockResolvedValue([]);
    mockCommentDeleteMany.mockRejectedValue(new Error("db down"));

    await expect(serviceRegistry.deleteUser("user-1")).rejects.toThrow(
      "db down",
    );
    expect(mockArticleDeleteMany).not.toHaveBeenCalled();
    expect(mockDeleteItem).not.toHaveBeenCalled();
  });

  it("should propagate the error when deleting the user's own articles fails", async () => {
    mockFindUserById.mockResolvedValue({ id: "user-1" });
    mockFindArticlesByUser.mockResolvedValue([]);
    mockCommentDeleteMany.mockResolvedValue(true);
    mockArticleDeleteMany.mockRejectedValue(new Error("db down"));

    await expect(serviceRegistry.deleteUser("user-1")).rejects.toThrow(
      "db down",
    );
    expect(mockDeleteItem).not.toHaveBeenCalled();
  });

  it("should propagate the error when deleting the user record itself fails", async () => {
    mockFindUserById.mockResolvedValue({ id: "user-1" });
    mockFindArticlesByUser.mockResolvedValue([]);
    mockCommentDeleteMany.mockResolvedValue(true);
    mockArticleDeleteMany.mockResolvedValue(true);
    mockDeleteItem.mockRejectedValue(new Error("db down"));

    await expect(serviceRegistry.deleteUser("user-1")).rejects.toThrow(
      "db down",
    );
  });
});
