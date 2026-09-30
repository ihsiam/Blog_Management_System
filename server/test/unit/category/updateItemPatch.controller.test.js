/**
 * Unit tests for src/api/v1/category/controllers/updateItemPatch.js
 *
 * Dependencies mocked:
 * - src/lib/categories (updateItemPatch)
 */

const mockUpdateItemPatch = jest.fn();
jest.doMock("../../../src/lib/categories", () => ({
  updateItemPatch: mockUpdateItemPatch,
}));

const updateItemPatchController = require("../../../src/api/v1/category/controllers/updateItemPatch");
const { createMockResponse } = require("../helpers/mockExpress");

describe("category updateItemPatch controller", () => {
  let res;
  let next;
  const id = "507f1f77bcf86cd799439011";
  const validBody = { name: " Technology ", description: "Tech" };

  beforeEach(() => {
    mockUpdateItemPatch.mockReset();
    res = createMockResponse();
    next = jest.fn();
  });

  it("should reject an invalid id and name", async () => {
    await updateItemPatchController(
      { params: { id: "bad" }, body: { name: "" } },
      res,
      next,
    );

    expect(mockUpdateItemPatch).not.toHaveBeenCalled();
    expect(next.mock.calls[0][0].data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "id" }),
        expect.objectContaining({ field: "name" }),
      ]),
    );
  });

  it("should trim the name and return the updated category", async () => {
    const category = { id, name: "Technology", description: "Tech" };
    mockUpdateItemPatch.mockResolvedValue(category);

    await updateItemPatchController(
      { params: { id }, body: validBody },
      res,
      next,
    );

    expect(mockUpdateItemPatch).toHaveBeenCalledWith(id, {
      name: "Technology",
      description: "Tech",
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      code: 200,
      message: "Successfully updated category",
      data: category,
      links: { self: `/api/v1/categories/${id}` },
    });
  });

  it("should convert duplicate-name errors to a conflict", async () => {
    mockUpdateItemPatch.mockRejectedValue({ code: 11000 });

    await updateItemPatchController(
      { params: { id }, body: validBody },
      res,
      next,
    );

    expect(next.mock.calls[0][0]).toMatchObject({ statusCode: 409 });
  });
});
