/**
 * Unit tests for src/lib/articles/index.js
 *
 * These tests keep the service isolated by mocking the Mongoose model,
 * category validation, storage upload, and cache helpers.
 */

const mockFindSingleItemCategory = jest.fn();
const mockUploadArticleCover = jest.fn();
const mockGetCache = jest.fn();
const mockSetCache = jest.fn();
const mockDeleteCache = jest.fn();
const mockDeleteCachePattern = jest.fn();

jest.doMock("../../../src/lib/categories", () => ({
  findSingleItem: mockFindSingleItemCategory,
}));

jest.doMock("../../../src/lib/storage", () => ({
  uploadArticleCover: mockUploadArticleCover,
}));

jest.doMock("../../../src/utils/cache", () => ({
  getCache: mockGetCache,
  setCache: mockSetCache,
  deleteCache: mockDeleteCache,
  deleteCachePattern: mockDeleteCachePattern,
}));

const createQueryChain = (result) => {
  const chain = {};
  chain.populate = jest.fn().mockReturnValue(chain);
  chain.sort = jest.fn().mockReturnValue(chain);
  chain.skip = jest.fn().mockReturnValue(chain);
  chain.limit = jest.fn().mockReturnValue(chain);
  chain.select = jest.fn().mockReturnValue(chain);
  chain.then = (resolve, reject) =>
    Promise.resolve(result).then(resolve, reject);
  chain.catch = (reject) => Promise.resolve(result).catch(reject);
  return chain;
};

const createFakeArticleDoc = (data) => {
  const doc = { ...data };
  doc.save = jest.fn().mockResolvedValue(undefined);
  doc.populate = jest.fn().mockResolvedValue(doc);
  doc.toObject = jest.fn(() => {
    const { save, populate, toObject, ...rest } = doc;
    return rest;
  });
  return doc;
};

const MockArticleModel = jest.fn((data) => createFakeArticleDoc(data));
MockArticleModel.find = jest.fn();
MockArticleModel.findById = jest.fn();
MockArticleModel.findByIdAndDelete = jest.fn();
MockArticleModel.deleteMany = jest.fn();
MockArticleModel.countDocuments = jest.fn();

jest.doMock("../../../src/model/Article", () => MockArticleModel);

const articleService = require("../../../src/lib/articles");

