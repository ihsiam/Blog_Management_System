/**
 * Unit tests for the application bootstrap (src/index.js).
 *
 * These tests cover the server/application kickoff layer only:
 * - database connection is attempted before the HTTP server starts
 * - the HTTP server is created and started with the right configuration
 * - startup failures (DB connection failure, server listen error) are
 *   handled the way the existing implementation handles them
 * - global process-level error handlers behave as implemented
 *
 * All external dependencies (mongoose-based DB connection, the real
 * Express app, dotenv, and Node's http server) are mocked so no real
 * network, filesystem, or database access happens during these tests.
 */

// --- Mocks for everything index.js depends on -----------------------------
// Registered once at module scope; jest keeps these mocks active while we
// repeatedly re-require "../../src/index" (via jest.resetModules()) between
// tests, using fresh mock implementations/return values each time.

const mockConnectDB = jest.fn();
jest.doMock("../../src/db", () => ({ connectDB: mockConnectDB }));

const mockApp = jest.fn();
jest.doMock("../../src/app", () => mockApp);

jest.doMock("dotenv", () => ({ config: jest.fn() }));

const createServerMock = jest.fn();
jest.doMock("http", () => ({ createServer: createServerMock }));

describe("Application bootstrap (src/index.js)", () => {
  let mockServer;
  let exitSpy;
  let logSpy;
  let errorSpy;

  // process.on("unhandledRejection"/"uncaughtException", ...) are registered
  // on the real global `process` object as a side effect of requiring
  // index.js. We track exactly which handlers each require() call adds so
  // they can be removed afterwards, keeping tests isolated and preventing
  // leaked handlers from affecting other test files.
  let trackedRejectionHandlers = [];
  let trackedExceptionHandlers = [];

  const loadIndex = () => {
    const rejectionHandlersBefore = process.listeners("unhandledRejection");
    const exceptionHandlersBefore = process.listeners("uncaughtException");

    jest.resetModules();
    require("../../src/index");

    trackedRejectionHandlers = process
      .listeners("unhandledRejection")
      .filter((handler) => !rejectionHandlersBefore.includes(handler));
    trackedExceptionHandlers = process
      .listeners("uncaughtException")
      .filter((handler) => !exceptionHandlersBefore.includes(handler));
  };

  // Bootstrap's main() is async; this flushes pending microtasks so that
  // code after `await connectDB()` has had a chance to run.
  const flushPromises = () => new Promise((resolve) => setImmediate(resolve));

  beforeEach(() => {
    delete process.env.PORT;
    delete process.env.APP_URL;

    mockConnectDB.mockReset().mockResolvedValue(undefined);

    mockServer = {
      listen: jest.fn((_port, cb) => {
        if (cb) cb();
        return mockServer;
      }),
      on: jest.fn(),
    };
    createServerMock.mockReset().mockReturnValue(mockServer);

    exitSpy = jest.spyOn(process, "exit").mockImplementation(() => {});
    logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    trackedRejectionHandlers.forEach((handler) =>
      process.removeListener("unhandledRejection", handler),
    );
    trackedExceptionHandlers.forEach((handler) =>
      process.removeListener("uncaughtException", handler),
    );
    trackedRejectionHandlers = [];
    trackedExceptionHandlers = [];

    jest.restoreAllMocks();
  });

  describe("successful startup", () => {
    it("creates the HTTP server using the Express app", async () => {
      loadIndex();
      await flushPromises();

      expect(createServerMock).toHaveBeenCalledTimes(1);
      expect(createServerMock).toHaveBeenCalledWith(mockApp);
    });

    it("connects to the database before starting the server", async () => {
      loadIndex();
      await flushPromises();

      expect(mockConnectDB).toHaveBeenCalledTimes(1);
    });

    it("starts listening on the configured PORT", async () => {
      process.env.PORT = "5050";

      loadIndex();
      await flushPromises();

      expect(mockServer.listen).toHaveBeenCalledWith(
        5050,
        expect.any(Function),
      );
    });

    it("falls back to port 4000 when PORT is not configured", async () => {
      loadIndex();
      await flushPromises();

      expect(mockServer.listen).toHaveBeenCalledWith(
        4000,
        expect.any(Function),
      );
    });

    it("logs a startup message once the server is listening", async () => {
      process.env.APP_URL = "http://localhost:4000";

      loadIndex();
      await flushPromises();

      expect(logSpy).toHaveBeenCalledWith("Server is running");
      expect(logSpy).toHaveBeenCalledWith(
        "API documentation: http://localhost:4000/docs",
      );
    });

    it("registers a server error handler before listening", async () => {
      loadIndex();
      await flushPromises();

      expect(mockServer.on).toHaveBeenCalledWith(
        "error",
        expect.any(Function),
      );
    });
  });

  describe("server startup failure", () => {
    it("logs the error and exits the process when the server emits an error", async () => {
      loadIndex();
      await flushPromises();

      const [, errorHandler] = mockServer.on.mock.calls.find(
        ([event]) => event === "error",
      );
      const serverError = new Error("listen EADDRINUSE: address in use");

      errorHandler(serverError);

      expect(errorSpy).toHaveBeenCalledWith(
        "Server failed to start:",
        serverError,
      );
      expect(exitSpy).toHaveBeenCalledWith(1);
    });
  });

  describe("database connection failure", () => {
    it("does not start the HTTP server when the database connection fails", async () => {
      mockConnectDB.mockReset().mockRejectedValue(new Error("ECONNREFUSED"));

      loadIndex();
      await flushPromises();

      expect(mockServer.listen).not.toHaveBeenCalled();
    });

    it("logs the failure reason and exits the process", async () => {
      const dbError = new Error("ECONNREFUSED");
      mockConnectDB.mockReset().mockRejectedValue(dbError);

      loadIndex();
      await flushPromises();

      expect(logSpy).toHaveBeenCalledWith("DB Connection failed");
      expect(logSpy).toHaveBeenCalledWith(dbError.message);
      expect(exitSpy).toHaveBeenCalledWith(1);
    });
  });

  describe("global process error handlers", () => {
    it("logs and exits the process on an unhandled promise rejection", () => {
      loadIndex();

      expect(trackedRejectionHandlers).toHaveLength(1);

      const error = new Error("unhandled rejection boom");
      trackedRejectionHandlers[0](error);

      expect(logSpy).toHaveBeenCalledWith("Unhandled rejection:", error);
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it("logs and exits the process on an uncaught exception", () => {
      loadIndex();

      expect(trackedExceptionHandlers).toHaveLength(1);

      const error = new Error("uncaught exception boom");
      trackedExceptionHandlers[0](error);

      expect(logSpy).toHaveBeenCalledWith("Uncaught exception:", error);
      expect(exitSpy).toHaveBeenCalledWith(1);
    });
  });
});
