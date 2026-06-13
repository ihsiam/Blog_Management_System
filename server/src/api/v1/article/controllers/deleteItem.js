const serviceRegistry = require("../../../../lib/service registry");
const { badRequest } = require("../../../../utils/error");

/**
 * Deletes an article by ID.
 *
 * @param {import("express").Request} req - Express request object
 * @param {Object} req.params - Route parameters
 * @param {string} req.params.id - Article ID
 *
 * @param {import("express").Response} res
 * @param {Function} next
 *
 * @returns {Promise<void>} Sends empty 204 response on success
 */
const deleteItem = async (req, res, next) => {
  try {
    /**
     * Extract article ID
     */
    const { id } = req.params;

    /**
     * Validate ID
     */
    if (!id || typeof id !== "string") {
      throw badRequest(
        [{ field: "id", message: "invalid input", in: "params" }],
        "invalid input",
      );
    }

    /**
     * Delete article
     */
    await serviceRegistry.deleteArticle(id);

    /**
     * No content response
     */
    return res.status(204).end();
  } catch (err) {
    return next(err);
  }
};

module.exports = deleteItem;
