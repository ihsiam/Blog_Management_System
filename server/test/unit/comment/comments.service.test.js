/**
 * Unit tests for src/lib/comments/index.js
 *
 * The only real dependency of this module is the Mongoose `Comment`
 * model, so it is mocked here to avoid any real database access.
 * `src/config/defaults` and `src/utils/error` are pure/dependency-free
 * and are left real.
 */

/**
 * Builds a fake Mongoose-like query object that supports the same
 * chainable calls used by the service (`populate`, `sort`, `skip`,
 * `limit`) and resolves to `result` when awaited, just like a real
 * Mongoose Query.
 */
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

/**
 * Builds a fake Mongoose document: a plain object augmented with
 * `save` and `toObject` so service code can call them exactly like it
 * would on a real document.
 */
const createFakeCommentDoc = (data) => {
  const doc = { ...data };
  doc.save = jest.fn().mockResolvedValue(undefined);
  doc.toObject = jest.fn(() => {
    const { save, toObject, ...rest } = doc;
    return rest;
  });
  return doc;
};

const MockCommentModel = jest.fn((data) => createFakeCommentDoc(data));
MockCommentModel.find = jest.fn();
MockCommentModel.findById = jest.fn();
MockCommentModel.findByIdAndDelete = jest.fn();
MockCommentModel.deleteMany = jest.fn();
MockCommentModel.countDocuments = jest.fn();

jest.doMock("../../../src/model/Comment", () => MockCommentModel);

const commentService = require("../../../src/lib/comments");

