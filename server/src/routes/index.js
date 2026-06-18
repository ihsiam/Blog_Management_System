const router = require("express").Router();
const rateLimit = require("express-rate-limit");

const { articleController } = require("../api/v1/article");
const { authController } = require("../api/v1/authentication");
const { commentsController } = require("../api/v1/comments");
const { userController } = require("../api/v1/user");

const authenticate = require("../middleware/authenticate");
const authorize = require("../middleware/authorize");
const ownership = require("../middleware/ownership");

/**
 * Authentication rate limiter.
 *
 * Protects sensitive authentication endpoints
 * against brute-force and credential-stuffing attacks.
 */
const authLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: {
    code: 429,
    error: "too many requests",
    message: "too many attempts, try again later",
  },
});

/**
 * ==================================================
 * Authentication Routes
 * ==================================================
 */

/**
 * Initial admin account setup.
 * Intended for first-time system initialization.
 */
router.post("/api/v1/auth/setup-admin", authLimit, authController.setupAdmin);

/**
 * User registration and email verification flow.
 */
router.post("/api/v1/auth/sign-up", authLimit, authController.register);
router.get("/api/v1/auth/verify-email/:token", authController.verifyEmail);
router.post(
  "/api/v1/auth/resend-verification",
  authController.resendVerificationMail,
);

/**
 * Password recovery flow.
 */
router.post("/api/v1/auth/forgot-password", authController.forgotPassword);
router.patch(
  "/api/v1/auth/reset-password/:token",
  authController.resetPassword,
);

/**
 * Authentication session management.
 */
router.post("/api/v1/auth/sign-in", authLimit, authController.login);
router.post("/api/v1/auth/refresh", authController.refresh);
router.post("/api/v1/auth/logout", authenticate, authController.logout);

/**
 * ==================================================
 * Article Routes
 * ==================================================
 */

/**
 * Public article endpoints.
 */
router
  .route("/api/v1/articles")
  .get(articleController.findAll)
  .post(authenticate, authorize(["user", "admin"]), articleController.create);

/**
 * Admin article listing.
 */
router
  .route("/api/v1/articles/all")
  .get(authenticate, authorize(["admin"]), articleController.getAllByAdmin);

/**
 * Single article operations.
 */
router
  .route("/api/v1/articles/:id")
  .get(articleController.findSingleItem)
  .put(
    authenticate,
    authorize(["user", "admin"]),
    ownership("article", { allowMissing: true }),
    articleController.updateOrCreateItem,
  )
  .patch(
    authenticate,
    authorize(["user", "admin"]),
    ownership("article"),
    articleController.updateItemPatch,
  )
  .delete(
    authenticate,
    authorize(["user", "admin"]),
    ownership("article"),
    articleController.deleteItem,
  );

/**
 * Article author resource.
 */
router
  .route("/api/v1/articles/:id/author")
  .get(articleController.getArticleAuthor);

/**
 * Article comments resource.
 */
router
  .route("/api/v1/articles/:id/comments")
  .get(articleController.getArticleComments)
  .post(
    authenticate,
    authorize(["user", "admin"]),
    articleController.postCommentOnArticle,
  );

/**
 * ==================================================
 * Comment Routes
 * ==================================================
 */

/**
 * Comment collection endpoints (Admin-only access).
 */
router
  .route("/api/v1/comments")
  .get(authenticate, authorize(["admin"]), commentsController.getComments)
  .post(authenticate, authorize(["admin"]), commentsController.postComment);

/**
 * Single comment operations.
 */
router
  .route("/api/v1/comments/:id")
  .patch(
    authenticate,
    authorize(["user", "admin"]),
    ownership("comment"),
    commentsController.updateComment,
  )
  .delete(
    authenticate,
    authorize(["user", "admin"]),
    ownership("comment"),
    commentsController.deleteComment,
  );

/**
 * ==================================================
 * User Routes
 * ==================================================
 */

/**
 * User collection management (Admin-only access).
 */
router
  .route("/api/v1/users")
  .get(authenticate, authorize(["admin"]), userController.getAllUsers)
  .post(authenticate, authorize(["admin"]), userController.createUser);

/**
 * Password change endpoint.
 */
router
  .route("/api/v1/users/:id/change-password")
  .patch(
    authenticate,
    authorize(["admin", "user"]),
    ownership("user"),
    userController.changePassword,
  );

/**
 * Single user management.
 */
router
  .route("/api/v1/users/:id")
  .get(
    authenticate,
    authorize(["admin", "user"]),
    ownership("user", { allowAdmin: true }),
    userController.getSingleUser,
  )
  .patch(authenticate, authorize(["admin"]), userController.updateUser)
  .delete(authenticate, authorize(["admin"]), userController.deleteUser);

module.exports = router;
