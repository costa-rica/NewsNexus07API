var express = require("express");
var router = express.Router();
const {
  Article,
  State,
  ArticleIsRelevant,
  ArticleApproved,
  NewsApiRequest,
  Keyword,
} = require("newsnexus05db");
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
      {
        model: ArticleApproved,
      },
      {
        model: NewsApiRequest,
        include: [Keyword],
      },
    ],
  });

  // make an array of just the articles
  const articlesArrayModified = articlesArray.map((article) => {
    // create states string
    const states = article.States.map((state) => state.name).join(", ");
    // create isRelevant boolean: if there is any false isRelevant, return false
    const isRelevant =
      !article.ArticleIsRelevants ||
      article.ArticleIsRelevants.every((entry) => entry.isRelevant !== false);
    // create isApproved boolean: if there is any true isApproved, return true
    const isApproved =
      article.ArticleApproveds &&
      article.ArticleApproveds.some((entry) => entry.userId !== null);
    const keyword = article.NewsApiRequest?.Keyword?.keyword || null;
    return {
      ...article.dataValues,
      states,
      isRelevant,
      isApproved,
      keyword,
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

// 🔹 GET /get-approved/:articleId
router.get("/get-approved/:articleId", authenticateToken, async (req, res) => {
  const { articleId } = req.params;
  const articleApproved = await ArticleApproved.findOne({
    where: { articleId },
    include: [
      {
        model: Article,
        include: [
          {
            model: State,
            through: { attributes: [] }, // omit ArticleStateContract from result
          },
          {
            model: ArticleIsRelevant,
          },
        ],
      },
    ],
  });
  if (!articleApproved) {
    return res.json({ articleIsApproved: false, article: {} });
  }

  res.json({
    articleIsApproved: true,
    article: articleApproved.Article,
    content: articleApproved.textForPdfReport,
  });
});

// 🔹 GET /approve/:articleId
router.post("/approve/:articleId", authenticateToken, async (req, res) => {
  const { articleId } = req.params;
  const { isApproved } = req.body;
  const user = req.user;

  if (isApproved) {
    await ArticleApproved.create({
      articleId: articleId,
      userId: user.id,
      ...req.body,
    });
  } else {
    await ArticleApproved.destroy({
      where: { articleId },
    });
  }

  // const existingRecord = await ArticleApproved.findOne({
  //   where: { articleId },
  // });
  // if (existingRecord) {
  //   return res.json({
  //     result: false,
  //     status: `articleId ${articleId} is already approved`,
  //   });
  // }
  // await ArticleApproved.create({
  //   articleId: articleId,
  //   userId: user.id,
  // });
  res.json({ result: true, status: `articleId ${articleId} is approved` });
});

// 🔹 GET /summary-statistics
router.get("/summary-statistics", authenticateToken, async (req, res) => {
  const articlesArray = await Article.findAll({
    include: [
      {
        model: State,
        through: { attributes: [] }, // omit ArticleStateContract from result
      },
      {
        model: ArticleIsRelevant,
      },
      {
        model: ArticleApproved,
      },
    ],
  });
  let articlesCount = 0;
  let articlesIsRelevantCount = 0;
  let articlesIsApprovedCount = 0;
  let hasStateAssigned = 0;

  articlesArray.map((article) => {
    articlesCount++;
    if (article.ArticleIsRelevants.isRelevant !== false) {
      articlesIsRelevantCount++;
    }
    if (article.ArticleApproveds.isApproved === true) {
      articlesIsApprovedCount++;
    }
    if (article.States.length > 0) {
      hasStateAssigned++;
    }
  });
  const summaryStatistics = {
    articlesCount,
    articlesIsRelevantCount,
    articlesIsApprovedCount,
    hasStateAssigned,
  };
  res.json({ summaryStatistics });
});

module.exports = router;
