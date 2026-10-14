const router = require("express").Router();
const rateLimit = require("express-rate-limit");

const { articleController } = require("../api/v1/articles");
const { authController } = require("../api/v1/authentication");
const { commentsController } = require("../api/v1/comments");
const { categoryController } = require("../api/v1/categories");
const { userController } = require("../api/v1/user");

const authenticate = require("../middleware/authenticate");
const authenticateOptional = require("../middleware/authenticateOptional");
const authorize = require("../middleware/authorize");
const ownership = require("../middleware/ownership");
const uploadCleanup = require("../middleware/uploadCleanup");
const upload = require("../utils/multer");
const { ROLES } = require("../config/constants");

/**
 * Authentication rate limiter.
 *
 * Protects sensitive authentication endpoints
 * against brute-force and credential-stuffing attacks.
 */
const authLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
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
router.post(
  "/api/v1/auth/verify-email-otp",
  authLimit,
  authController.verifyEmail,
);
router.post(
  "/api/v1/auth/resend-verification-otp",
  authLimit,
  authController.resendVerificationMail,
);

/**
 * Password recovery flow.
 */
router.post(
  "/api/v1/auth/forgot-password",
  authLimit,
  authController.forgotPassword,
);
router.post(
  "/api/v1/auth/verify-reset-otp",
  authLimit,
  authController.verifyResetOtp,
);
router.patch(
  "/api/v1/auth/reset-password",
  authLimit,
  authController.resetPassword,
);

/**
 * Authentication session management.
 */
router.post("/api/v1/auth/sign-in", authLimit, authController.login);
router.post("/api/v1/auth/refresh", authController.refresh);
router.post("/api/v1/auth/logout", authenticate, authController.logout);
router.post("/api/v1/auth/logout-all", authenticate, authController.logoutAll);
router.get("/api/v1/auth/sessions", authenticate, authController.listSessions);
router.delete(
  "/api/v1/auth/sessions/:sessionId",
  authenticate,
  authController.deleteSession,
);

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
  .post(
    authenticate,
    authorize([ROLES.USER, ROLES.ADMIN]),
    upload.single("cover"),
    articleController.create,
    uploadCleanup,
  );

/**
 * Admin article listing.
 */
router
  .route("/api/v1/articles/admin/all")
  .get(authenticate, authorize([ROLES.ADMIN]), articleController.getAllByAdmin);

/**
 * Single article operations.
 */
router
  .route("/api/v1/articles/:id")
  .get(authenticateOptional, articleController.findSingleItem)
  .patch(
    authenticate,
    authorize([ROLES.USER, ROLES.ADMIN]),
    ownership("article"),
    upload.single("cover"),
    articleController.updateItemPatch,
    uploadCleanup,
  )
  .delete(
    authenticate,
    authorize([ROLES.USER, ROLES.ADMIN]),
    ownership("article", { allowAdmin: true }),
    articleController.deleteItem,
  );

router.patch(
  "/api/v1/articles/:id/status",
  authenticate,
  authorize([ROLES.ADMIN]),
  articleController.updateStatus,
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
    authorize([ROLES.USER, ROLES.ADMIN]),
    articleController.postCommentOnArticle,
  );

router.post(
  "/api/v1/articles/:articleId/comments/:commentId/replies",
  authenticate,
  authorize([ROLES.USER, ROLES.ADMIN]),
  articleController.postCommentReply,
);

/**
 * ==================================================
 * Category Routes
 * ==================================================
 */

/**
 * Public category endpoints.
 */
router
  .route("/api/v1/categories")
  .get(authenticateOptional, categoryController.findAll)
  .post(authenticate, authorize([ROLES.ADMIN]), categoryController.create);

/**
 * Single category operations.
 */
router
  .route("/api/v1/categories/:id")
  .get(authenticateOptional, categoryController.findSingleItem)
  .patch(
    authenticate,
    authorize([ROLES.ADMIN]),
    categoryController.updateItemPatch,
  );

/**
 * Category status management.
 */
router.patch(
  "/api/v1/categories/:id/status",
  authenticate,
  authorize([ROLES.ADMIN]),
  categoryController.updateStatus,
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
  .get(authenticate, authorize([ROLES.ADMIN]), commentsController.getComments);

/**
 * Single comment operations.
 */
router
  .route("/api/v1/comments/:id")
  .patch(
    authenticate,
    authorize([ROLES.USER, ROLES.ADMIN]),
    ownership("comment"),
    commentsController.updateComment,
  )
  .delete(
    authenticate,
    authorize([ROLES.USER, ROLES.ADMIN]),
    ownership("comment", { allowAdmin: true }),
    commentsController.deleteComment,
  );

router.patch(
  "/api/v1/comments/:id/status",
  authenticate,
  authorize([ROLES.ADMIN]),
  commentsController.updateCommentStatus,
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
  .get(authenticate, authorize([ROLES.ADMIN]), userController.getAllUsers)
  .post(authenticate, authorize([ROLES.ADMIN]), userController.createUser);

/**
 * Password change endpoint.
 */
router
  .route("/api/v1/users/:id/change-password")
  .patch(
    authenticate,
    authorize([ROLES.ADMIN, ROLES.USER]),
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
    authorize([ROLES.ADMIN, ROLES.USER]),
    ownership("user", { allowAdmin: true }),
    userController.getSingleUser,
  )
  .patch(authenticate, authorize([ROLES.ADMIN]), userController.updateUser)
  .delete(authenticate, authorize([ROLES.ADMIN]), userController.deleteUser);

module.exports = router;
