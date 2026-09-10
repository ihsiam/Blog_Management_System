/**
 * Unit tests for src/api/v1/user/controllers/updateUser.js
 *
 * This controller has no ownership branching of its own - the route is
 * restricted to admins only at the middleware layer (already covered
 * by Phase 2's `authorize` middleware tests), so any authenticated
 * admin may update any user's name/role/status.
 *
 * Dependencies mocked:
 * - src/lib/user (updateUser)
 */

const mockUpdateUser = jest.fn();
jest.doMock("../../../src/lib/user", () => ({ updateUser: mockUpdateUser }));

const updateUserController = require("../../../src/api/v1/user/controllers/updateUser");
const { createMockResponse } = require("../helpers/mockExpress");

describe("user updateUser controller", () => {
  let res;
  let next;

  const validId = "507f1f77bcf86cd799439011";

  beforeEach(() => {
    mockUpdateUser.mockReset();
    res = createMockResponse();
    next = jest.fn();
  });

  describe("input validation", () => {
    it("should reject an invalid user id", async () => {
      const req = { params: { id: "not-an-id" }, body: {} };

      await updateUserController(req, res, next);

      expect(mockUpdateUser).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 400 }),
      );
    });

    it("should reject a blank name when provided", async () => {
      const req = { params: { id: validId }, body: { name: "   " } };

      await updateUserController(req, res, next);

      expect(mockUpdateUser).not.toHaveBeenCalled();
      const err = next.mock.calls[0][0];
      expect(err.data).toEqual(
        expect.arrayContaining([expect.objectContaining({ field: "name" })]),
      );
    });

    it("should reject a role outside of user/admin", async () => {
      const req = { params: { id: validId }, body: { role: "superadmin" } };

      await updateUserController(req, res, next);

      expect(mockUpdateUser).not.toHaveBeenCalled();
      const err = next.mock.calls[0][0];
      expect(err.data).toEqual(
        expect.arrayContaining([expect.objectContaining({ field: "role" })]),
      );
    });

    it("should reject a status outside of the allowed set", async () => {
      const req = { params: { id: validId }, body: { status: "archived" } };

      await updateUserController(req, res, next);

      expect(mockUpdateUser).not.toHaveBeenCalled();
      const err = next.mock.calls[0][0];
      expect(err.data).toEqual(
        expect.arrayContaining([expect.objectContaining({ field: "status" })]),
      );
    });
  });

  describe("successful update", () => {
    it("should forward only the fields present in the body", async () => {
      const updatedUser = { id: validId, role: "admin" };
      mockUpdateUser.mockResolvedValue(updatedUser);

      const req = { params: { id: validId }, body: { role: "admin" } };
      await updateUserController(req, res, next);

      expect(mockUpdateUser).toHaveBeenCalledWith({
        id: validId,
        name: undefined,
        role: "admin",
        status: undefined,
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        code: 200,
        message: "Account updated",
        data: updatedUser,
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe("dependency failures", () => {
    it("should propagate the error when the user does not exist", async () => {
      const notFoundError = Object.assign(new Error("Not found"), {
        statusCode: 404,
      });
      mockUpdateUser.mockRejectedValue(notFoundError);

      const req = { params: { id: validId }, body: { name: "New name" } };
      await updateUserController(req, res, next);

      expect(next).toHaveBeenCalledWith(notFoundError);
      expect(res.status).not.toHaveBeenCalled();
    });
  });
});
