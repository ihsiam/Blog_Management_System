const login = (req, res, next) => {
  try {
    res.status(201).send();
  } catch (e) {
    next(e);
  }
};

module.exports = login;
