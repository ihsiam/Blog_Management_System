const services = require('../../../../lib/articles');

const deleteItem = async (req, res, next) => {
    const { id } = req.params;
    try {
        await services.deleteItem(id);
        res.status(204).end();
    } catch (e) {
        next(e);
    }
};

module.exports = deleteItem;
