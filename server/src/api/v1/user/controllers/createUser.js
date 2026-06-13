const { badRequest } = require("../../../../utils/error");
const userServices = require("../../../../lib/user");

/**
 * Creates a new user.
 *
 * @param {import("express").Request} req - Express request object
 * @param {Object} req.body - Request payload
 * @param {string} req.body.name - User full name
 * @param {string} req.body.email - User email address
 * @param {string} req.body.password - User password
 *
 * @param {import("express").Response} res - Express response object
 * @param {Function} next - Express error handler middleware
 *
 * @returns {Promise<void>} Returns created user response
 */
const createUser = async (req, res, next) => {
  try {
    // extract register data from request body
    const { name, email, password } = req.body;

    // collect validation errors
    const errors = [];

    // name validation
    if (!name || typeof name !== "string" || !name.trim()) {
      errors.push({ field: "name", message: "invalid input", in: "body" });
    }

    // email validation
    if (!email || typeof email !== "string") {
      errors.push({
        field: "email",
        message: "invalid input",
        in: "body",
      });
    } else {
      // email format validation
      const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

      if (!isValidEmail) {
        errors.push({
          field: "email",
          message: "invalid input",
          in: "body",
        });
      }
    }

    // password validation
    if (!password || typeof password !== "string") {
      errors.push({ field: "password", message: "invalid input", in: "body" });
    } else if (password.length < 8) {
      errors.push({
        field: "password",
        message: "Password must be at least 8 character",
        in: "body",
      });
    }

    // throw validation error if any
    if (errors.length) {
      throw badRequest(errors, "invalid input");
    }

    // create user via admin service
    const data = await userServices.createUserByAdmin({
      name,
      email,
      password,
    });

    // response
    return res.status(201).json({
      code: 201,
      message: "Account created",
      data,
    });
  } catch (err) {
    return next(err);
  }
};

module.exports = createUser;
