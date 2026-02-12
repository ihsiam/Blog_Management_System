const createError = ({
  statusCode = 500,
  error = "Internal server error",
  message,
  data,
} = {}) => {
  const err = new Error(message || "Internal server error");
  err.statusCode = statusCode;
  err.error = error;
  if (data !== undefined) err.data = data;
  return err;
};

// 400 error
const badRequest = (data, message = "invalid input") =>
  createError({
    statusCode: 400,
    error: "Bad request",
    message,
    data,
  });

// 401 error
const unauthorized = (message = "You don't have the right permission.") =>
  createError({
    statusCode: 401,
    error: "Unauthorized",
    message,
  });

// 403 error
const forbidden = (message = "Permission denied") =>
  createError({
    statusCode: 403,
    error: "Forbidden",
    message,
  });

// 404 error
const notFound = (message = "Requested resource not found") =>
  createError({
    statusCode: 404,
    error: "Not found",
    message,
  });

module.exports = {
  badRequest,
  unauthorized,
  forbidden,
  notFound,
};
