/**
 * Unit tests for src/lib/categories/index.js
 *
 * Dependencies mocked:
 * - src/model/Category (Mongoose model)
 */

const createQueryChain = (result) => {
  const chain = {};
  chain.sort = jest.fn().mockReturnValue(chain);
  chain.skip = jest.fn().mockReturnValue(chain);
  chain.limit = jest.fn().mockReturnValue(chain);
  chain.then = (resolve, reject) =>
    Promise.resolve(result).then(resolve, reject);
  chain.catch = (reject) => Promise.resolve(result).catch(reject);
  return chain;
};

const createFakeCategoryDoc = (data) => {
  const doc = { ...data };
  doc.save = jest.fn().mockResolvedValue(undefined);
  doc.toObject = jest.fn(() => {
    const { save, toObject, ...rest } = doc;
    return rest;
  });
  return doc;
};

const MockCategoryModel = jest.fn((data) => createFakeCategoryDoc(data));
MockCategoryModel.find = jest.fn();
MockCategoryModel.countDocuments = jest.fn();
MockCategoryModel.findOne = jest.fn();
MockCategoryModel.findById = jest.fn();

jest.doMock("../../../src/model/Category", () => MockCategoryModel);

const categoryService = require("../../../src/lib/categories");

describe("category service (src/lib/categories)", () => {
  beforeEach(() => {
    MockCategoryModel.mockClear();
    MockCategoryModel.find.mockReset();
    MockCategoryModel.countDocuments.mockReset();
    MockCategoryModel.findOne.mockReset();
    MockCategoryModel.findById.mockReset();
  });

  describe("findAll", () => {
    it("should filter active categories and apply sorting and pagination", async () => {
      const first = createFakeCategoryDoc({ id: "1", name: "Tech" });
      const chain = createQueryChain([first]);
      MockCategoryModel.find.mockReturnValue(chain);

      const result = await categoryService.findAll({
        page: 2,
        limit: 5,
        sortBy: "name",
        sortType: "asc",
        searchTerm: "tech",
      });

      expect(MockCategoryModel.find).toHaveBeenCalledWith({
        name: { $regex: "tech", $options: "i" },
        status: "active",
      });
      expect(chain.sort).toHaveBeenCalledWith("name");
      expect(chain.skip).toHaveBeenCalledWith(5);
      expect(chain.limit).toHaveBeenCalledWith(5);
      expect(result).toEqual([{ id: "1", name: "Tech" }]);
    });

    it("should use a descending sort key when requested", async () => {
      const chain = createQueryChain([]);
      MockCategoryModel.find.mockReturnValue(chain);

      await categoryService.findAll({
        sortBy: "createdAt",
        sortType: "desc",
      });

      expect(chain.sort).toHaveBeenCalledWith("-createdAt");
    });

    it("should propagate database errors", async () => {
      MockCategoryModel.find.mockReturnValue(
        createQueryChain(Promise.reject(new Error("db down"))),
      );

      await expect(categoryService.findAll({})).rejects.toThrow("db down");
    });
  });

  describe("count", () => {
    it("should count active categories matching the search term", async () => {
      MockCategoryModel.countDocuments.mockResolvedValue(3);

      await expect(categoryService.count({ searchTerm: "tech" })).resolves.toBe(
        3,
      );
      expect(MockCategoryModel.countDocuments).toHaveBeenCalledWith({
        name: { $regex: "tech", $options: "i" },
        status: "active",
      });
    });
  });

  describe("create", () => {
    it("should save and return the category object", async () => {
      const result = await categoryService.create({
        name: "Technology",
        description: "Tech",
      });

      expect(MockCategoryModel).toHaveBeenCalledWith({
        name: "Technology",
        description: "Tech",
      });
      const doc = MockCategoryModel.mock.results[0].value;
      expect(doc.save).toHaveBeenCalled();
      expect(result).toEqual({ name: "Technology", description: "Tech" });
    });

    it("should propagate save errors", async () => {
      const doc = createFakeCategoryDoc({ name: "Technology" });
      doc.save.mockRejectedValue(new Error("save failed"));
      MockCategoryModel.mockImplementationOnce(() => doc);

      await expect(
        categoryService.create({ name: "Technology" }),
      ).rejects.toThrow("save failed");
    });
  });

  describe("findSingleItem", () => {
    it("should find only active categories by default", async () => {
      const category = createFakeCategoryDoc({ id: "1", name: "Tech" });
      MockCategoryModel.findOne.mockResolvedValue(category);

      await expect(
        categoryService.findSingleItem({ id: "1" }),
      ).resolves.toEqual({ id: "1", name: "Tech" });
      expect(MockCategoryModel.findOne).toHaveBeenCalledWith({
        _id: "1",
        status: "active",
      });
    });

    it("should include unavailable categories when requested", async () => {
      const category = createFakeCategoryDoc({
        id: "1",
        status: "unavailable",
      });
      MockCategoryModel.findOne.mockResolvedValue(category);

      await categoryService.findSingleItem({
        id: "1",
        includeUnavailable: true,
      });

      expect(MockCategoryModel.findOne).toHaveBeenCalledWith({ _id: "1" });
    });

    it("should reject when the category does not exist", async () => {
      MockCategoryModel.findOne.mockResolvedValue(null);

      await expect(
        categoryService.findSingleItem({ id: "missing" }),
      ).rejects.toMatchObject({
        statusCode: 404,
      });
    });
  });

  describe("updateItemPatch", () => {
    it("should update the name and description and save", async () => {
      const category = createFakeCategoryDoc({
        id: "1",
        name: "Old",
        description: "Old description",
      });
      MockCategoryModel.findById.mockResolvedValue(category);

      const result = await categoryService.updateItemPatch("1", {
        name: "New",
        description: "New description",
      });

      expect(MockCategoryModel.findById).toHaveBeenCalledWith("1");
      expect(category.name).toBe("New");
      expect(category.description).toBe("New description");
      expect(category.save).toHaveBeenCalled();
      expect(result).toMatchObject({
        name: "New",
        description: "New description",
      });
    });

    it("should preserve the description when it is omitted", async () => {
      const category = createFakeCategoryDoc({ id: "1", description: "Keep" });
      MockCategoryModel.findById.mockResolvedValue(category);

      await categoryService.updateItemPatch("1", { name: "New" });

      expect(category.description).toBe("Keep");
    });
  });

  describe("updateStatus", () => {
    it("should update and save the category status", async () => {
      const category = createFakeCategoryDoc({ id: "1", status: "active" });
      MockCategoryModel.findById.mockResolvedValue(category);

      const result = await categoryService.updateStatus("1", "unavailable");

      expect(category.status).toBe("unavailable");
      expect(category.save).toHaveBeenCalled();
      expect(result).toMatchObject({ status: "unavailable" });
    });

    it("should reject when the category does not exist", async () => {
      MockCategoryModel.findById.mockResolvedValue(null);

      await expect(
        categoryService.updateStatus("missing", "active"),
      ).rejects.toMatchObject({ statusCode: 404 });
    });
  });
});
