var express = require("express");
var router = express.Router();
const { Article } = require("newsnexus05db");
const { checkBodyReturnMissing } = require("../modules/common");
const { authenticateToken } = require("../modules/userAuthentication");

// 🔹 GET /articles: Get API
router.get("/", authenticateToken, async (req, res) => {
  const articlesArray = await Article.findAll();

  // make an array of just the articles
  //   const articlesArray = articles.map((article) => article.title);
  //   const articlesArrayModif = [{ id: 0, title: "test" }, ...articlesArray];
  res.json({ articlesArray });
});

module.exports = router;
