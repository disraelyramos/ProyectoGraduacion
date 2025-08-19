const xss = require("xss");

module.exports = (req, res, next) => {
  // 🔹 Limpia cada campo del body contra XSS
  if (req.body) {
    for (const key in req.body) {
      if (typeof req.body[key] === "string") {
        req.body[key] = xss(req.body[key].trim());
      }
    }
  }
  next();
};
