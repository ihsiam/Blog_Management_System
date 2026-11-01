/**
 * Unit tests for the User-related method of
 * src/lib/serviceRegistry/index.js
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

const mockStartSession = jest.fn();
const transactionSession = {
  withTransaction: jest.fn(async (callback) => callback()),
  endSession: jest.fn(),
};
jest.doMock("mongoose", () => ({
  startSession: mockStartSession,
}));

const mockFindUserById = jest.fn();
const mockEnsureAnotherActiveAdmin = jest.fn();
const mockDeleteItem = jest.fn();
jest.doMock("../../../src/lib/user", () => ({
  findUserById: mockFindUserById,
  ensureAnotherActiveAdmin: mockEnsureAnotherActiveAdmin,
  deleteItem: mockDeleteItem,
}));

const mockFindArticlesByUser = jest.fn();
const mockArticleDeleteMany = jest.fn();
jest.doMock("../../../src/lib/articles", () => ({
  findArticlesByUser: mockFindArticlesByUser,
  deleteMany: mockArticleDeleteMany,
}));

const mockCommentDeleteWithReplies = jest.fn();
jest.doMock("../../../src/lib/comments", () => ({
  deleteWithReplies: mockCommentDeleteWithReplies,
}));

const mockRemoveArticleCover = jest.fn();
jest.doMock("../../../src/lib/storage", () => ({
  removeArticleCover: mockRemoveArticleCover,
}));

jest.doMock("../../../src/utils/cache", () => ({
  deleteCachePattern: jest.fn(),
}));

const serviceRegistry = require("../../../src/lib/serviceRegistry");

describe("service registry - deleteUser", () => {
  beforeEach(() => {
    mockStartSession.mockReset();
    mockStartSession.mockResolvedValue(transactionSession);
    transactionSession.withTransaction.mockClear();
    transactionSession.endSession.mockClear();
    mockFindUserById.mockReset();
    mockEnsureAnotherActiveAdmin.mockReset();
    mockDeleteItem.mockReset();
    mockFindArticlesByUser.mockReset();
    mockArticleDeleteMany.mockReset();
    mockCommentDeleteWithReplies.mockReset();
    mockRemoveArticleCover.mockReset();
  });

  it("should cascade-delete the user's comments, their articles' comments, their articles, and finally the user", async () => {
    mockFindUserById.mockResolvedValue({ id: "user-1" });
    mockFindArticlesByUser.mockResolvedValue([
      { id: "article-1", cover: "cover-1" },
      { id: "article-2", cover: "cover-2" },
    ]);
    mockEnsureAnotherActiveAdmin.mockResolvedValue(true);
    mockCommentDeleteWithReplies.mockResolvedValue(true);
    mockArticleDeleteMany.mockResolvedValue(true);
    mockDeleteItem.mockResolvedValue(true);

    const result = await serviceRegistry.deleteUser("user-1");

    expect(mockFindUserById).toHaveBeenCalledWith("user-1", transactionSession);
    expect(mockEnsureAnotherActiveAdmin).toHaveBeenCalledWith(
      "user-1",
      transactionSession,
    );
    expect(mockFindArticlesByUser).toHaveBeenCalledWith(
      "user-1",
      transactionSession,
    );
    expect(mockCommentDeleteWithReplies).toHaveBeenCalledWith(
      {
        article_id: { $in: ["article-1", "article-2"] },
      },
      transactionSession,
    );
    expect(mockCommentDeleteWithReplies).toHaveBeenCalledWith(
      { author_id: "user-1" },
      transactionSession,
    );
    expect(mockArticleDeleteMany).toHaveBeenCalledWith(
      { author_id: "user-1" },
      transactionSession,
    );
    expect(mockDeleteItem).toHaveBeenCalledWith(
      "user-1",
      transactionSession,
    );
    expect(mockRemoveArticleCover).toHaveBeenCalledWith("cover-1");
    expect(mockRemoveArticleCover).toHaveBeenCalledWith("cover-2");
    expect(transactionSession.endSession).toHaveBeenCalledTimes(1);
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
    mockEnsureAnotherActiveAdmin.mockResolvedValue(true);
    mockCommentDeleteWithReplies.mockRejectedValue(new Error("db down"));

    await expect(serviceRegistry.deleteUser("user-1")).rejects.toThrow(
      "db down",
    );
    expect(mockArticleDeleteMany).not.toHaveBeenCalled();
    expect(mockDeleteItem).not.toHaveBeenCalled();
  });

  it("should propagate the error when deleting the user's own articles fails", async () => {
    mockFindUserById.mockResolvedValue({ id: "user-1" });
    mockFindArticlesByUser.mockResolvedValue([]);
    mockEnsureAnotherActiveAdmin.mockResolvedValue(true);
    mockCommentDeleteWithReplies.mockResolvedValue(true);
    mockArticleDeleteMany.mockRejectedValue(new Error("db down"));

    await expect(serviceRegistry.deleteUser("user-1")).rejects.toThrow(
      "db down",
    );
    expect(mockDeleteItem).not.toHaveBeenCalled();
  });

  it("should propagate the error when deleting the user record itself fails", async () => {
    mockFindUserById.mockResolvedValue({ id: "user-1" });
    mockFindArticlesByUser.mockResolvedValue([]);
    mockEnsureAnotherActiveAdmin.mockResolvedValue(true);
    mockCommentDeleteWithReplies.mockResolvedValue(true);
    mockArticleDeleteMany.mockResolvedValue(true);
    mockDeleteItem.mockRejectedValue(new Error("db down"));

    await expect(serviceRegistry.deleteUser("user-1")).rejects.toThrow(
      "db down",
    );
  });
});
