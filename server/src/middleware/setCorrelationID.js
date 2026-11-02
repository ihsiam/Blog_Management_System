/**
 * Reuse `x-correlation-id` from the client, or assign a new UUID, on req and res.
 *
 * The ID is written to the request headers and to the response headers, so
 * later handlers and the client can both use it to trace the request.
 *
 * @param {import("express").Request} req - Express request.
 * @param {import("express").Response} res - Express response.
 * @param {import("express").NextFunction} next - Next middleware.
 * @returns {void}
 */
const setCorrelationID = (req, res, next) => {
  const HEADER_KEY = "x-correlation-id";

  // Keep the client's ID so one request can be traced across services.
  const correlationID = req.headers[HEADER_KEY] || crypto.randomUUID();

  // attach to request for downstream services/logging
  req.headers[HEADER_KEY] = correlationID;

  // expose to client for traceability
  res.set(HEADER_KEY, correlationID);

  next();
};

module.exports = setCorrelationID;
