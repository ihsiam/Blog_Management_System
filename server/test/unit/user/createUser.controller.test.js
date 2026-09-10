/**
 * Unit tests for src/api/v1/user/controllers/createUser.js
 *
 * Dependencies mocked:
 * - src/lib/user (createUserByAdmin)
 */

const mockCreateUserByAdmin = jest.fn();
jest.doMock("../../../src/lib/user", () => ({
  createUserByAdmin: mockCreateUserByAdmin,
}));

const createUserController = require("../../../src/api/v1/user/controllers/createUser");
const { createMockResponse } = require("../helpers/mockExpress");

describe("user createUser controller", () => {
  let res;
  let next;

  const validBody = {
    name: "Jane",
    email: "jane@test.com",
    password: "strong-password",
  };

  beforeEach(() => {
    mockCreateUserByAdmin.mockReset();
    res = createMockResponse();
    next = jest.fn();
  });

  describe("input validation", () => {
    it("should reject when required fields are missing", async () => {
      const req = { body: {} };

      await createUserController(req, res, next);

      expect(mockCreateUserByAdmin).not.toHaveBeenCalled();
      const err = next.mock.calls[0][0];
      expect(err).toMatchObject({ statusCode: 400 });
      expect(err.data).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: "name" }),
          expect.objectContaining({ field: "email" }),
          expect.objectContaining({ field: "password" }),
        ]),
      );
    });

    it("should reject an invalid email format", async () => {
      const req = { body: { ...validBody, email: "invalid" } };

      await createUserController(req, res, next);

      expect(mockCreateUserByAdmin).not.toHaveBeenCalled();
      const err = next.mock.calls[0][0];
      expect(err.data).toEqual([
        { field: "email", message: "invalid input", in: "body" },
      ]);
    });

    it("should reject a password shorter than 8 characters", async () => {
      const req = { body: { ...validBody, password: "short" } };

      await createUserController(req, res, next);

      expect(mockCreateUserByAdmin).not.toHaveBeenCalled();
      const err = next.mock.calls[0][0];
      expect(err.data).toEqual([
        {
          field: "password",
          message: "Password must be at least 8 character",
          in: "body",
        },
      ]);
    });
  });

  describe("successful creation", () => {
    it("should create the user via the admin service and return the sanitized result", async () => {
      const createdUser = { id: "1", name: "Jane", email: "jane@test.com" };
      mockCreateUserByAdmin.mockResolvedValue(createdUser);

      const req = { body: validBody };
      await createUserController(req, res, next);

      expect(mockCreateUserByAdmin).toHaveBeenCalledWith(validBody);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        code: 201,
        message: "Account created",
        data: createdUser,
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe("dependency failures", () => {
    it("should propagate the error when the email already exists", async () => {
      const conflictError = Object.assign(new Error("Validation error"), {
        statusCode: 400,
      });
      mockCreateUserByAdmin.mockRejectedValue(conflictError);

      const req = { body: validBody };
      await createUserController(req, res, next);

      expect(next).toHaveBeenCalledWith(conflictError);
      expect(res.status).not.toHaveBeenCalled();
    });
  });
});
