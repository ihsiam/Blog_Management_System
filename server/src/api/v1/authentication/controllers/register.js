const register = (req, res, next) => {
    try {
        res.status(201).send();
    } catch (e) {
        next(e);
    }
};

module.exports = register;
