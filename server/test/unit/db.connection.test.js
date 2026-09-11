/**
 * Unit tests for src/db/connection.js
 *
 * Dependencies mocked:
 * - mongoose (real MongoDB connections must never happen in unit tests)
 *
 * Note: connection.js registers module-level listeners on
 * `mongoose.connection`, so the mock must supply a `connection` object
 * with an `on` method to avoid a TypeError at require time.
 */

const mockConnect = jest.fn();

// Capture which events were registered at module-load time using a plain
// array. clearMocks:true resets jest.fn() call history between tests but
// does NOT touch plain variables, so registeredListeners survives.
const registeredListeners = [];
const mockConnectionOn = jest.fn().mockImplementation((event) => {
  registeredListeners.push(event);
});

jest.doMock("mongoose", () => ({
  connect: mockConnect,
  connection: { on: mockConnectionOn },
}));

const connectDB = require("../../src/db/connection");

describe("connectDB (src/db/connection)", () => {
  let consoleLogSpy;
  const originalDbUrl = process.env.DB_URL;

  beforeEach(() => {
    mockConnect.mockReset();
    mockConnectionOn.mockReset();
    consoleLogSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
    if (originalDbUrl !== undefined) {
      process.env.DB_URL = originalDbUrl;
    } else {
      delete process.env.DB_URL;
    }
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

    // Pass retries=1 so the function returns after one successful call.
    await connectDB(1, 0);

    expect(mockConnect).toHaveBeenCalledWith("mongodb://localhost:27017/test", {
      serverSelectionTimeoutMS: 5000,
    });
    expect(consoleLogSpy).toHaveBeenCalledWith(
      "Database connected successfully",
    );
  });

  it("should propagate the error when all retry attempts fail", async () => {
    process.env.DB_URL = "mongodb://localhost:27017/test";
    const connError = new Error("ECONNREFUSED");
    mockConnect.mockRejectedValue(connError);

    // Use retries=1 and delayMs=0 for a fast, deterministic test.
    await expect(connectDB(1, 0)).rejects.toThrow("ECONNREFUSED");
  });

  it("should log each failed attempt before giving up", async () => {
    process.env.DB_URL = "mongodb://localhost:27017/test";
    mockConnect.mockRejectedValue(new Error("ECONNREFUSED"));

    await expect(connectDB(2, 0)).rejects.toThrow();

    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining("DB connection attempt 1/2 failed"),
    );
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining("DB connection attempt 2/2 failed"),
    );
  });

  it("should register 'disconnected' and 'error' listeners on mongoose.connection at load time", () => {
    // Listeners are registered when the module is first loaded (before any
    // test runs). registeredListeners is a plain array so clearMocks:true
    // cannot reset it between tests.
    expect(registeredListeners).toContain("disconnected");
    expect(registeredListeners).toContain("error");
  });
});
