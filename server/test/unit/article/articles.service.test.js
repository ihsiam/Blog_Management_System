/**
 * Unit tests for src/lib/articles/index.js
 *
 * The only real dependency of this module is the Mongoose `Article`
 * model, so it is mocked here to avoid any real database access.
 * `src/config/defaults` and `src/utils/error` are pure/dependency-free
 * and are left real.
 */

/**
 * Builds a fake Mongoose-like query object that supports the same
 * chainable calls used by the service (`populate`, `sort`, `skip`,
 * `limit`, `select`) and resolves to `result` when awaited, just like
 * a real Mongoose Query.
 */
const createQueryChain = (result) => {
  const chain = {};
  chain.populate = jest.fn().mockReturnValue(chain);
  chain.sort = jest.fn().mockReturnValue(chain);
  chain.skip = jest.fn().mockReturnValue(chain);
  chain.limit = jest.fn().mockReturnValue(chain);
  chain.select = jest.fn().mockReturnValue(chain);
  chain.then = (resolve, reject) => Promise.resolve(result).then(resolve, reject);
  chain.catch = (reject) => Promise.resolve(result).catch(reject);
  return chain;
};

/**
 * Builds a fake Mongoose document: a plain object augmented with
 * `save`, `populate`, and `toObject` so service code can call them
 * exactly like it would on a real document.
 */
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

const MockArticleModel = jest.fn(function articleModelCtor(data) {
  return createFakeArticleDoc(data);
});
MockArticleModel.find = jest.fn();
MockArticleModel.findById = jest.fn();
MockArticleModel.findByIdAndDelete = jest.fn();
MockArticleModel.deleteMany = jest.fn();
MockArticleModel.countDocuments = jest.fn();

jest.doMock("../../../src/model/Article", () => MockArticleModel);

const articleService = require("../../../src/lib/articles");

