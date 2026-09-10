/**
 * Unit tests for the Comment-related method of
 * src/lib/service registry/index.js
 *
 * This module cross-orchestrates article/comment/user services. Only
 * `getComments` is covered here, since it is the one consumed by the
 * Comment module's own controller (`getComments.js`).
 *
 * `deleteArticle`, `getCommentByArticle`, `createComment`, and
 * `getArticleAuthor` were already fully covered in Phase 3 (Article)
 * because they are consumed by Article controllers - they are not
 * duplicated here. `deleteUser` is a User-module concern deferred to
 * Phase 5.
 */

const mockFindArticleById = jest.fn();
jest.doMock("../../../src/lib/articles", () => ({
  findArticleById: mockFindArticleById,
}));

const mockGetAllComments = jest.fn();
jest.doMock("../../../src/lib/comments", () => ({
  getAllComments: mockGetAllComments,
}));

jest.doMock("../../../src/lib/user", () => ({}));

const serviceRegistry = require("../../../src/lib/service registry");

describe("service registry - getComments", () => {
  beforeEach(() => {
    mockFindArticleById.mockReset();
    mockGetAllComments.mockReset();
  });

  it("should list comments without checking article existence when no articleId filter is given", async () => {
    const comments = [{ id: "c1" }];
    mockGetAllComments.mockResolvedValue(comments);

    const result = await serviceRegistry.getComments({});

    expect(mockFindArticleById).not.toHaveBeenCalled();
    expect(mockGetAllComments).toHaveBeenCalledWith({
      page: 1,
      limit: 10,
      sortKey: "-updatedAt",
    });
    expect(result).toBe(comments);
  });

  it("should build a descending sort key by default and an ascending one when requested", async () => {
    mockGetAllComments.mockResolvedValue([]);

    await serviceRegistry.getComments({ sortType: "asc", sortBy: "createdAt" });

    expect(mockGetAllComments).toHaveBeenCalledWith(
      expect.objectContaining({ sortKey: "createdAt" }),
    );
  });

  it("should filter by status when provided", async () => {
    mockGetAllComments.mockResolvedValue([]);

    await serviceRegistry.getComments({ status: "hidden" });

    expect(mockGetAllComments).toHaveBeenCalledWith(
      expect.objectContaining({ status: "hidden" }),
    );
  });

  it("should allow filtering by an existing article regardless of its publish status", async () => {
    // Unlike the public Article endpoints (which only expose published
    // articles), this admin comment-listing path only checks that the
    // article exists at all - draft articles are valid filters too.
    mockFindArticleById.mockResolvedValue({ id: "article-1", status: "draft" });
    mockGetAllComments.mockResolvedValue([]);

    await serviceRegistry.getComments({ postId: "article-1" });

    expect(mockFindArticleById).toHaveBeenCalledWith("article-1");
    expect(mockGetAllComments).toHaveBeenCalledWith(
      expect.objectContaining({ postId: "article-1" }),
    );
  });

  it("should reject when the filtered article does not exist", async () => {
    mockFindArticleById.mockResolvedValue(null);

    await expect(
      serviceRegistry.getComments({ postId: "missing" }),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(mockGetAllComments).not.toHaveBeenCalled();
  });

  it("should propagate the error when checking article existence fails", async () => {
    mockFindArticleById.mockRejectedValue(new Error("db down"));

    await expect(
      serviceRegistry.getComments({ postId: "article-1" }),
    ).rejects.toThrow("db down");
    expect(mockGetAllComments).not.toHaveBeenCalled();
  });

  it("should propagate the error when fetching comments fails", async () => {
    mockGetAllComments.mockRejectedValue(new Error("db down"));

    await expect(serviceRegistry.getComments({})).rejects.toThrow("db down");
  });
});
