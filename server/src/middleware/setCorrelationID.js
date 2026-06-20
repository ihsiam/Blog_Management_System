/**
 * Middleware to set or propagate correlation ID for request tracing.
 *
 * - If client sends `x-correlation-id`, it is reused
 * - Otherwise a new ID is generated using timestamp
 * - ID is attached to request headers and response headers
 */
const setCorrelationID = (req, res, next) => {
  const HEADER_KEY = "x-correlation-id";

  // use existing correlation ID or generate a new one
  const correlationID = req.headers[HEADER_KEY] || Date.now().toString();

  // attach to request for downstream services/logging
  req.headers[HEADER_KEY] = correlationID;

  // expose to client for traceability
  res.set(HEADER_KEY, correlationID);

  next();
};

module.exports = setCorrelationID;
