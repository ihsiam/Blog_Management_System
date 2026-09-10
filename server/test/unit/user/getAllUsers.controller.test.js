/**
 * Unit tests for src/api/v1/user/controllers/getAllUsers.js
 *
 * Dependencies mocked:
 * - src/lib/user (getAllUsers, countTotal)
 */

const mockGetAllUsers = jest.fn();
const mockCountTotal = jest.fn();
jest.doMock("../../../src/lib/user", () => ({
  getAllUsers: mockGetAllUsers,
  countTotal: mockCountTotal,
}));

const getAllUsersController = require("../../../src/api/v1/user/controllers/getAllUsers");
const { createMockResponse } = require("../helpers/mockExpress");

describe("user getAllUsers controller", () => {
  let res;
  let next;

  beforeEach(() => {
    mockGetAllUsers.mockReset();
    mockCountTotal.mockReset();
    res = createMockResponse();
    next = jest.fn();
  });

  const buildRequest = (query = {}) => ({
    query,
    url: "/api/v1/users",
    path: "/api/v1/users",
  });

  describe("input validation", () => {
    it("should reject an invalid page number", async () => {
      const req = buildRequest({ page: "0" });

      await getAllUsersController(req, res, next);

      expect(mockGetAllUsers).not.toHaveBeenCalled();
      const err = next.mock.calls[0][0];
      expect(err.data).toEqual(
        expect.arrayContaining([expect.objectContaining({ field: "page" })]),
      );
    });

    it("should reject an invalid limit", async () => {
      const req = buildRequest({ limit: "0" });

      await getAllUsersController(req, res, next);

      const err = next.mock.calls[0][0];
      expect(err.data).toEqual(
        expect.arrayContaining([expect.objectContaining({ field: "limit" })]),
      );
    });

    it("should reject an invalid sortBy field", async () => {
      const req = buildRequest({ sortBy: "role" });

      await getAllUsersController(req, res, next);

      const err = next.mock.calls[0][0];
      expect(err.data).toEqual(
        expect.arrayContaining([expect.objectContaining({ field: "sort_by" })]),
      );
    });

    it("should reject an invalid status filter", async () => {
      const req = buildRequest({ status: "archived" });

      await getAllUsersController(req, res, next);

      expect(mockGetAllUsers).not.toHaveBeenCalled();
      const err = next.mock.calls[0][0];
      expect(err.data).toEqual(
        expect.arrayContaining([expect.objectContaining({ field: "status" })]),
      );
    });
  });

  describe("successful retrieval", () => {
    it("should forward name/email/status filters to the service", async () => {
      mockGetAllUsers.mockResolvedValue([]);
      mockCountTotal.mockResolvedValue(0);

      const req = buildRequest({
        name: "jane",
        email: "jane@test.com",
        status: "approved",
      });
      await getAllUsersController(req, res, next);

      expect(mockGetAllUsers).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "jane",
          email: "jane@test.com",
          status: "approved",
        }),
      );
      expect(mockCountTotal).toHaveBeenCalledWith({
        name: "jane",
        email: "jane@test.com",
        status: "approved",
      });
    });

    it("should return sanitized, paginated user data", async () => {
      mockGetAllUsers.mockResolvedValue([
        {
          id: "1",
          name: "Jane",
          email: "jane@test.com",
          role: "user",
          status: "approved",
          password: "should-not-leak",
          createdAt: "2024-01-01",
          updatedAt: "2024-01-01",
        },
      ]);
      mockCountTotal.mockResolvedValue(1);

      await getAllUsersController(buildRequest(), res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      const payload = res.json.mock.calls[0][0];
      expect(payload.data).toEqual([
        {
          id: "1",
          name: "Jane",
          email: "jane@test.com",
          role: "user",
          status: "approved",
          createdAt: "2024-01-01",
          updatedAt: "2024-01-01",
        },
      ]);
      expect(payload.data[0].password).toBeUndefined();
      expect(next).not.toHaveBeenCalled();
    });

    it("should return an empty list when there are no matching users", async () => {
      mockGetAllUsers.mockResolvedValue([]);
      mockCountTotal.mockResolvedValue(0);

      await getAllUsersController(buildRequest(), res, next);

      const payload = res.json.mock.calls[0][0];
      expect(payload.data).toEqual([]);
    });
  });

  describe("dependency failures", () => {
    it("should propagate the error when fetching users fails", async () => {
      const dbError = new Error("db down");
      mockGetAllUsers.mockRejectedValue(dbError);

      await getAllUsersController(buildRequest(), res, next);

      expect(next).toHaveBeenCalledWith(dbError);
    });

    it("should propagate the error when counting users fails", async () => {
      mockGetAllUsers.mockResolvedValue([]);
      const dbError = new Error("db down");
      mockCountTotal.mockRejectedValue(dbError);

      await getAllUsersController(buildRequest(), res, next);

      expect(next).toHaveBeenCalledWith(dbError);
    });
  });
});
