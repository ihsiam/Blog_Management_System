/**
 * Unit tests for src/lib/user/index.js
 *
 * Dependencies mocked:
 * - src/model/User (Mongoose model) - to avoid any real database access.
 * - src/utils (hashing)             - to isolate from bcrypt.
 *
 * `src/config/defaults` and `src/utils/error` are pure/dependency-free
 * and are left real.
 */

const createQueryChain = (result) => {
  const chain = {};
  chain.populate = jest.fn().mockReturnValue(chain);
  chain.sort = jest.fn().mockReturnValue(chain);
  chain.skip = jest.fn().mockReturnValue(chain);
  chain.limit = jest.fn().mockReturnValue(chain);
  chain.select = jest.fn().mockReturnValue(chain);
  chain.then = (resolve, reject) => Promise.resolve(result).then(resolve, reject);
  chain.catch = (reject) => Promise.resolve(result).catch(reject);
  return chain;
};

const createFakeUserDoc = (data) => {
  const doc = { ...data };
  doc.save = jest.fn().mockResolvedValue(undefined);
  doc.populate = jest.fn().mockResolvedValue(doc);
  doc.toObject = jest.fn(() => {
    const { save, populate, toObject, ...rest } = doc;
    return rest;
  });
  return doc;
};

const MockUserModel = jest.fn(function userModelCtor(data) {
  return createFakeUserDoc(data);
});
MockUserModel.find = jest.fn();
MockUserModel.findOne = jest.fn();
MockUserModel.findById = jest.fn();
MockUserModel.findByIdAndUpdate = jest.fn();
MockUserModel.findByIdAndDelete = jest.fn();
MockUserModel.countDocuments = jest.fn();

jest.doMock("../../../src/model/User", () => MockUserModel);

const mockGenerateHash = jest.fn();
jest.doMock("../../../src/utils", () => ({
  hashing: { generateHash: mockGenerateHash },
}));

const userService = require("../../../src/lib/user");

