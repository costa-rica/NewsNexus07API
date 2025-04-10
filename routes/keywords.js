var express = require("express");
var router = express.Router();
const { Keywords } = require("newsnexus05db");
const { checkBodyReturnMissing } = require("../modules/common");
const { authenticateToken } = require("../modules/userAuthentication");

// 🔹 POST /keywords/add: Add API
router.post("/add-keyword", authenticateToken, async (req, res) => {
  const { keyword, category } = req.body;
  const { isValid, missingKeys } = checkBodyReturnMissing(req.body, [
    "keyword",
  ]);

  if (!isValid) {
    return res.status(400).json({ error: `Missing ${missingKeys.join(", ")}` });
  }

  const newKeyword = await Keywords.create({
    keyword: keyword,
    category: category,
  });

  res.json({ result: true });
});

module.exports = router;
