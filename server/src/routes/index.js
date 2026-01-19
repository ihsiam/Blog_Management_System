const router = require('express').Router();
const { controller: articleController } = require('../api/v1/article');

router.route('/api/v1/articles').get(articleController.findAll).post(articleController.create);

router
    .route('/api/v1/articles/:id')
    .get(() => {})
    .put(() => {})
    .patch(() => {})
    .delete(() => {});

module.exports = router;