describe("user service (src/lib/user)", () => {
  beforeEach(() => {
    MockUserModel.find.mockReset();
    MockUserModel.findOne.mockReset();
    MockUserModel.findById.mockReset();
    MockUserModel.findByIdAndUpdate.mockReset();
    MockUserModel.findByIdAndDelete.mockReset();
    MockUserModel.countDocuments.mockReset();
    mockGenerateHash.mockReset();
  });

  describe("findUserByEmail", () => {
    it("should return a sanitized user object when found", async () => {
      const doc = createFakeUserDoc({ id: "1", email: "jane@test.com" });
      MockUserModel.findOne.mockResolvedValue(doc);

      const result = await userService.findUserByEmail("jane@test.com");

      expect(MockUserModel.findOne).toHaveBeenCalledWith({
        email: "jane@test.com",
      });
      expect(result).toEqual({ id: "1", email: "jane@test.com" });
    });

    it("should return null when the user does not exist", async () => {
      MockUserModel.findOne.mockResolvedValue(null);

      const result = await userService.findUserByEmail("missing@test.com");

      expect(result).toBeNull();
    });

    it("should propagate the error when the lookup fails", async () => {
      MockUserModel.findOne.mockRejectedValue(new Error("db down"));

      await expect(
        userService.findUserByEmail("jane@test.com"),
      ).rejects.toThrow("db down");
    });
  });

  describe("findAuthUserById", () => {
    it("should return the raw document (including password/refreshToken) for internal auth use", async () => {
      const rawDoc = { id: "1", password: "hashed", refreshToken: "token" };
      MockUserModel.findById.mockResolvedValue(rawDoc);

      const result = await userService.findAuthUserById("1");

      expect(MockUserModel.findById).toHaveBeenCalledWith("1");
      expect(result).toBe(rawDoc);
    });

    it("should propagate the error when the lookup fails", async () => {
      MockUserModel.findById.mockRejectedValue(new Error("db down"));

      await expect(userService.findAuthUserById("1")).rejects.toThrow(
        "db down",
      );
    });
  });

  describe("findUserById", () => {
    it("should return a sanitized user object without password/refreshToken", async () => {
      const doc = createFakeUserDoc({ id: "1", name: "Jane" });
      const chain = createQueryChain(doc);
      MockUserModel.findById.mockReturnValue(chain);

      const result = await userService.findUserById("1");

      expect(chain.select).toHaveBeenCalledWith("-password -refreshToken");
      expect(result).toEqual({ id: "1", name: "Jane" });
    });

    it("should return null when the user does not exist", async () => {
      const chain = createQueryChain(null);
      MockUserModel.findById.mockReturnValue(chain);

      const result = await userService.findUserById("missing");

      expect(result).toBeNull();
    });

    it("should propagate the error when the lookup fails", async () => {
      const chain = createQueryChain(null);
      chain.then = (_resolve, reject) =>
        Promise.reject(new Error("db down")).catch(reject);
      MockUserModel.findById.mockReturnValue(chain);

      await expect(userService.findUserById("1")).rejects.toThrow("db down");
    });
  });

  describe("userExist", () => {
    it("should return true when a user with the email exists", async () => {
      MockUserModel.findOne.mockResolvedValue(createFakeUserDoc({ id: "1" }));

      await expect(userService.userExist("jane@test.com")).resolves.toBe(true);
    });

    it("should return false when no user has the email", async () => {
      MockUserModel.findOne.mockResolvedValue(null);

      await expect(userService.userExist("missing@test.com")).resolves.toBe(
        false,
      );
    });
  });

  describe("adminExist", () => {
    it("should return true when at least one admin exists", async () => {
      MockUserModel.find.mockResolvedValue([createFakeUserDoc({ id: "1" })]);

      await expect(userService.adminExist()).resolves.toBe(true);
      expect(MockUserModel.find).toHaveBeenCalledWith({ role: "admin" });
    });

    it("should return false when no admin exists", async () => {
      MockUserModel.find.mockResolvedValue([]);

      await expect(userService.adminExist()).resolves.toBe(false);
    });

    it("should propagate the error when the lookup fails", async () => {
      MockUserModel.find.mockRejectedValue(new Error("db down"));

      await expect(userService.adminExist()).rejects.toThrow("db down");
    });
  });

  describe("createAdmin", () => {
    it("should create an admin user with an approved status", async () => {
      const result = await userService.createAdmin({
        name: "Admin",
        email: "admin@test.com",
        password: "hashed-password",
      });

      expect(result).toMatchObject({
        name: "Admin",
        email: "admin@test.com",
        password: "hashed-password",
        role: "admin",
        status: "approved",
      });
    });

    it("should propagate the error when saving fails", async () => {
      const failingDoc = createFakeUserDoc({ name: "Admin" });
      failingDoc.save.mockRejectedValue(new Error("save failed"));
      MockUserModel.mockImplementationOnce(() => failingDoc);

      await expect(
        userService.createAdmin({
          name: "Admin",
          email: "admin@test.com",
          password: "x",
        }),
      ).rejects.toThrow("save failed");
    });
  });

  describe("createUser", () => {
    it("should create a user with the given fields", async () => {
      const result = await userService.createUser({
        name: "Jane",
        email: "jane@test.com",
        password: "hashed-password",
      });

      expect(result).toMatchObject({
        name: "Jane",
        email: "jane@test.com",
        password: "hashed-password",
      });
    });

    it("should propagate the error when saving fails", async () => {
      const failingDoc = createFakeUserDoc({ name: "Jane" });
      failingDoc.save.mockRejectedValue(new Error("save failed"));
      MockUserModel.mockImplementationOnce(() => failingDoc);

      await expect(
        userService.createUser({ name: "Jane", email: "j@test.com", password: "x" }),
      ).rejects.toThrow("save failed");
    });
  });

  describe("createUserByAdmin", () => {
    it("should create an approved user with a hashed password and no sensitive fields returned", async () => {
      MockUserModel.findOne.mockResolvedValue(null); // userExist -> false
      mockGenerateHash.mockResolvedValue("hashed-password");

      const result = await userService.createUserByAdmin({
        name: "Jane",
        email: "jane@test.com",
        password: "plain-password",
      });

      expect(mockGenerateHash).toHaveBeenCalledWith("plain-password");
      expect(result).toMatchObject({
        name: "Jane",
        email: "jane@test.com",
        status: "approved",
      });
      expect(result.password).toBeUndefined();
      expect(result.refreshToken).toBeUndefined();
    });

    it("should reject when the email already exists", async () => {
      MockUserModel.findOne.mockResolvedValue(createFakeUserDoc({ id: "1" }));

      await expect(
        userService.createUserByAdmin({
          name: "Jane",
          email: "jane@test.com",
          password: "plain-password",
        }),
      ).rejects.toMatchObject({
        statusCode: 400,
        error: "Bad request",
        data: [{ field: "email", message: "User already exists", in: "body" }],
      });
      expect(mockGenerateHash).not.toHaveBeenCalled();
    });

    it("should propagate the error when hashing fails", async () => {
      MockUserModel.findOne.mockResolvedValue(null);
      mockGenerateHash.mockRejectedValue(new Error("hashing failed"));

      await expect(
        userService.createUserByAdmin({
          name: "Jane",
          email: "jane@test.com",
          password: "x",
        }),
      ).rejects.toThrow("hashing failed");
    });

    it("should propagate the error when saving fails", async () => {
      MockUserModel.findOne.mockResolvedValue(null);
      mockGenerateHash.mockResolvedValue("hashed-password");
      const failingDoc = createFakeUserDoc({ name: "Jane" });
      failingDoc.save.mockRejectedValue(new Error("save failed"));
      MockUserModel.mockImplementationOnce(() => failingDoc);

      await expect(
        userService.createUserByAdmin({
          name: "Jane",
          email: "jane@test.com",
          password: "x",
        }),
      ).rejects.toThrow("save failed");
    });
  });

  describe("saveRefreshToken / clearRefreshToken", () => {
    it("should persist the given refresh token", async () => {
      MockUserModel.findByIdAndUpdate.mockResolvedValue(undefined);

      await userService.saveRefreshToken("1", "new-refresh-token");

      expect(MockUserModel.findByIdAndUpdate).toHaveBeenCalledWith("1", {
        $set: { refreshToken: "new-refresh-token" },
      });
    });

    it("should clear the refresh token", async () => {
      MockUserModel.findByIdAndUpdate.mockResolvedValue(undefined);

      await userService.clearRefreshToken("1");

      expect(MockUserModel.findByIdAndUpdate).toHaveBeenCalledWith("1", {
        $set: { refreshToken: null },
      });
    });

    it("should propagate the error when persisting the refresh token fails", async () => {
      MockUserModel.findByIdAndUpdate.mockRejectedValue(new Error("db down"));

      await expect(
        userService.saveRefreshToken("1", "token"),
      ).rejects.toThrow("db down");
    });
  });

  describe("getAllUsers", () => {
    it("should build a filter from name/email/status and apply sorting and pagination", async () => {
      const docs = [createFakeUserDoc({ id: "1" })];
      const chain = createQueryChain(docs);
      MockUserModel.find.mockReturnValue(chain);

      const result = await userService.getAllUsers({
        page: 2,
        limit: 5,
        sortBy: "email",
        sortType: "asc",
        name: "jane",
        email: "jane@test.com",
        status: "approved",
      });

      expect(MockUserModel.find).toHaveBeenCalledWith({
        email: { $regex: "jane@test.com", $options: "i" },
        name: { $regex: "jane", $options: "i" },
        status: "approved",
      });
      expect(chain.sort).toHaveBeenCalledWith("email");
      expect(chain.skip).toHaveBeenCalledWith(5);
      expect(chain.limit).toHaveBeenCalledWith(5);
      expect(result).toEqual([{ id: "1" }]);
    });

    it("should use an empty filter and a descending sort key by default", async () => {
      const chain = createQueryChain([]);
      MockUserModel.find.mockReturnValue(chain);

      await userService.getAllUsers({});

      expect(MockUserModel.find).toHaveBeenCalledWith({});
      expect(chain.sort).toHaveBeenCalledWith("-updatedAt");
    });

    it("should return an empty array when nothing matches", async () => {
      const chain = createQueryChain([]);
      MockUserModel.find.mockReturnValue(chain);

      const result = await userService.getAllUsers({});

      expect(result).toEqual([]);
    });

    it("should propagate the error when the query fails", async () => {
      const chain = createQueryChain(null);
      chain.then = (_resolve, reject) =>
        Promise.reject(new Error("db down")).catch(reject);
      MockUserModel.find.mockReturnValue(chain);

      await expect(userService.getAllUsers({})).rejects.toThrow("db down");
    });
  });

  describe("countTotal", () => {
    it("should count using the same filters as getAllUsers", async () => {
      MockUserModel.countDocuments.mockResolvedValue(7);

      const result = await userService.countTotal({
        name: "jane",
        email: "jane@test.com",
        status: "approved",
      });

      expect(MockUserModel.countDocuments).toHaveBeenCalledWith({
        email: { $regex: "jane@test.com", $options: "i" },
        name: { $regex: "jane", $options: "i" },
        status: "approved",
      });
      expect(result).toBe(7);
    });

    it("should use an empty filter when no filters are provided", async () => {
      MockUserModel.countDocuments.mockResolvedValue(0);

      await userService.countTotal({});

      expect(MockUserModel.countDocuments).toHaveBeenCalledWith({});
    });

    it("should propagate the error when counting fails", async () => {
      MockUserModel.countDocuments.mockRejectedValue(new Error("db down"));

      await expect(userService.countTotal({})).rejects.toThrow("db down");
    });
  });

  describe("getSingleUser", () => {
    it("should return the sanitized user with no expansion by default", async () => {
      const doc = createFakeUserDoc({ id: "1", name: "Jane" });
      const chain = createQueryChain(doc);
      MockUserModel.findById.mockReturnValue(chain);

      const result = await userService.getSingleUser({ id: "1" });

      expect(chain.select).toHaveBeenCalledWith("-password -refreshToken");
      expect(doc.populate).not.toHaveBeenCalled();
      expect(result).toEqual({ id: "1", name: "Jane" });
    });

    it("should reject when the user does not exist", async () => {
      const chain = createQueryChain(null);
      MockUserModel.findById.mockReturnValue(chain);

      await expect(
        userService.getSingleUser({ id: "missing" }),
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it("should populate articles when expand includes 'articles'", async () => {
      const doc = createFakeUserDoc({ id: "1" });
      const chain = createQueryChain(doc);
      MockUserModel.findById.mockReturnValue(chain);

      await userService.getSingleUser({ id: "1", expand: "articles" });

      expect(doc.populate).toHaveBeenCalledWith({
        path: "articles",
        select: "title status -author",
      });
    });

    it("should populate comments when expand includes 'comments'", async () => {
      const doc = createFakeUserDoc({ id: "1" });
      const chain = createQueryChain(doc);
      MockUserModel.findById.mockReturnValue(chain);

      await userService.getSingleUser({ id: "1", expand: "comments" });

      expect(doc.populate).toHaveBeenCalledWith({
        path: "comments",
        select: "body status article -author",
      });
    });

    it("should trim and split multiple expand values", async () => {
      const doc = createFakeUserDoc({ id: "1" });
      const chain = createQueryChain(doc);
      MockUserModel.findById.mockReturnValue(chain);

      await userService.getSingleUser({ id: "1", expand: " articles , comments " });

      expect(doc.populate).toHaveBeenCalledTimes(2);
    });

    it("should propagate the error when the lookup fails", async () => {
      const chain = createQueryChain(null);
      chain.then = (_resolve, reject) =>
        Promise.reject(new Error("db down")).catch(reject);
      MockUserModel.findById.mockReturnValue(chain);

      await expect(userService.getSingleUser({ id: "1" })).rejects.toThrow(
        "db down",
      );
    });
  });

  describe("updateUser", () => {
    it("should update only the provided fields", async () => {
      const updatedDoc = createFakeUserDoc({ id: "1", name: "New name" });
      const chain = createQueryChain(updatedDoc);
      MockUserModel.findByIdAndUpdate.mockReturnValue(chain);

      const result = await userService.updateUser({ id: "1", name: "New name" });

      expect(MockUserModel.findByIdAndUpdate).toHaveBeenCalledWith(
        "1",
        { $set: { name: "New name" } },
        { new: true, runValidators: true },
      );
      expect(chain.select).toHaveBeenCalledWith("-password -refreshToken");
      expect(result).toEqual({ id: "1", name: "New name" });
    });

    it("should build an empty payload when no fields are provided", async () => {
      const chain = createQueryChain(createFakeUserDoc({ id: "1" }));
      MockUserModel.findByIdAndUpdate.mockReturnValue(chain);

      await userService.updateUser({ id: "1" });

      expect(MockUserModel.findByIdAndUpdate).toHaveBeenCalledWith(
        "1",
        { $set: {} },
        { new: true, runValidators: true },
      );
    });

    it("should reject when the user does not exist", async () => {
      const chain = createQueryChain(null);
      MockUserModel.findByIdAndUpdate.mockReturnValue(chain);

      await expect(
        userService.updateUser({ id: "missing", name: "x" }),
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it("should propagate the error when the update fails", async () => {
      const chain = createQueryChain(null);
      chain.then = (_resolve, reject) =>
        Promise.reject(new Error("db down")).catch(reject);
      MockUserModel.findByIdAndUpdate.mockReturnValue(chain);

      await expect(
        userService.updateUser({ id: "1", name: "x" }),
      ).rejects.toThrow("db down");
    });
  });

  describe("updatePassword", () => {
    it("should hash the new password before persisting it", async () => {
      mockGenerateHash.mockResolvedValue("hashed-password");
      const updatedDoc = createFakeUserDoc({ id: "1" });
      const chain = createQueryChain(updatedDoc);
      MockUserModel.findByIdAndUpdate.mockReturnValue(chain);

      await userService.updatePassword({ id: "1", password: "new-password" });

      expect(mockGenerateHash).toHaveBeenCalledWith("new-password");
      expect(MockUserModel.findByIdAndUpdate).toHaveBeenCalledWith(
        "1",
        { $set: { password: "hashed-password" } },
        { new: true, runValidators: true },
      );
    });

    it("OBSERVATION: only excludes password, not refreshToken, from the returned object", async () => {
      mockGenerateHash.mockResolvedValue("hashed-password");
      const updatedDoc = createFakeUserDoc({
        id: "1",
        refreshToken: "still-present",
      });
      const chain = createQueryChain(updatedDoc);
      MockUserModel.findByIdAndUpdate.mockReturnValue(chain);

      const result = await userService.updatePassword({
        id: "1",
        password: "new-password",
      });

      expect(chain.select).toHaveBeenCalledWith("-password");
      // Unlike findUserById/getSingleUser/updateUser (which exclude both
      // "-password -refreshToken"), this function's query only excludes
      // "-password" - refreshToken passes through untouched. See "Bugs
      // discovered" in the final report; no controller currently
      // forwards this return value in an HTTP response, so it isn't
      // exploitable today, but it is an inconsistent contract.
      expect(result.refreshToken).toBe("still-present");
    });

    it("should not hash or set a password field when password is omitted", async () => {
      const chain = createQueryChain(createFakeUserDoc({ id: "1" }));
      MockUserModel.findByIdAndUpdate.mockReturnValue(chain);

      await userService.updatePassword({ id: "1" });

      expect(mockGenerateHash).not.toHaveBeenCalled();
      expect(MockUserModel.findByIdAndUpdate).toHaveBeenCalledWith(
        "1",
        { $set: {} },
        { new: true, runValidators: true },
      );
    });

    it("should reject when the user does not exist", async () => {
      const chain = createQueryChain(null);
      MockUserModel.findByIdAndUpdate.mockReturnValue(chain);
      mockGenerateHash.mockResolvedValue("hashed-password");

      await expect(
        userService.updatePassword({ id: "missing", password: "x" }),
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it("should propagate the error when hashing fails", async () => {
      mockGenerateHash.mockRejectedValue(new Error("hashing failed"));

      await expect(
        userService.updatePassword({ id: "1", password: "x" }),
      ).rejects.toThrow("hashing failed");
    });
  });

  describe("deleteItem", () => {
    it("should return true when the user was deleted", async () => {
      MockUserModel.findByIdAndDelete.mockResolvedValue(createFakeUserDoc({ id: "1" }));

      const result = await userService.deleteItem("1");

      expect(MockUserModel.findByIdAndDelete).toHaveBeenCalledWith("1");
      expect(result).toBe(true);
    });

    it("should return false without throwing when the user does not exist", async () => {
      MockUserModel.findByIdAndDelete.mockResolvedValue(null);

      const result = await userService.deleteItem("missing");

      expect(result).toBe(false);
    });

    it("should propagate the error when deletion fails", async () => {
      MockUserModel.findByIdAndDelete.mockRejectedValue(new Error("db down"));

      await expect(userService.deleteItem("1")).rejects.toThrow("db down");
    });
  });

  describe("checkOwner", () => {
    it("should return true when the ids match", async () => {
      MockUserModel.findById.mockResolvedValue(createFakeUserDoc({ id: "user-1" }));

      const result = await userService.checkOwner({
        resourceId: "user-1",
        userId: "user-1",
      });

      expect(result).toBe(true);
    });

    it("should return false when the ids do not match", async () => {
      MockUserModel.findById.mockResolvedValue(createFakeUserDoc({ id: "user-1" }));

      const result = await userService.checkOwner({
        resourceId: "user-1",
        userId: "user-2",
      });

      expect(result).toBe(false);
    });

    it("should reject when the user does not exist", async () => {
      MockUserModel.findById.mockResolvedValue(null);

      await expect(
        userService.checkOwner({ resourceId: "missing", userId: "user-1" }),
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it("should propagate the error when the lookup fails", async () => {
      MockUserModel.findById.mockRejectedValue(new Error("db down"));

      await expect(
        userService.checkOwner({ resourceId: "1", userId: "1" }),
      ).rejects.toThrow("db down");
    });
  });
});
