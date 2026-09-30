/**
 * Unit tests for src/api/v1/category/controllers/findSingleItem.js
 *
 * Dependencies mocked:
 * - src/lib/categories (findSingleItem)
 */

const mockFindSingleItem = jest.fn();
jest.doMock("../../../src/lib/categories", () => ({
  findSingleItem: mockFindSingleItem,
}));

const findSingleItemController = require("../../../src/api/v1/category/controllers/findSingleItem");
const { createMockResponse } = require("../helpers/mockExpress");

describe("category findSingleItem controller", () => {
  let res;
  let next;

  beforeEach(() => {
    mockFindSingleItem.mockReset();
    res = createMockResponse();
    next = jest.fn();
  });

  it("should reject an invalid category id", async () => {
    await findSingleItemController({ params: { id: "invalid" } }, res, next);

    expect(mockFindSingleItem).not.toHaveBeenCalled();
    expect(next.mock.calls[0][0].data).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "id" })]),
    );
  });

  it("should return the category for a valid id", async () => {
    const category = { id: "507f1f77bcf86cd799439011", name: "Technology" };
    mockFindSingleItem.mockResolvedValue(category);

    await findSingleItemController({ params: { id: category.id } }, res, next);

    expect(mockFindSingleItem).toHaveBeenCalledWith({ id: category.id });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      code: 200,
      message: "Data retrieved",
      data: category,
      links: { self: `/api/v1/categories/${category.id}` },
    });
  });

  it("should propagate a service error", async () => {
    const serviceError = new Error("not found");
    mockFindSingleItem.mockRejectedValue(serviceError);

    await findSingleItemController(
      { params: { id: "507f1f77bcf86cd799439011" } },
      res,
      next,
    );

    expect(next).toHaveBeenCalledWith(serviceError);
  });
});
