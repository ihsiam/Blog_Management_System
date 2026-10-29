const { badRequest } = require("../../../../utils/error");
const userServices = require("../../../../lib/user");
const { validation } = require("../../../../utils");
const { ROLES } = require("../../../../config/constants");
const { mapUser } = require("../../../../utils/mappers");

/**
 * Create a user account (admin-provisioned).
 *
 * @param {import("express").Request} req - Express request object.
 * @param {Object} req.body - Request payload.
 * @param {string} req.body.name - User full name.
 * @param {string} req.body.email - User email address.
 * @param {string} req.body.password - User password.
 * @param {string} req.body.role - Assigned role (user or admin).
 * @param {import("express").Response} res - Express response object.
 * @param {import("express").NextFunction} next - Next middleware function.
 * @returns {Promise<import("express").Response|void>} The Express response after sending the 201 reply, or undefined when an error is forwarded to `next`.
 */
const createUser = async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body;

    const errors = [];

    if (!name || typeof name !== "string" || !name.trim()) {
      errors.push({ field: "name", message: "invalid input", in: "body" });
    }

    if (!email || typeof email !== "string") {
      errors.push({
        field: "email",
        message: "invalid input",
        in: "body",
      });
    } else if (!validation.isValidEmail(email)) {
      errors.push({
        field: "email",
        message: "invalid input",
        in: "body",
      });
    }

    if (!password || typeof password !== "string") {
      errors.push({ field: "password", message: "invalid input", in: "body" });
    } else if (password.length < 8) {
      errors.push({
        field: "password",
        message: "Password must be at least 8 character",
        in: "body",
      });
    } else if (validation.isPasswordTooLong(password)) {
      // bcrypt truncates beyond 72 bytes; reject early so clients know the limit.
      errors.push({
        field: "password",
        message: "Password must be at most 72 bytes long",
        in: "body",
      });
    }

    if (
      !role ||
      typeof role !== "string" ||
      !Object.values(ROLES).includes(role)
    ) {
      errors.push({ field: "role", message: "invalid input", in: "body" });
    }

    if (errors.length) {
      throw badRequest(errors, "invalid input");
    }

    const data = await userServices.createUserByAdmin({
      name,
      email,
      password,
      role,
    });

    return res.status(201).json({
      code: 201,
      message: "Account created",
      data: mapUser(data),
    });
  } catch (err) {
    return next(err);
  }
};

module.exports = createUser;
