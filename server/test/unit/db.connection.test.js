/**
 * Unit tests for src/db/connection.js
 *
 * Dependencies mocked:
 * - mongoose (real MongoDB connections must never happen in unit tests)
 */

const mockConnect = jest.fn();
jest.doMock("mongoose", () => ({ connect: mockConnect }));

const connectDB = require("../../src/db/connection");

describe("connectDB (src/db/connection)", () => {
  let consoleLogSpy;
  const originalDbUrl = process.env.DB_URL;

  beforeEach(() => {
    mockConnect.mockReset();
    consoleLogSpy = jest.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
    process.env.DB_URL = originalDbUrl;
  });

  it("should reject when DB_URL is not defined", async () => {
    delete process.env.DB_URL;

    await expect(connectDB()).rejects.toThrow(
      "DB_URL is not defined in environment variables",
    );
    expect(mockConnect).not.toHaveBeenCalled();
  });

  it("should connect using the configured DB_URL and log success", async () => {
    process.env.DB_URL = "mongodb://localhost:27017/test";
    mockConnect.mockResolvedValue(undefined);

    await connectDB();

    expect(mockConnect).toHaveBeenCalledWith(
      "mongodb://localhost:27017/test",
      {},
    );
    expect(consoleLogSpy).toHaveBeenCalledWith(
      "Database connected successfully",
    );
  });

  it("should propagate the error when the connection attempt fails", async () => {
    process.env.DB_URL = "mongodb://localhost:27017/test";
    mockConnect.mockRejectedValue(new Error("ECONNREFUSED"));

    await expect(connectDB()).rejects.toThrow("ECONNREFUSED");
  });
});
