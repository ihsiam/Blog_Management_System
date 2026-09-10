/**
 * Unit tests for src/middleware/setCorrelationID.js
 *
 * `crypto.randomUUID()` is the global Web Crypto API available natively
 * in this Node runtime (no `require("crypto")` needed) - it is spied on
 * rather than mocked as a module, since it isn't imported as one.
 */

const setCorrelationID = require("../../../src/middleware/setCorrelationID");

describe("setCorrelationID middleware", () => {
  let next;

  beforeEach(() => {
    next = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should reuse an existing correlation id from the request headers", () => {
    const req = { headers: { "x-correlation-id": "existing-id" } };
    const res = { set: jest.fn() };

    setCorrelationID(req, res, next);

    expect(req.headers["x-correlation-id"]).toBe("existing-id");
    expect(res.set).toHaveBeenCalledWith("x-correlation-id", "existing-id");
    expect(next).toHaveBeenCalledWith();
  });

  it("should generate a new correlation id when none is provided", () => {
    jest.spyOn(crypto, "randomUUID").mockReturnValue("generated-uuid");

    const req = { headers: {} };
    const res = { set: jest.fn() };

    setCorrelationID(req, res, next);

    expect(req.headers["x-correlation-id"]).toBe("generated-uuid");
    expect(res.set).toHaveBeenCalledWith("x-correlation-id", "generated-uuid");
    expect(next).toHaveBeenCalledWith();
  });

  it("should call next exactly once", () => {
    const req = { headers: {} };
    const res = { set: jest.fn() };

    setCorrelationID(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });
});