describe("comment service (src/lib/comments)", () => {
  beforeEach(() => {
    MockCommentModel.find.mockReset();
    MockCommentModel.findById.mockReset();
    MockCommentModel.findByIdAndDelete.mockReset();
    MockCommentModel.deleteMany.mockReset();
    MockCommentModel.countDocuments.mockReset();
  });

  describe("getCommentsByArticle", () => {
    it("should return comments for an article with author populated and pagination applied", async () => {
      const docs = [
        createFakeCommentDoc({ id: "c1", body: "hi" }),
        createFakeCommentDoc({ id: "c2", body: "hello" }),
      ];
      const chain = createQueryChain(docs);
      MockCommentModel.find.mockReturnValue(chain);

      const result = await commentService.getCommentsByArticle({
        articleID: "article-1",
        page: 2,
        limit: 5,
      });

      expect(MockCommentModel.find).toHaveBeenCalledWith({
        article: "article-1",
      });
      expect(chain.populate).toHaveBeenCalledWith({
        path: "author",
        select: "name",
      });
      expect(chain.skip).toHaveBeenCalledWith(5); // page(2) * limit(5) - limit(5)
      expect(chain.limit).toHaveBeenCalledWith(5);
      expect(result).toEqual([
        { id: "c1", body: "hi" },
        { id: "c2", body: "hello" },
      ]);
    });

    it("should filter by status when provided", async () => {
      const chain = createQueryChain([]);
      MockCommentModel.find.mockReturnValue(chain);

      await commentService.getCommentsByArticle({
        articleID: "article-1",
        status: "public",
      });

      expect(MockCommentModel.find).toHaveBeenCalledWith({
        article: "article-1",
        status: "public",
      });
    });

    it("should return an empty array when the article has no comments", async () => {
      const chain = createQueryChain([]);
      MockCommentModel.find.mockReturnValue(chain);

      const result = await commentService.getCommentsByArticle({
        articleID: "article-1",
      });

      expect(result).toEqual([]);
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
    it("should build a filter using postId and status when provided", async () => {
      const chain = createQueryChain([]);
      MockCommentModel.find.mockReturnValue(chain);

      await commentService.getAllComments({
        postId: "article-1",
        status: "hidden",
        sortKey: "-createdAt",
      });

      expect(MockCommentModel.find).toHaveBeenCalledWith({
        article: "article-1",
        status: "hidden",
      });
      expect(chain.sort).toHaveBeenCalledWith("-createdAt");
    });

    it("should use an empty filter when neither postId nor status is provided", async () => {
      const chain = createQueryChain([]);
      MockCommentModel.find.mockReturnValue(chain);

      await commentService.getAllComments({});

      expect(MockCommentModel.find).toHaveBeenCalledWith({});
    });

    it("should return mapped plain objects", async () => {
      const docs = [createFakeCommentDoc({ id: "c1" })];
      const chain = createQueryChain(docs);
      MockCommentModel.find.mockReturnValue(chain);

      const result = await commentService.getAllComments({});

      expect(result).toEqual([{ id: "c1" }]);
    });

    it("should propagate the error when the query fails", async () => {
      const chain = createQueryChain(null);
      chain.then = (_resolve, reject) =>
        Promise.reject(new Error("db down")).catch(reject);
      MockCommentModel.find.mockReturnValue(chain);

      await expect(commentService.getAllComments({})).rejects.toThrow(
        "db down",
      );
    });
  });

  describe("count", () => {
    it("should count using article and status filters when provided", async () => {
      MockCommentModel.countDocuments.mockResolvedValue(4);

      const result = await commentService.count({
        article: "article-1",
        status: "public",
      });

      expect(MockCommentModel.countDocuments).toHaveBeenCalledWith({
        article: "article-1",
        status: "public",
      });
      expect(result).toBe(4);
    });

    it("should use an empty filter when neither article nor status is provided", async () => {
      MockCommentModel.countDocuments.mockResolvedValue(0);

      await commentService.count({});

      expect(MockCommentModel.countDocuments).toHaveBeenCalledWith({});
    });

    it("should propagate the error when counting fails", async () => {
      MockCommentModel.countDocuments.mockRejectedValue(new Error("db down"));

      await expect(commentService.count({})).rejects.toThrow("db down");
    });
  });

  describe("create", () => {
    it("should create and persist a new comment with the default status", async () => {
      const result = await commentService.create({
        articleID: "article-1",
        body: "hi",
        author: "user-1",
      });

      expect(result).toMatchObject({
        body: "hi",
        status: "public",
        article: "article-1",
        author: "user-1",
      });
    });

    it("should use an explicitly provided status instead of the default", async () => {
      const result = await commentService.create({
        articleID: "article-1",
        body: "hi",
        author: "user-1",
        status: "hidden",
      });

      expect(result.status).toBe("hidden");
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
    it("should update only the body when only body is provided", async () => {
      const doc = createFakeCommentDoc({
        id: "c1",
        body: "old",
        status: "public",
      });
      MockCommentModel.findById.mockResolvedValue(doc);

      const result = await commentService.updateComment({
        id: "c1",
        body: "new",
      });

      expect(result.body).toBe("new");
      expect(result.status).toBe("public");
      expect(doc.save).toHaveBeenCalledTimes(1);
    });

    it("should update only the status when only status is provided", async () => {
      const doc = createFakeCommentDoc({
        id: "c1",
        body: "unchanged",
        status: "public",
      });
      MockCommentModel.findById.mockResolvedValue(doc);

      const result = await commentService.updateComment({
        id: "c1",
        status: "hidden",
      });

      expect(result.status).toBe("hidden");
      expect(result.body).toBe("unchanged");
    });

    it("should update both body and status when both are provided", async () => {
      const doc = createFakeCommentDoc({
        id: "c1",
        body: "old",
        status: "public",
      });
      MockCommentModel.findById.mockResolvedValue(doc);

      const result = await commentService.updateComment({
        id: "c1",
        body: "new",
        status: "hidden",
      });

      expect(result).toMatchObject({ body: "new", status: "hidden" });
    });

    it("should reject when the comment does not exist", async () => {
      MockCommentModel.findById.mockResolvedValue(null);

      await expect(
        commentService.updateComment({ id: "missing", body: "x" }),
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it("should propagate the error when saving fails", async () => {
      const doc = createFakeCommentDoc({ id: "c1" });
      doc.save.mockRejectedValue(new Error("save failed"));
      MockCommentModel.findById.mockResolvedValue(doc);

      await expect(
        commentService.updateComment({ id: "c1", body: "x" }),
      ).rejects.toThrow("save failed");
    });
  });

  describe("deleteItem", () => {
    it("should delete a comment by id", async () => {
      const deletedDoc = createFakeCommentDoc({ id: "c1" });
      MockCommentModel.findByIdAndDelete.mockResolvedValue(deletedDoc);

      const result = await commentService.deleteItem("c1");

      expect(MockCommentModel.findByIdAndDelete).toHaveBeenCalledWith("c1");
      expect(result).toBe(true);
    });

    it("should reject when the comment does not exist", async () => {
      MockCommentModel.findByIdAndDelete.mockResolvedValue(null);

      await expect(commentService.deleteItem("missing")).rejects.toMatchObject({
        statusCode: 404,
      });
    });

    it("should propagate the error when deletion fails", async () => {
      MockCommentModel.findByIdAndDelete.mockRejectedValue(
        new Error("db down"),
      );

      await expect(commentService.deleteItem("c1")).rejects.toThrow("db down");
    });
  });

  describe("deleteMany", () => {
    it("should delete multiple comments matching a filter", async () => {
      MockCommentModel.deleteMany.mockResolvedValue({ deletedCount: 3 });

      const result = await commentService.deleteMany({ article: "article-1" });

      expect(MockCommentModel.deleteMany).toHaveBeenCalledWith({
        article: "article-1",
      });
      expect(result).toBe(true);
    });

    it("should propagate the error when deletion fails", async () => {
      MockCommentModel.deleteMany.mockRejectedValue(new Error("db down"));

      await expect(commentService.deleteMany({})).rejects.toThrow("db down");
    });
  });

  describe("checkOwner", () => {
    it("should return true when the user owns the comment", async () => {
      const doc = createFakeCommentDoc({ id: "c1", author: "user-1" });
      MockCommentModel.findById.mockResolvedValue(doc);

      const result = await commentService.checkOwner({
        resourceId: "c1",
        userId: "user-1",
      });

      expect(result).toBe(true);
    });

    it("should return false when the user does not own the comment", async () => {
      const doc = createFakeCommentDoc({ id: "c1", author: "user-1" });
      MockCommentModel.findById.mockResolvedValue(doc);

      const result = await commentService.checkOwner({
        resourceId: "c1",
        userId: "someone-else",
      });

      expect(result).toBe(false);
    });

    it("should reject when the comment does not exist", async () => {
      MockCommentModel.findById.mockResolvedValue(null);

      await expect(
        commentService.checkOwner({ resourceId: "missing", userId: "user-1" }),
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it("should propagate the error when the lookup fails", async () => {
      MockCommentModel.findById.mockRejectedValue(new Error("db down"));

      await expect(
        commentService.checkOwner({ resourceId: "c1", userId: "user-1" }),
      ).rejects.toThrow("db down");
    });
  });
});
