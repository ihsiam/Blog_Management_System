/* eslint-disable no-underscore-dangle */
const defaults = require('../../../../config/defaults');
const services = require('../../../../lib/articles');

const updateItem = async (req, res, next) => {
    const { id } = req.params;
    const { title } = req.body;
    const { body } = req.body;
    const author = req.user.id;
    const cover = req.body.cover || defaults.cover;
    const status = req.body.status || defaults.articleStatus;

    try {
        const { article, statusCode } = await services.updateOrCreate(id, {
            title,
            body,
            cover,
            status,
            author,
        });

        res.status(statusCode).json({
            code: statusCode,
            message: statusCode === 200 ? 'successfully updated article data' : 'Article created',
            data: article,
            links: {
                self: `/articles/${article._id}`,
            },
        });
    } catch (e) {
        next(e);
    }
};

module.exports = updateItem;
