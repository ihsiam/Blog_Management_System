const router = require("express").Router();
const { articleController } = require("../api/v1/article");
const { authController } = require("../api/v1/authentication");
const authenticate = require("../middleware/authenticate");
const authorize = require("../middleware/authorize");
const ownership = require("../middleware/ownership");

// auth route
router.post("/api/v1/auth/signUp", authController.register);
router.post("/api/v1/auth/signin", authController.login);

// article route
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
    ownership("article"),
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

module.exports = router;
