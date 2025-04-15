var express = require("express");
var router = express.Router();
const { Article, State, ArticleIsRelevant } = require("newsnexus05db");
const { checkBodyReturnMissing } = require("../modules/common");
const { authenticateToken } = require("../modules/userAuthentication");

// 🔹 GET /articles: all articles
router.get("/", authenticateToken, async (req, res) => {
  const articlesArray = await Article.findAll({
    include: [
      {
        model: State,
        through: { attributes: [] }, // omit ArticleStateContract from result
      },
      {
        model: ArticleIsRelevant,
      },
    ],
  });

  // make an array of just the articles
  const articlesArrayModified = articlesArray.map((article) => {
    // create states string
    const states = article.States.map((state) => state.name).join(", ");
    const isRelevant =
      !article.ArticleIsRelevants ||
      article.ArticleIsRelevants.every((entry) => entry.isRelevant !== false);

    return {
      ...article.dataValues,
      states,
      isRelevant,
    };
  });

  res.json({ articlesArray: articlesArrayModified });
});

// 🔹 GET /is-not-relevant/:articleId
router.post(
  "/user-toggle-is-not-relevant/:articleId",
  authenticateToken,
  async (req, res) => {
    const { articleId } = req.params;
    const user = req.user;
    const existingRecord = await ArticleIsRelevant.findOne({
      where: { articleId },
    });
    let status;
    let articleIsRelevant;
    if (existingRecord) {
      await existingRecord.destroy({
        where: { articleId },
      });
      status = `articleId ${articleId} is made relevant`;
      articleIsRelevant = false;
    } else {
      await ArticleIsRelevant.create({
        articleId: articleId,
        userId: user.id,
      });
      status = `articleId ${articleId} is marked as NOT relevant`;
      articleIsRelevant = true;
    }
    res.json({ result: true, status, articleIsRelevant });
  }
);

module.exports = router;
