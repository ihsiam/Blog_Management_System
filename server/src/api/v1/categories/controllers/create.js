const categoryServices = require("../../../../lib/categories");
const { badRequest, conflict } = require("../../../../utils/error");

/**
 * Create a category.
 *
 * @param {import("express").Request} req - Express request object.
 * @param {Object} req.body - Request payload.
 * @param {string} req.body.name - Category display name.
 * @param {string|null} [req.body.description] - Optional category description.
 * @param {import("express").Response} res - Express response object.
 * @param {import("express").NextFunction} next - Next middleware function.
 * @returns {Promise<import("express").Response|void>} The Express response after sending the 201 reply, or undefined when an error is forwarded to `next`.
 */
const create = async (req, res, next) => {
  try {
    const { name, description } = req.body;

    if (!name || typeof name !== "string" || !name.trim()) {
      throw badRequest(
        [{ field: "name", message: "invalid input", in: "body" }],
        "invalid input",
      );
    }
    if (
      description !== undefined &&
      description !== null &&
      typeof description !== "string"
    ) {
      throw badRequest(
        [{ field: "description", message: "invalid input", in: "body" }],
        "invalid input",
      );
    }

    try {
      const category = await categoryServices.create({
        name: name.trim(),
        description,
      });
      return res.status(201).json({
        code: 201,
        message: "Category created",
        data: category,
        links: { self: `/api/v1/categories/${category.id}` },
      });
    } catch (err) {
      // Map unique-index violation to a client-friendly conflict response.
      if (err.code === 11000) {
        throw conflict("A category with this name already exists.");
      }
      throw err;
    }
  } catch (err) {
    return next(err);
  }
};

module.exports = create;
