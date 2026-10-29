/**
 * Create an Error with HTTP `statusCode`, `error` title, and optional `data`.
 *
 * @param {Object} [params={}] - Error fields.
 * @param {number} [params.statusCode=500] - HTTP status code.
 * @param {string} [params.error="Internal server error"] - Error title.
 * @param {string} [params.message] - Human-readable message. Falls back to "Internal server error" when empty.
 * @param {*} [params.data] - Extra details (for example validation issues).
 * @returns {Error} Error with HTTP properties.
 */
const createError = ({
  statusCode = 500,
  error = "Internal server error",
  message,
  data,
} = {}) => {
  // Create native Error instance
  const err = new Error(message || "Internal server error");

  // Attach HTTP status code and error type
  err.statusCode = statusCode;
  err.error = error;

  // Attach data only when provided so the property is absent otherwise.
  if (data !== undefined) {
    err.data = data;
  }

  return err;
};

/**
 * Create a 400 Bad Request error.
 *
 * @param {Array<Object>} data - Validation error details.
 * @param {string} [message="invalid input"] - Error message.
 * @returns {Error} Error with HTTP status 400.
 */
const badRequest = (data, message = "invalid input") =>
  createError({
    statusCode: 400,
    error: "Bad request",
    message,
    data,
  });

/**
 * Create a 401 Unauthorized error.
 *
 * @param {string} [message="You don't have the right permission."] - Error message.
 * @returns {Error} Error with HTTP status 401.
 */
const unauthorized = (message = "You don't have the right permission.") =>
  createError({
    statusCode: 401,
    error: "Unauthorized",
    message,
  });

/**
 * Create a 403 Forbidden error.
 *
 * @param {string} [message="Permission denied"] - Error message.
 * @returns {Error} Error with HTTP status 403.
 */
const forbidden = (message = "Permission denied") =>
  createError({
    statusCode: 403,
    error: "Forbidden",
    message,
  });

/**
 * Create a 404 Not Found error.
 *
 * @param {string} [message="Requested resource not found"] - Error message.
 * @returns {Error} Error with HTTP status 404.
 */
const notFound = (message = "Requested resource not found") =>
  createError({
    statusCode: 404,
    error: "Not found",
    message,
  });

/**
 * Create a 409 Conflict error.
 *
 * @param {string} [message="Resource already exists"] - Error message.
 * @returns {Error} Error with HTTP status 409.
 */
const conflict = (message = "Resource already exists") =>
  createError({
    statusCode: 409,
    error: "Conflict",
    message,
  });

/**
 * Create a 500 Internal Server Error.
 *
 * @param {string} [message="Internal server error"] - Error message.
 * @returns {Error} Error with HTTP status 500.
 */
const serverError = (message = "Internal server error") =>
  createError({
    statusCode: 500,
    error: "Internal server error",
    message,
  });

/**
 * Map Multer, Mongoose, and duplicate-key errors to HTTP errors; pass others through.
 *
 * Errors that already have a truthy `statusCode` are returned unchanged.
 *
 * @param {Error} err - Error raised while handling a request.
 * @returns {Error} Mapped HTTP error, or the original error.
 */
const toHttpError = (err) => {
  if (err.statusCode) {
    return err;
  }

  // file upload limits and unexpected fields
  if (err.name === "MulterError") {
    // Only the file size limit gets a specific message; other Multer errors are generic.
    const message =
      err.code === "LIMIT_FILE_SIZE" ? "file is too large" : "invalid input";

    // Fall back to the "cover" field name when Multer does not report one.
    return badRequest(
      [{ field: err.field || "cover", message, in: "file" }],
      "invalid input",
    );
  }

  // malformed values such as an invalid ObjectId
  if (err.name === "CastError") {
    return badRequest(
      [{ field: err.path, message: "invalid input", in: "body" }],
      "invalid input",
    );
  }

  // schema validation failures
  if (err.name === "ValidationError" && err.errors) {
    // Report each invalid field with a generic message.
    return badRequest(
      Object.keys(err.errors).map((field) => ({
        field,
        message: "invalid input",
        in: "body",
      })),
      "invalid input",
    );
  }

  // MongoDB duplicate key (for example two sign-ups with the same email)
  if (err.code === 11000) {
    return conflict();
  }

  return err;
};

module.exports = {
  toHttpError,
  badRequest,
  unauthorized,
  forbidden,
  conflict,
  notFound,
  serverError,
};
