/**
 * Unit tests for src/api/v1/user/controllers/changePassword.js
 *
 * Dependencies mocked:
 * - src/lib/user (findAuthUserById, updatePassword)
 * - src/utils (hashing.compareHash)
 */

const mockFindAuthUserById = jest.fn();
const mockUpdatePassword = jest.fn();
jest.doMock("../../../src/lib/user", () => ({
  findAuthUserById: mockFindAuthUserById,
  updatePassword: mockUpdatePassword,
}));

const mockCompareHash = jest.fn();
jest.doMock("../../../src/utils", () => ({
  hashing: { compareHash: mockCompareHash },
}));

const changePasswordController = require("../../../src/api/v1/user/controllers/changePassword");
const { createMockResponse } = require("../helpers/mockExpress");

describe("user changePassword controller", () => {
  let res;
  let next;

  const validId = "507f1f77bcf86cd799439011";

  beforeEach(() => {
    mockFindAuthUserById.mockReset();
    mockUpdatePassword.mockReset();
    mockCompareHash.mockReset();
    res = createMockResponse();
    next = jest.fn();
  });

  const buildRequest = (body) => ({ params: { id: validId }, body });

  describe("input validation", () => {
    it("should reject an invalid user id", async () => {
      const req = {
        params: { id: "not-an-id" },
        body: { oldPassword: "old-pass", newPassword: "new-password" },
      };

      await changePasswordController(req, res, next);

      expect(mockFindAuthUserById).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 400 }),
      );
    });

    it("should reject a missing old password", async () => {
      const req = buildRequest({ newPassword: "new-password" });

      await changePasswordController(req, res, next);

      expect(mockFindAuthUserById).not.toHaveBeenCalled();
      const err = next.mock.calls[0][0];
      expect(err.data).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: "oldPassword" }),
        ]),
      );
    });

    it("should reject a new password shorter than 8 characters", async () => {
      const req = buildRequest({ oldPassword: "old-pass", newPassword: "short" });

      await changePasswordController(req, res, next);

      expect(mockFindAuthUserById).not.toHaveBeenCalled();
      const err = next.mock.calls[0][0];
      expect(err.data).toEqual([
        {
          field: "newPassword",
          message: "Password must be at least 8 character",
          in: "body",
        },
      ]);
    });
  });

  describe("business logic", () => {
    it("should reject when the user no longer exists", async () => {
      mockFindAuthUserById.mockResolvedValue(null);

      const req = buildRequest({
        oldPassword: "old-pass",
        newPassword: "new-password",
      });
      await changePasswordController(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 401, message: "User not found" }),
      );
      expect(mockCompareHash).not.toHaveBeenCalled();
    });

    it("should reject when the old password is incorrect", async () => {
      mockFindAuthUserById.mockResolvedValue({ id: validId, password: "hashed" });
      mockCompareHash.mockResolvedValue(false);

      const req = buildRequest({
        oldPassword: "wrong-old-pass",
        newPassword: "new-password",
      });
      await changePasswordController(req, res, next);

      expect(mockCompareHash).toHaveBeenCalledWith("wrong-old-pass", "hashed");
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 401,
          message: "Old password is incorrect",
        }),
      );
      expect(mockUpdatePassword).not.toHaveBeenCalled();
    });

    it("should update the password when the old password matches", async () => {
      mockFindAuthUserById.mockResolvedValue({ id: validId, password: "hashed" });
      mockCompareHash.mockResolvedValue(true);
      mockUpdatePassword.mockResolvedValue({ id: validId });

      const req = buildRequest({
        oldPassword: "correct-old-pass",
        newPassword: "new-password",
      });
      await changePasswordController(req, res, next);

      expect(mockUpdatePassword).toHaveBeenCalledWith({
        id: validId,
        password: "new-password",
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        code: 200,
        message: "Password updated successfully",
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe("dependency failures", () => {
    it("should propagate the error when persisting the new password fails", async () => {
      mockFindAuthUserById.mockResolvedValue({ id: validId, password: "hashed" });
      mockCompareHash.mockResolvedValue(true);
      const dbError = new Error("db down");
      mockUpdatePassword.mockRejectedValue(dbError);

      const req = buildRequest({
        oldPassword: "correct-old-pass",
        newPassword: "new-password",
      });
      await changePasswordController(req, res, next);

      expect(next).toHaveBeenCalledWith(dbError);
      expect(res.status).not.toHaveBeenCalled();
    });
  });
});
