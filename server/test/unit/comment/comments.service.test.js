/**
 * Unit tests for src/lib/comments/index.js
 *
 * The Comment model and cache utility are mocked here to avoid database and
 * Redis access while preserving the service's Mongoose query shape.
 */

const mockGetCache = jest.fn();
const mockSetCache = jest.fn();
const mockDeleteCachePattern = jest.fn();

jest.doMock("../../../src/utils/cache", () => ({
  getCache: mockGetCache,
  setCache: mockSetCache,
  deleteCachePattern: mockDeleteCachePattern,
}));

const createQueryChain = (result) => {
  const chain = {};
  chain.populate = jest.fn().mockReturnValue(chain);
  chain.sort = jest.fn().mockReturnValue(chain);
  chain.skip = jest.fn().mockReturnValue(chain);
  chain.limit = jest.fn().mockReturnValue(chain);
  chain.then = (resolve, reject) =>
    Promise.resolve(result).then(resolve, reject);
  chain.catch = (reject) => Promise.resolve(result).catch(reject);
  return chain;
};

const createFakeCommentDoc = (data) => {
  const doc = { ...data };
  doc.save = jest.fn().mockResolvedValue(undefined);
  doc.populate = jest.fn().mockResolvedValue(doc);
  doc.toObject = jest.fn(() => {
    const { save, populate, toObject, ...rest } = doc;
    return rest;
  });
  return doc;
};

const MockCommentModel = jest.fn((data) => createFakeCommentDoc(data));
MockCommentModel.find = jest.fn();
MockCommentModel.findOne = jest.fn();
MockCommentModel.findById = jest.fn();
MockCommentModel.deleteMany = jest.fn();
MockCommentModel.countDocuments = jest.fn();

jest.doMock("../../../src/model/Comment", () => MockCommentModel);

const commentService = require("../../../src/lib/comments");

