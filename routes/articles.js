var express = require("express");
var router = express.Router();
const { Article, State } = require("newsnexus05db");
const { checkBodyReturnMissing } = require("../modules/common");
const { authenticateToken } = require("../modules/userAuthentication");

// 🔹 GET /articles: Get API
router.get("/", authenticateToken, async (req, res) => {
  const articlesArray = await Article.findAll({
    include: [
      {
        model: State,
        through: { attributes: [] }, // omit ArticleStateContract from result
      },
    ],
  });

  // make an array of just the articles
  const articlesArrayModified = articlesArray.map((article) => {
    // create states string
    const states = article.States.map((state) => state.name).join(", ");
    return {
      ...article.dataValues,
      states,
    };
  });

  res.json({ articlesArray: articlesArrayModified });
});

module.exports = router;
