/**
 * Unit tests for src/api/v1/user/controllers/deleteUser.js
 *
 * Dependencies mocked:
 * - src/lib/service registry (deleteUser orchestration)
 */

const mockDeleteUser = jest.fn();
jest.doMock("../../../src/lib/service registry", () => ({
  deleteUser: mockDeleteUser,
}));

const deleteUserController = require("../../../src/api/v1/user/controllers/deleteUser");
const { createMockResponse } = require("../helpers/mockExpress");

describe("user deleteUser controller", () => {
  let res;
  let next;

  const validId = "507f1f77bcf86cd799439011";

  beforeEach(() => {
    mockDeleteUser.mockReset();
    res = createMockResponse();
    res.end = jest.fn().mockReturnValue(res);
    next = jest.fn();
  });

  it("should reject an invalid user id", async () => {
    const req = { params: { id: "not-an-id" } };

    await deleteUserController(req, res, next);

    expect(mockDeleteUser).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 400 }),
    );
  });

  it("should delete the user and respond with 204 No Content", async () => {
    mockDeleteUser.mockResolvedValue(true);

    const req = { params: { id: validId } };
    await deleteUserController(req, res, next);

    expect(mockDeleteUser).toHaveBeenCalledWith(validId);
    expect(res.status).toHaveBeenCalledWith(204);
    expect(res.end).toHaveBeenCalledTimes(1);
    expect(next).not.toHaveBeenCalled();
  });

  it("should propagate the error when the user does not exist", async () => {
    const notFoundError = Object.assign(new Error("Not found"), {
      statusCode: 404,
    });
    mockDeleteUser.mockRejectedValue(notFoundError);

    const req = { params: { id: validId } };
    await deleteUserController(req, res, next);

    expect(next).toHaveBeenCalledWith(notFoundError);
    expect(res.status).not.toHaveBeenCalled();
  });
});
