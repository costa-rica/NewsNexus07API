var express = require("express");
var router = express.Router();
const { Keyword } = require("newsnexus05db");
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

  const newKeyword = await Keyword.create({
    keyword: keyword,
    category: category,
  });

  res.json({ result: true });
});

// 🔹 GET /keywords: Get API
router.get("/", authenticateToken, async (req, res) => {
  const keywords = await Keyword.findAll({
    where: { isArchived: false },
  });
  // const keywords = await Keyword.findAll();
  // make an array of just the keywords
  const keywordsArray = keywords.map((keyword) => keyword.keyword);
  res.json({ keywordsArray });
});

module.exports = router;