describe("article service (src/lib/articles)", () => {
  beforeEach(() => {
    mockFindSingleItemCategory.mockReset();
    mockUploadArticleCover.mockReset();
    mockGetCache.mockReset();
    mockSetCache.mockReset();
    mockDeleteCache.mockReset();
    mockDeleteCachePattern.mockReset();
    mockGetCache.mockResolvedValue(null);
    mockFindSingleItemCategory.mockResolvedValue({ id: "category-1" });
    mockUploadArticleCover.mockResolvedValue("cover.png");

    MockArticleModel.find.mockReset();
    MockArticleModel.findById.mockReset();
    MockArticleModel.findByIdAndDelete.mockReset();
    MockArticleModel.deleteMany.mockReset();
    MockArticleModel.countDocuments.mockReset();
  });

  describe("findAll", () => {
    it("should return published articles matching the search term with pagination and sorting applied", async () => {
      const docs = [
        createFakeArticleDoc({ id: "1", title: "First" }),
        createFakeArticleDoc({ id: "2", title: "Second" }),
      ];
      const chain = createQueryChain(docs);
      MockArticleModel.find.mockReturnValue(chain);

      const result = await articleService.findAll({
        page: 2,
        limit: 5,
        sortBy: "title",
        sortType: "asc",
        searchTerm: "foo",
        status: "published",
        category: "507f1f77bcf86cd799439011",
      });

      expect(MockArticleModel.find).toHaveBeenCalledWith({
        title: { $regex: "foo", $options: "i" },
        status: "published",
        category_id: "507f1f77bcf86cd799439011",
      });
      expect(chain.sort).toHaveBeenCalledWith("title");
      expect(chain.skip).toHaveBeenCalledWith(5);
      expect(chain.limit).toHaveBeenCalledWith(5);
      expect(result).toEqual([
        { id: "1", title: "First" },
        { id: "2", title: "Second" },
      ]);
    });

    it("should use the default sort key when sortType is omitted", async () => {
      const chain = createQueryChain([]);
      MockArticleModel.find.mockReturnValue(chain);

      await articleService.findAll({});

      expect(chain.sort).toHaveBeenCalledWith("-createdAt");
    });

    it("should return an empty array when nothing matches", async () => {
      const chain = createQueryChain([]);
      MockArticleModel.find.mockReturnValue(chain);

      const result = await articleService.findAll({});

      expect(result).toEqual([]);
    });
  });

  describe("count", () => {
    it("should count documents matching the search term and status", async () => {
      MockArticleModel.countDocuments.mockResolvedValue(3);

      const result = await articleService.count({
        searchTerm: "foo",
        status: "draft",
        category: "507f1f77bcf86cd799439011",
      });

      expect(MockArticleModel.countDocuments).toHaveBeenCalledWith({
        title: { $regex: "foo", $options: "i" },
        status: "draft",
        category_id: "507f1f77bcf86cd799439011",
      });
      expect(result).toBe(3);
    });

    it("should propagate the error when counting fails", async () => {
      MockArticleModel.countDocuments.mockRejectedValue(new Error("db down"));

      await expect(articleService.count({ searchTerm: "" })).rejects.toThrow(
        "db down",
      );
    });
  });

  describe("create", () => {
    it("should validate the category before creating the article", async () => {
      const categoryId = "507f1f77bcf86cd799439011";
      const doc = createFakeArticleDoc({
        id: "1",
        title: "My Article",
        body: "content",
        cover_image_url: "cover.png",
        status: "published",
        author_id: "author-1",
        category_id: categoryId,
      });
      MockArticleModel.mockImplementationOnce(() => doc);

      const result = await articleService.create({
        title: "My Article",
        body: "content",
        status: "published",
        author: "author-1",
        category: categoryId,
        file: { originalname: "cover.png" },
      });

      expect(mockFindSingleItemCategory).toHaveBeenCalledWith({
        id: categoryId,
      });
      expect(mockUploadArticleCover).toHaveBeenCalledWith({
        originalname: "cover.png",
      });
      expect(result.title).toBe("My Article");
      expect(result.category).toBe(categoryId);
    });

    it("should reject invalid category input", async () => {
      await expect(
        articleService.create({
          title: "My Article",
          body: "content",
          author: "author-1",
          category: "not-a-valid-object-id",
          file: { originalname: "cover.png" },
        }),
      ).rejects.toMatchObject({ statusCode: 400 });
    });

    it("should propagate the error when saving fails", async () => {
      const failingDoc = createFakeArticleDoc({ title: "x" });
      failingDoc.save.mockRejectedValue(new Error("save failed"));
      MockArticleModel.mockImplementationOnce(() => failingDoc);
      mockFindSingleItemCategory.mockResolvedValue({
        id: "507f1f77bcf86cd799439011",
      });

      await expect(
        articleService.create({
          title: "x",
          body: "content",
          author: "author-1",
          category: "507f1f77bcf86cd799439011",
          file: { originalname: "cover.png" },
        }),
      ).rejects.toThrow("save failed");
    });
  });

  describe("findSingleItem", () => {
    it("should return a published article without exposing its status", async () => {
      const doc = createFakeArticleDoc({
        id: "1",
        title: "Hello",
        status: "published",
      });
      MockArticleModel.findById.mockResolvedValue(doc);

      const result = await articleService.findSingleItem({ id: "1" });

      expect(result).toEqual({ id: "1", title: "Hello" });
      expect(result.status).toBeUndefined();
    });

    it("should reject when the article does not exist", async () => {
      MockArticleModel.findById.mockResolvedValue(null);

      await expect(
        articleService.findSingleItem({ id: "missing" }),
      ).rejects.toMatchObject({
        statusCode: 404,
        message: "Article not found",
      });
    });

    it("should reject when the article is not published", async () => {
      const doc = createFakeArticleDoc({ id: "1", status: "draft" });
      MockArticleModel.findById.mockResolvedValue(doc);

      await expect(
        articleService.findSingleItem({ id: "1" }),
      ).rejects.toMatchObject({
        statusCode: 404,
        message: "Article not found",
      });
    });

    it("should populate public comments and strip their status/article fields when expand includes 'comments'", async () => {
      const doc = createFakeArticleDoc({
        id: "1",
        status: "published",
        comments: [{ id: "c1", body: "hi", status: "public", article_id: "1" }],
      });
      MockArticleModel.findById.mockResolvedValue(doc);

      const result = await articleService.findSingleItem({
        id: "1",
        expand: "comments",
      });

      expect(doc.populate).toHaveBeenCalledWith({
        path: "comments",
        match: { status: "public" },
        populate: { path: "author_id", select: "name" },
      });
      expect(result.comments).toEqual([{ id: "c1", body: "hi" }]);
    });

    it("should propagate the error when the lookup fails", async () => {
      MockArticleModel.findById.mockRejectedValue(new Error("db down"));

      await expect(articleService.findSingleItem({ id: "1" })).rejects.toThrow(
        "db down",
      );
    });
  });

  describe("updateItemPatch", () => {
    it("should partially update only the provided fields", async () => {
      const doc = createFakeArticleDoc({
        id: "1",
        title: "Old title",
        body: "old body",
        cover_image_url: "old.png",
        status: "draft",
      });
      MockArticleModel.findById.mockResolvedValue(doc);

      const result = await articleService.updateItemPatch("1", {
        title: "New title",
      });

      expect(result.title).toBe("New title");
      expect(result.body).toBe("old body");
      expect(result.status).toBe("draft");
    });

    it("should reject when the article does not exist", async () => {
      MockArticleModel.findById.mockResolvedValue(null);

      await expect(
        articleService.updateItemPatch("missing", { title: "x" }),
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it("should propagate the error when saving fails", async () => {
      const doc = createFakeArticleDoc({ id: "1" });
      doc.save.mockRejectedValue(new Error("save failed"));
      MockArticleModel.findById.mockResolvedValue(doc);

      await expect(
        articleService.updateItemPatch("1", { title: "x" }),
      ).rejects.toThrow("save failed");
    });
  });

  describe("updateStatus", () => {
    it("should update only the article status", async () => {
      const doc = createFakeArticleDoc({ id: "1", status: "draft" });
      MockArticleModel.findById.mockResolvedValue(doc);

      const result = await articleService.updateStatus("1", "published");

      expect(doc.status).toBe("published");
      expect(result.status).toBe("published");
    });

    it("should reject when the article does not exist", async () => {
      MockArticleModel.findById.mockResolvedValue(null);

      await expect(
        articleService.updateStatus("missing", "published"),
      ).rejects.toMatchObject({
        statusCode: 404,
      });
    });
  });

  describe("deleteItem", () => {
    it("should delete an article by id", async () => {
      const deletedDoc = createFakeArticleDoc({ id: "1" });
      MockArticleModel.findByIdAndDelete.mockResolvedValue(deletedDoc);

      const result = await articleService.deleteItem("1");

      expect(MockArticleModel.findByIdAndDelete).toHaveBeenCalledWith("1");
      expect(result).toBe(deletedDoc);
    });

    it("should resolve to null when the article does not exist", async () => {
      MockArticleModel.findByIdAndDelete.mockResolvedValue(null);

      const result = await articleService.deleteItem("missing");

      expect(result).toBeNull();
    });
  });

  describe("deleteMany", () => {
    it("should delete multiple articles matching a filter", async () => {
      MockArticleModel.deleteMany.mockResolvedValue({ deletedCount: 2 });

      const result = await articleService.deleteMany({ author_id: "author-1" });

      expect(MockArticleModel.deleteMany).toHaveBeenCalledWith(
        { author_id: "author-1" },
        undefined,
      );
      expect(result).toBe(true);
    });
  });

  describe("findArticleById", () => {
    it("should fetch the article with an optional session", async () => {
      const session = { id: "session-1" };
      const query = {
        session: jest.fn().mockReturnThis(),
      };
      MockArticleModel.findById.mockReturnValue(query);

      const result = await articleService.findArticleById("1", session);

      expect(MockArticleModel.findById).toHaveBeenCalledWith("1");
      expect(query.session).toHaveBeenCalledWith(session);
      expect(result).toBe(query);
    });
  });

  describe("findArticlesByUser", () => {
    it("should return only the ids of a user's articles", async () => {
      const chain = createQueryChain([{ _id: "a1" }, { _id: "a2" }]);
      MockArticleModel.find.mockReturnValue(chain);

      const result = await articleService.findArticlesByUser("author-1");

      expect(MockArticleModel.find).toHaveBeenCalledWith({
        author_id: "author-1",
      });
      expect(chain.select).toHaveBeenCalledWith("_id");
      expect(result).toEqual(["a1", "a2"]);
    });
  });

  describe("checkOwner", () => {
    it("should return true when the user owns the article", async () => {
      const doc = createFakeArticleDoc({
        id: "1",
        author_id: { toString: () => "user-1" },
      });
      MockArticleModel.findById.mockResolvedValue(doc);

      const result = await articleService.checkOwner({
        resourceId: "1",
        userId: "user-1",
      });

      expect(result).toBe(true);
    });

    it("should return false when the user does not own the article", async () => {
      const doc = createFakeArticleDoc({
        id: "1",
        author_id: { toString: () => "user-1" },
      });
      MockArticleModel.findById.mockResolvedValue(doc);

      const result = await articleService.checkOwner({
        resourceId: "1",
        userId: "someone-else",
      });

      expect(result).toBe(false);
    });

    it("should reject when the article is missing", async () => {
      MockArticleModel.findById.mockResolvedValue(null);

      await expect(
        articleService.checkOwner({ resourceId: "missing", userId: "user-1" }),
      ).rejects.toMatchObject({ statusCode: 404 });
    });
  });
});
