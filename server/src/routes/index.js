const router = require('express').Router();
const { controller: articleController } = require('../api/v1/article');
const { controller: authController } = require('../api/v1/authentication');

// auth route
router.post('/api/v1/auth/signUp', authController.register);
router.post('/api/v1/auth/signin', authController.login);

// article route
router.route('/api/v1/articles').get(articleController.findAll).post(articleController.create);

router
    .route('/api/v1/articles/:id')
    .get(articleController.findSingleItem)
    .put(articleController.updateItem)
    .patch(articleController.updateItemPatch)
    .delete(articleController.deleteItem);

module.exports = router;
