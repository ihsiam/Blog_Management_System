const router = require("express").Router();
const { articleController } = require("../api/v1/article");
const { authController } = require("../api/v1/authentication");
const authenticate = require("../middleware/authenticate");
const authorize = require("../middleware/authorize");
const ownership = require("../middleware/ownership");

// api routes for version 1

// auth routes
router.post("/api/v1/auth/signUp", authController.register);
router.post("/api/v1/auth/signin", authController.login);

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

module.exports = router;
