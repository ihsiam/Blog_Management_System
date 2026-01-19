const authenticate = (req, res, next) => {
    req.user = {
        id: '507f1f77bcf86cd799439011',
        name: 'I.H. Siam',
    };
    next();
};

module.exports = authenticate;
