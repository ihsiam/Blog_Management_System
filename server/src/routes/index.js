const router = require("express").Router();
const rateLimit = require("express-rate-limit");
const { articleController } = require("../api/v1/article");
const { authController } = require("../api/v1/authentication");
const { commentsController } = require("../api/v1/comments");
const authenticate = require("../middleware/authenticate");
const authorize = require("../middleware/authorize");
const ownership = require("../middleware/ownership");

// auth rate limiter
const authLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: {
    code: 429,
    error: "too many requests",
    message: "too many attempts, try again later",
  },
});

// api routes for version 1

// auth routes
router.post("/api/v1/auth/signUp", authLimit, authController.register);
router.post("/api/v1/auth/signin", authLimit, authController.login);

// article routes
router
  .route("/api/v1/articles")
  .get(articleController.findAll)
  .post(authenticate, authorize(["user", "admin"]), articleController.create);

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

router
  .route("/api/v1/articles/:id/comments")
  .get(articleController.getArticleComments)
  .post(
    authenticate,
    authorize(["user", "admin"]),
    articleController.postCommentOnArticle,
  );

router
  .route("/api/v1/articles/:id/author")
  .get(articleController.getArticleAuthor);

// comment routes
router
  .route("/api/v1/comments")
  .get(authenticate, authorize(["admin"]), commentsController.getComments)
  .post(authenticate, authorize(["admin"]), commentsController.postComment);

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

module.exports = router;
