const router = require('express').Router();
const { controller: articleController } = require('../api/v1/article');

router.route('/api/v1/articles').get(articleController.findAll).post(articleController.create);

router
    .route('/api/v1/articles/:id')
    .get(articleController.findSingleItem)
    .put(articleController.updateItem)
    .patch(articleController.updateItemPatch)
    .delete(articleController.deleteItem);

module.exports = router;
