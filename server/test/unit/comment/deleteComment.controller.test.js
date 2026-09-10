/**
 * Unit tests for src/api/v1/comments/controllers/deleteComment.js
 *
 * Dependencies mocked:
 * - src/lib/comments (deleteItem)
 */

const mockDeleteItem = jest.fn();
jest.doMock("../../../src/lib/comments", () => ({ deleteItem: mockDeleteItem }));

const deleteCommentController = require("../../../src/api/v1/comments/controllers/deleteComment");
const { createMockResponse } = require("../helpers/mockExpress");

describe("comments deleteComment controller", () => {
  let res;
  let next;

  const validId = "507f1f77bcf86cd799439011";

  beforeEach(() => {
    mockDeleteItem.mockReset();
    res = createMockResponse();
    res.end = jest.fn().mockReturnValue(res);
    next = jest.fn();
  });

  it("should reject an invalid comment id", async () => {
    const req = { params: { id: "not-an-id" } };

    await deleteCommentController(req, res, next);

    expect(mockDeleteItem).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 400 }),
    );
  });

  it("should delete the comment and respond with 204 No Content", async () => {
    mockDeleteItem.mockResolvedValue(true);

    const req = { params: { id: validId } };
    await deleteCommentController(req, res, next);

    expect(mockDeleteItem).toHaveBeenCalledWith(validId);
    expect(res.status).toHaveBeenCalledWith(204);
    expect(res.end).toHaveBeenCalledTimes(1);
    expect(next).not.toHaveBeenCalled();
  });

  it("should propagate the error when the comment does not exist", async () => {
    const notFoundError = Object.assign(new Error("Not found"), {
      statusCode: 404,
    });
    mockDeleteItem.mockRejectedValue(notFoundError);

    const req = { params: { id: validId } };
    await deleteCommentController(req, res, next);

    expect(next).toHaveBeenCalledWith(notFoundError);
    expect(res.status).not.toHaveBeenCalled();
  });
});
