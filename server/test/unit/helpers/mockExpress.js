/**
 * Minimal Express response mock shared across controller unit tests.
 *
 * `res.status()`, `res.json()`, `res.cookie()`, and `res.clearCookie()`
 * all return `res` so controller code can chain calls exactly like the
 * real Express response object.
 */
const createMockResponse = () => {
  const res = {};

  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.cookie = jest.fn().mockReturnValue(res);
  res.clearCookie = jest.fn().mockReturnValue(res);

  return res;
};

module.exports = { createMockResponse };
