/**
 * Unit tests for src/api/v1/article/controllers/deleteItem.js
 *
 * Dependencies mocked:
 * - src/lib/service registry (deleteArticle orchestration)
 */

const mockDeleteArticle = jest.fn();
jest.doMock("../../../src/lib/service registry", () => ({
  deleteArticle: mockDeleteArticle,
}));

const deleteItemController = require("../../../src/api/v1/article/controllers/deleteItem");
const { createMockResponse } = require("../helpers/mockExpress");

describe("article deleteItem controller", () => {
  let res;
  let next;

  const validId = "507f1f77bcf86cd799439011";

  beforeEach(() => {
    mockDeleteArticle.mockReset();
    res = createMockResponse();
    res.end = jest.fn().mockReturnValue(res);
    next = jest.fn();
  });

  it("should reject an invalid article id", async () => {
    const req = { params: { id: "not-an-id" } };

    await deleteItemController(req, res, next);

    expect(mockDeleteArticle).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 400 }),
    );
  });

  it("should delete the article and respond with 204 No Content", async () => {
    mockDeleteArticle.mockResolvedValue(true);

    const req = { params: { id: validId } };
    await deleteItemController(req, res, next);

    expect(mockDeleteArticle).toHaveBeenCalledWith(validId);
    expect(res.status).toHaveBeenCalledWith(204);
    expect(res.end).toHaveBeenCalledTimes(1);
    expect(next).not.toHaveBeenCalled();
  });

  it("should propagate the error when the article does not exist", async () => {
    const notFoundError = Object.assign(new Error("Not found"), {
      statusCode: 404,
    });
    mockDeleteArticle.mockRejectedValue(notFoundError);

    const req = { params: { id: validId } };
    await deleteItemController(req, res, next);

    expect(next).toHaveBeenCalledWith(notFoundError);
    expect(res.status).not.toHaveBeenCalled();
  });
});