describe("article service (src/lib/articles)", () => {
  beforeEach(() => {
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
      });

      expect(MockArticleModel.find).toHaveBeenCalledWith({
        title: { $regex: "foo", $options: "i" },
        status: "published",
      });
      expect(chain.sort).toHaveBeenCalledWith("title");
      expect(chain.skip).toHaveBeenCalledWith(5); // page(2) * limit(5) - limit(5)
      expect(chain.limit).toHaveBeenCalledWith(5);
      expect(result).toEqual([
        { id: "1", title: "First" },
        { id: "2", title: "Second" },
      ]);
    });

    it("should not filter by status when no status is provided", async () => {
      const chain = createQueryChain([]);
      MockArticleModel.find.mockReturnValue(chain);

      await articleService.findAll({ searchTerm: "" });

      expect(MockArticleModel.find).toHaveBeenCalledWith({
        title: { $regex: "", $options: "i" },
      });
    });

    it("should use a descending sort key by default", async () => {
      const chain = createQueryChain([]);
      MockArticleModel.find.mockReturnValue(chain);

      await articleService.findAll({});

      expect(chain.sort).toHaveBeenCalledWith("-updatedAt");
    });

    it("should return an empty array when nothing matches", async () => {
      const chain = createQueryChain([]);
      MockArticleModel.find.mockReturnValue(chain);

      const result = await articleService.findAll({});

      expect(result).toEqual([]);
    });

    it("should propagate the error when the query fails", async () => {
      const chain = createQueryChain(null);
      chain.then = (_resolve, reject) => Promise.reject(new Error("db down")).catch(reject);
      MockArticleModel.find.mockReturnValue(chain);

      await expect(articleService.findAll({})).rejects.toThrow("db down");
    });
  });

  describe("count", () => {
    it("should count documents matching the search term and status", async () => {
      MockArticleModel.countDocuments.mockResolvedValue(3);

      const result = await articleService.count({
        searchTerm: "foo",
        status: "draft",
      });

      expect(MockArticleModel.countDocuments).toHaveBeenCalledWith({
        title: { $regex: "foo", $options: "i" },
        status: "draft",
      });
      expect(result).toBe(3);
    });

    it("should not filter by status when no status is provided", async () => {
      MockArticleModel.countDocuments.mockResolvedValue(0);

      await articleService.count({ searchTerm: "" });

      expect(MockArticleModel.countDocuments).toHaveBeenCalledWith({
        title: { $regex: "", $options: "i" },
      });
    });

    it("should propagate the error when counting fails", async () => {
      MockArticleModel.countDocuments.mockRejectedValue(new Error("db down"));

      await expect(articleService.count({ searchTerm: "" })).rejects.toThrow(
        "db down",
      );
    });
  });

  describe("create", () => {
    it("should create and persist a new article", async () => {
      const result = await articleService.create({
        title: "My Article",
        body: "content",
        cover: "cover.png",
        status: "draft",
        author: "author-1",
      });

      expect(result).toMatchObject({
        title: "My Article",
        body: "content",
        cover: "cover.png",
        status: "draft",
        author: "author-1",
      });
    });

    it("should propagate the error when saving fails", async () => {
      const failingDoc = createFakeArticleDoc({ title: "x" });
      failingDoc.save.mockRejectedValue(new Error("save failed"));
      MockArticleModel.mockImplementationOnce(() => failingDoc);

      await expect(
        articleService.create({ title: "x", author: "author-1" }),
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
      ).rejects.toMatchObject({ statusCode: 404, message: "Article not found" });
    });

    it("should reject when the article is not published", async () => {
      const doc = createFakeArticleDoc({ id: "1", status: "draft" });
      MockArticleModel.findById.mockResolvedValue(doc);

      await expect(
        articleService.findSingleItem({ id: "1" }),
      ).rejects.toMatchObject({ statusCode: 404, message: "Article not found" });
    });

    it("should populate the author when expand includes 'author'", async () => {
      const doc = createFakeArticleDoc({ id: "1", status: "published" });
      MockArticleModel.findById.mockResolvedValue(doc);

      await articleService.findSingleItem({ id: "1", expand: "author" });

      expect(doc.populate).toHaveBeenCalledWith({
        path: "author",
        select: "name",
      });
    });

    it("should populate public comments and strip their status/article fields when expand includes 'comments'", async () => {
      const doc = createFakeArticleDoc({
        id: "1",
        status: "published",
        comments: [
          { id: "c1", body: "hi", status: "public", article: "1" },
        ],
      });
      MockArticleModel.findById.mockResolvedValue(doc);

      const result = await articleService.findSingleItem({
        id: "1",
        expand: "comments",
      });

      expect(doc.populate).toHaveBeenCalledWith({
        path: "comments",
        match: { status: "public" },
      });
      expect(result.comments).toEqual([{ id: "c1", body: "hi" }]);
    });

    it("should trim and split multiple expand values", async () => {
      const doc = createFakeArticleDoc({
        id: "1",
        status: "published",
        comments: [],
      });
      MockArticleModel.findById.mockResolvedValue(doc);

      await articleService.findSingleItem({ id: "1", expand: " author , comments " });

      expect(doc.populate).toHaveBeenCalledWith(
        expect.objectContaining({ path: "author" }),
      );
      expect(doc.populate).toHaveBeenCalledWith(
        expect.objectContaining({ path: "comments" }),
      );
    });

    it("should propagate the error when the lookup fails", async () => {
      MockArticleModel.findById.mockRejectedValue(new Error("db down"));

      await expect(
        articleService.findSingleItem({ id: "1" }),
      ).rejects.toThrow("db down");
    });
  });

  describe("updateOrCreate", () => {
    it("should create a new article when it does not exist and a valid title is given", async () => {
      MockArticleModel.findById.mockResolvedValue(null);

      const result = await articleService.updateOrCreate("new-id", {
        title: "New Article",
        author: "author-1",
      });

      expect(result.statusCode).toBe(201);
      expect(result.article).toMatchObject({
        title: "New Article",
        author: "author-1",
      });
    });

    it("should reject creation when the title is missing", async () => {
      MockArticleModel.findById.mockResolvedValue(null);

      await expect(
        articleService.updateOrCreate("new-id", { author: "author-1" }),
      ).rejects.toMatchObject({ statusCode: 400, error: "Bad request" });
    });

    it("should update an existing article and return statusCode 200", async () => {
      const doc = createFakeArticleDoc({
        id: "1",
        title: "Old title",
        body: "old body",
        cover: "old.png",
        status: "published",
        author: "author-1",
      });
      MockArticleModel.findById.mockResolvedValue(doc);

      const result = await articleService.updateOrCreate("1", {
        title: "New title",
        author: "author-1",
      });

      expect(result.statusCode).toBe(200);
      expect(result.article.title).toBe("New title");
      expect(doc.save).toHaveBeenCalledTimes(1);
    });

    it("BUG: resets an existing draft article's status back to 'published' on update (see Bugs Discovered)", async () => {
      const doc = createFakeArticleDoc({
        id: "1",
        title: "Draft article",
        status: "draft",
        author: "author-1",
      });
      MockArticleModel.findById.mockResolvedValue(doc);

      // Caller does not intend to change status at all - only the title.
      const result = await articleService.updateOrCreate("1", {
        title: "Updated title",
        author: "author-1",
      });

      // Actual (buggy) behavior: status silently flips to "published"
      // because `status` defaults to defaults.articleStatus whenever the
      // caller omits it, and that default always wins over the article's
      // current status in the merge step.
      expect(result.article.status).toBe("published");
    });

    it("should propagate the error when the lookup fails", async () => {
      MockArticleModel.findById.mockRejectedValue(new Error("db down"));

      await expect(
        articleService.updateOrCreate("1", { title: "x", author: "a" }),
      ).rejects.toThrow("db down");
    });

    it("should propagate the error when saving the update fails", async () => {
      const doc = createFakeArticleDoc({ id: "1", status: "published" });
      doc.save.mockRejectedValue(new Error("save failed"));
      MockArticleModel.findById.mockResolvedValue(doc);

      await expect(
        articleService.updateOrCreate("1", { title: "x", author: "a" }),
      ).rejects.toThrow("save failed");
    });
  });

  describe("updateItemPatch", () => {
    it("should partially update only the provided fields", async () => {
      const doc = createFakeArticleDoc({
        id: "1",
        title: "Old title",
        body: "old body",
        cover: "old.png",
        status: "draft",
      });
      MockArticleModel.findById.mockResolvedValue(doc);

      const result = await articleService.updateItemPatch("1", {
        title: "New title",
      });

      expect(result.title).toBe("New title");
      // Fields not provided should remain unchanged (no forced defaults).
      expect(result.body).toBe("old body");
      expect(result.status).toBe("draft");
    });

    it("should allow updating only the status", async () => {
      const doc = createFakeArticleDoc({ id: "1", status: "draft" });
      MockArticleModel.findById.mockResolvedValue(doc);

      const result = await articleService.updateItemPatch("1", {
        status: "published",
      });

      expect(result.status).toBe("published");
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

  describe("deleteItem", () => {
    it("should delete an article by id", async () => {
      const deletedDoc = createFakeArticleDoc({ id: "1" });
      MockArticleModel.findByIdAndDelete.mockResolvedValue(deletedDoc);

      const result = await articleService.deleteItem("1");

      expect(MockArticleModel.findByIdAndDelete).toHaveBeenCalledWith("1");
      expect(result).toBe(deletedDoc);
    });

    it("should resolve to null without throwing when the article does not exist", async () => {
      MockArticleModel.findByIdAndDelete.mockResolvedValue(null);

      const result = await articleService.deleteItem("missing");

      expect(result).toBeNull();
    });

    it("should propagate the error when deletion fails", async () => {
      MockArticleModel.findByIdAndDelete.mockRejectedValue(
        new Error("db down"),
      );

      await expect(articleService.deleteItem("1")).rejects.toThrow("db down");
    });
  });

  describe("deleteMany", () => {
    it("should delete multiple articles matching a filter", async () => {
      MockArticleModel.deleteMany.mockResolvedValue({ deletedCount: 2 });

      const result = await articleService.deleteMany({ author: "author-1" });

      expect(MockArticleModel.deleteMany).toHaveBeenCalledWith({
        author: "author-1",
      });
      expect(result).toBe(true);
    });

    it("should propagate the error when deletion fails", async () => {
      MockArticleModel.deleteMany.mockRejectedValue(new Error("db down"));

      await expect(articleService.deleteMany({})).rejects.toThrow("db down");
    });
  });

  describe("findArticlesByUser", () => {
    it("should return only the ids of a user's articles", async () => {
      const chain = createQueryChain([{ _id: "a1" }, { _id: "a2" }]);
      MockArticleModel.find.mockReturnValue(chain);

      const result = await articleService.findArticlesByUser("author-1");

      expect(MockArticleModel.find).toHaveBeenCalledWith({
        author: "author-1",
      });
      expect(chain.select).toHaveBeenCalledWith("_id");
      expect(result).toEqual(["a1", "a2"]);
    });

    it("should return an empty array when the user has no articles", async () => {
      const chain = createQueryChain([]);
      MockArticleModel.find.mockReturnValue(chain);

      const result = await articleService.findArticlesByUser("author-1");

      expect(result).toEqual([]);
    });
  });

  describe("checkOwner", () => {
    it("should return true when the user owns the article", async () => {
      const doc = createFakeArticleDoc({ id: "1", author: "user-1" });
      MockArticleModel.findById.mockResolvedValue(doc);

      const result = await articleService.checkOwner({
        resourceId: "1",
        userId: "user-1",
      });

      expect(result).toBe(true);
    });

    it("should return false when the user does not own the article", async () => {
      const doc = createFakeArticleDoc({ id: "1", author: "user-1" });
      MockArticleModel.findById.mockResolvedValue(doc);

      const result = await articleService.checkOwner({
        resourceId: "1",
        userId: "someone-else",
      });

      expect(result).toBe(false);
    });

    it("should return null when the article is missing and allowMissing is true", async () => {
      MockArticleModel.findById.mockResolvedValue(null);

      const result = await articleService.checkOwner({
        resourceId: "missing",
        userId: "user-1",
        allowMissing: true,
      });

      expect(result).toBeNull();
    });

    it("should reject when the article is missing and allowMissing is false", async () => {
      MockArticleModel.findById.mockResolvedValue(null);

      await expect(
        articleService.checkOwner({ resourceId: "missing", userId: "user-1" }),
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it("should propagate the error when the lookup fails", async () => {
      MockArticleModel.findById.mockRejectedValue(new Error("db down"));

      await expect(
        articleService.checkOwner({ resourceId: "1", userId: "user-1" }),
      ).rejects.toThrow("db down");
    });
  });
});