describe("comment service (src/lib/comments)", () => {
  beforeEach(() => {
    MockCommentModel.find.mockReset();
    MockCommentModel.findOne.mockReset();
    MockCommentModel.findById.mockReset();
    MockCommentModel.deleteMany.mockReset();
    MockCommentModel.countDocuments.mockReset();
    MockCommentModel.mockClear();
    mockGetCache.mockReset();
    mockGetCache.mockResolvedValue(null);
    mockSetCache.mockReset();
    mockDeleteCachePattern.mockReset();
  });

  describe("getCommentsByArticle", () => {
    it("should return a nested, populated comment tree for an article", async () => {
      const docs = [
        createFakeCommentDoc({
          id: "c1",
          body: "hi",
          article_id: "article-1",
          author_id: { id: "u1", name: "Author" },
          status: "public",
          parent_comment_id: null,
        }),
        createFakeCommentDoc({
          id: "c2",
          body: "reply",
          article_id: "article-1",
          author_id: { id: "u2", name: "Reply author" },
          status: "public",
          parent_comment_id: "c1",
        }),
      ];
      const chain = createQueryChain(docs);
      MockCommentModel.find.mockReturnValue(chain);

      const result = await commentService.getCommentsByArticle({
        articleID: "article-1",
        page: 1,
        limit: 5,
        status: "public",
      });

      expect(MockCommentModel.find).toHaveBeenCalledWith({
        article_id: "article-1",
        status: "public",
      });
      expect(chain.populate).toHaveBeenCalledWith({
        path: "author_id",
        select: "name",
      });
      expect(chain.sort).toHaveBeenCalledWith({ createdAt: 1 });
      expect(result).toEqual([
        expect.objectContaining({
          id: "c1",
          article: "article-1",
          author: { id: "u1", name: "Author" },
          replies: [
            expect.objectContaining({
              id: "c2",
              author: { id: "u2", name: "Reply author" },
              replies: [],
            }),
          ],
        }),
      ]);
      expect(mockSetCache).toHaveBeenCalledWith(
        "article:article-1:comments:1:5",
        result,
        60,
      );
    });

    it("should return a cached public result without querying the model", async () => {
      const cached = [{ id: "c1" }];
      mockGetCache.mockResolvedValue(cached);

      await expect(
        commentService.getCommentsByArticle({
          articleID: "article-1",
          status: "public",
        }),
      ).resolves.toBe(cached);
      expect(MockCommentModel.find).not.toHaveBeenCalled();
    });

    it("should apply top-level pagination after building the tree", async () => {
      MockCommentModel.find.mockReturnValue(
        createQueryChain([
          createFakeCommentDoc({ id: "c1", parent_comment_id: null }),
          createFakeCommentDoc({ id: "c2", parent_comment_id: null }),
        ]),
      );

      const result = await commentService.getCommentsByArticle({
        articleID: "article-1",
        page: 2,
        limit: 1,
      });

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("c2");
    });

    it("should propagate the error when the query fails", async () => {
      const chain = createQueryChain(null);
      chain.then = (_resolve, reject) =>
        Promise.reject(new Error("db down")).catch(reject);
      MockCommentModel.find.mockReturnValue(chain);

      await expect(
        commentService.getCommentsByArticle({ articleID: "article-1" }),
      ).rejects.toThrow("db down");
    });
  });

  describe("getAllComments", () => {
    it("should build article/status filters and apply sorting and pagination", async () => {
      const chain = createQueryChain([]);
      MockCommentModel.find.mockReturnValue(chain);

      await commentService.getAllComments({
        postId: "article-1",
        status: "hidden",
        sortKey: "-createdAt",
        page: 2,
        limit: 5,
      });

      expect(MockCommentModel.find).toHaveBeenCalledWith({
        article_id: "article-1",
        status: "hidden",
      });
      expect(chain.sort).toHaveBeenCalledWith("-createdAt");
      expect(chain.skip).toHaveBeenCalledWith(5);
      expect(chain.limit).toHaveBeenCalledWith(5);
    });

    it("should return mapped plain objects", async () => {
      MockCommentModel.find.mockReturnValue(
        createQueryChain([createFakeCommentDoc({ id: "c1" })]),
      );

      await expect(commentService.getAllComments({})).resolves.toEqual([
        { id: "c1" },
      ]);
    });
  });

  describe("count", () => {
    it("should count using article, status, and top-level filters", async () => {
      MockCommentModel.countDocuments.mockResolvedValue(4);

      await expect(
        commentService.count({
          article: "article-1",
          status: "public",
          topLevel: true,
        }),
      ).resolves.toBe(4);
      expect(MockCommentModel.countDocuments).toHaveBeenCalledWith({
        article_id: "article-1",
        status: "public",
        parent_comment_id: null,
      });
      expect(mockSetCache).toHaveBeenCalledWith(
        "article:article-1:comments:count:true",
        4,
        60,
      );
    });

    it("should return a cached public count without querying the model", async () => {
      mockGetCache.mockResolvedValue(3);

      await expect(
        commentService.count({ article: "article-1", status: "public" }),
      ).resolves.toBe(3);
      expect(MockCommentModel.countDocuments).not.toHaveBeenCalled();
    });
  });

  describe("create", () => {
    it("should create and persist a new comment with the default status", async () => {
      const result = await commentService.create({
        articleID: "article-1",
        body: "hi",
        author: "user-1",
      });

      expect(MockCommentModel).toHaveBeenCalledWith({
        body: "hi",
        status: "public",
        article_id: "article-1",
        author_id: "user-1",
        parent_comment_id: null,
      });
      expect(result).toMatchObject({
        body: "hi",
        status: "public",
        article: "article-1",
        parentCommentId: null,
      });
      expect(mockDeleteCachePattern).toHaveBeenCalledWith(
        "article:article-1:comments:*",
      );
    });

    it("should reject a reply when its parent is not on the article", async () => {
      MockCommentModel.findOne.mockResolvedValue(null);

      await expect(
        commentService.create({
          articleID: "article-1",
          body: "reply",
          author: "user-1",
          parentCommentId: "parent-1",
        }),
      ).rejects.toMatchObject({ statusCode: 404 });
      expect(MockCommentModel).not.toHaveBeenCalled();
    });

    it("should propagate the error when saving fails", async () => {
      const failingDoc = createFakeCommentDoc({ body: "hi" });
      failingDoc.save.mockRejectedValue(new Error("save failed"));
      MockCommentModel.mockImplementationOnce(() => failingDoc);

      await expect(
        commentService.create({ articleID: "a1", body: "hi", author: "u1" }),
      ).rejects.toThrow("save failed");
    });
  });

  describe("updateComment", () => {
    it("should update the body and invalidate article caches", async () => {
      const doc = createFakeCommentDoc({
        id: "c1",
        body: "old",
        article_id: "a1",
      });
      MockCommentModel.findById.mockResolvedValue(doc);

      await expect(
        commentService.updateComment({ id: "c1", body: "new" }),
      ).resolves.toMatchObject({ body: "new" });
      expect(doc.save).toHaveBeenCalledTimes(1);
      expect(mockDeleteCachePattern).toHaveBeenCalledWith(
        "article:a1:comments:*",
      );
    });

    it("should reject when the comment does not exist", async () => {
      MockCommentModel.findById.mockResolvedValue(null);

      await expect(
        commentService.updateComment({ id: "missing", body: "x" }),
      ).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  describe("updateStatus", () => {
    it("should update the status and save the comment", async () => {
      const doc = createFakeCommentDoc({
        id: "c1",
        status: "public",
        article_id: "a1",
      });
      MockCommentModel.findById.mockResolvedValue(doc);

      await expect(
        commentService.updateStatus({ id: "c1", status: "hidden" }),
      ).resolves.toMatchObject({ status: "hidden" });
      expect(doc.save).toHaveBeenCalledTimes(1);
    });
  });

  describe("deleteItem", () => {
    it("should delete a comment and all nested replies", async () => {
      const comment = createFakeCommentDoc({ id: "c1", article_id: "a1" });
      MockCommentModel.findById.mockResolvedValue(comment);
      MockCommentModel.find
        .mockReturnValueOnce(
          createQueryChain([{ _id: { toString: () => "c2" } }]),
        )
        .mockReturnValueOnce(createQueryChain([]));
      MockCommentModel.deleteMany.mockResolvedValue({ deletedCount: 2 });

      await expect(commentService.deleteItem("c1")).resolves.toBe(true);
      expect(MockCommentModel.deleteMany).toHaveBeenCalledWith({
        _id: { $in: ["c1", "c2"] },
      });
    });

    it("should reject when the comment does not exist", async () => {
      MockCommentModel.findById.mockResolvedValue(null);

      await expect(commentService.deleteItem("missing")).rejects.toMatchObject({
        statusCode: 404,
      });
    });
  });

  describe("deleteMany", () => {
    it("should map article and author filters and pass the session", async () => {
      MockCommentModel.deleteMany.mockResolvedValue({ deletedCount: 3 });

      await expect(
        commentService.deleteMany({ article: "a1", author: "u1" }, "session-1"),
      ).resolves.toBe(true);
      expect(MockCommentModel.deleteMany).toHaveBeenCalledWith(
        { article_id: "a1", author_id: "u1" },
        { session: "session-1" },
      );
    });
  });

  describe("checkOwner", () => {
    it("should return true when the user owns the comment", async () => {
      MockCommentModel.findById.mockResolvedValue(
        createFakeCommentDoc({ author_id: { toString: () => "user-1" } }),
      );

      await expect(
        commentService.checkOwner({ resourceId: "c1", userId: "user-1" }),
      ).resolves.toBe(true);
    });

    it("should return false when the user does not own the comment", async () => {
      MockCommentModel.findById.mockResolvedValue(
        createFakeCommentDoc({ author_id: { toString: () => "user-1" } }),
      );

      await expect(
        commentService.checkOwner({ resourceId: "c1", userId: "user-2" }),
      ).resolves.toBe(false);
    });
  });
});
