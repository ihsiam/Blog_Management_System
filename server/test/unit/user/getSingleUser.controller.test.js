/**
 * Unit tests for src/api/v1/user/controllers/getSingleUser.js
 *
 * Dependencies mocked:
 * - src/lib/user (getSingleUser)
 */

const mockGetSingleUser = jest.fn();
jest.doMock("../../../src/lib/user", () => ({
  getSingleUser: mockGetSingleUser,
}));

const getSingleUserController = require("../../../src/api/v1/user/controllers/getSingleUser");
const { createMockResponse } = require("../helpers/mockExpress");

describe("user getSingleUser controller", () => {
  let res;
  let next;

  const validId = "507f1f77bcf86cd799439011";

  beforeEach(() => {
    mockGetSingleUser.mockReset();
    res = createMockResponse();
    next = jest.fn();
  });

  describe("input validation", () => {
    it("should reject an invalid user id", async () => {
      const req = { params: { id: "not-an-id" }, query: {} };

      await getSingleUserController(req, res, next);

      expect(mockGetSingleUser).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 400 }),
      );
    });

    it("should reject a non-string expand value", async () => {
      const req = { params: { id: validId }, query: { expand: ["articles"] } };

      await getSingleUserController(req, res, next);

      expect(mockGetSingleUser).not.toHaveBeenCalled();
      const err = next.mock.calls[0][0];
      expect(err.data).toEqual(
        expect.arrayContaining([expect.objectContaining({ field: "expand" })]),
      );
    });
  });

  describe("successful retrieval", () => {
    it("should return the user data from the service", async () => {
      const user = { id: validId, name: "Jane" };
      mockGetSingleUser.mockResolvedValue(user);

      const req = { params: { id: validId }, query: {} };
      await getSingleUserController(req, res, next);

      expect(mockGetSingleUser).toHaveBeenCalledWith({
        id: validId,
        expand: undefined,
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        code: 200,
        message: "Data retrieved",
        data: user,
      });
      expect(next).not.toHaveBeenCalled();
    });

    it("should forward the expand query parameter", async () => {
      mockGetSingleUser.mockResolvedValue({ id: validId });

      const req = {
        params: { id: validId },
        query: { expand: "articles,comments" },
      };
      await getSingleUserController(req, res, next);

      expect(mockGetSingleUser).toHaveBeenCalledWith({
        id: validId,
        expand: "articles,comments",
      });
    });
  });

  describe("dependency failures", () => {
    it("should propagate the error when the user does not exist", async () => {
      const notFoundError = Object.assign(new Error("Not found"), {
        statusCode: 404,
      });
      mockGetSingleUser.mockRejectedValue(notFoundError);

      const req = { params: { id: validId }, query: {} };
      await getSingleUserController(req, res, next);

      expect(next).toHaveBeenCalledWith(notFoundError);
      expect(res.status).not.toHaveBeenCalled();
    });
  });
});
