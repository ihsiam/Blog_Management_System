/**
 * Unit tests for src/api/v1/category/controllers/updateStatus.js
 *
 * Dependencies mocked:
 * - src/lib/categories (updateStatus)
 */

const mockUpdateStatus = jest.fn();
jest.doMock("../../../src/lib/categories", () => ({
  updateStatus: mockUpdateStatus,
}));

const updateStatusController = require("../../../src/api/v1/category/controllers/updateStatus");
const { createMockResponse } = require("../helpers/mockExpress");

describe("category updateStatus controller", () => {
  let res;
  let next;
  const id = "507f1f77bcf86cd799439011";

  beforeEach(() => {
    mockUpdateStatus.mockReset();
    res = createMockResponse();
    next = jest.fn();
  });

  it("should reject an invalid status", async () => {
    await updateStatusController(
      { params: { id }, body: { status: "archived" } },
      res,
      next,
    );

    expect(mockUpdateStatus).not.toHaveBeenCalled();
    expect(next.mock.calls[0][0].data).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "status" })]),
    );
  });

  it("should update the category status", async () => {
    const category = { id, status: "unavailable" };
    mockUpdateStatus.mockResolvedValue(category);

    await updateStatusController(
      { params: { id }, body: { status: "unavailable" } },
      res,
      next,
    );

    expect(mockUpdateStatus).toHaveBeenCalledWith(id, "unavailable");
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      code: 200,
      message: "Category status updated",
      data: category,
      links: { self: `/api/v1/categories/${id}` },
    });
  });

  it("should propagate a service error", async () => {
    const serviceError = new Error("db down");
    mockUpdateStatus.mockRejectedValue(serviceError);

    await updateStatusController(
      { params: { id }, body: { status: "active" } },
      res,
      next,
    );

    expect(next).toHaveBeenCalledWith(serviceError);
  });
});
