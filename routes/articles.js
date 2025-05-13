var express = require("express");
var router = express.Router();
const {
  sequelize,
  Article,
  State,
  ArticleIsRelevant,
  ArticleApproved,
  NewsApiRequest,
  EntityWhoFoundArticle,
  ArticleStateContract,
  ArticleContent,
  ArticleReportContract,
  ArticleEntityWhoCategorizedArticleContract,
  ArtificialIntelligence,
} = require("newsnexus07db");
const { authenticateToken } = require("../modules/userAuthentication");
const {
  createArticlesArrayWithSqlForSemanticKeywordsRating,
} = require("../modules/articles");
const {
  convertUtcDateOrStringToEasternString,
  getMostRecentEasternFriday,
} = require("../modules/common");
const { DateTime } = require("luxon");
// 🔹 POST /articles: filtered list of articles
router.post("/", authenticateToken, async (req, res) => {
  console.log("- POST /articles");

  const {
    returnOnlyThisPublishedDateOrAfter,
    returnOnlyIsNotApproved,
    returnOnlyIsRelevant,
  } = req.body;

  const { Op } = require("sequelize");

  const whereClause = {};

  // Apply publishedDate filter if provided
  if (returnOnlyThisPublishedDateOrAfter) {
    whereClause.publishedDate = {
      [Op.gte]: new Date(returnOnlyThisPublishedDateOrAfter),
    };
  }

  const articlesArray = await Article.findAll({
    where: whereClause,
    include: [
      {
        model: State,
        through: { attributes: [] },
      },
      {
        model: ArticleIsRelevant,
      },
      {
        model: ArticleApproved,
      },
      {
        model: NewsApiRequest,
      },
    ],
  });

  console.log(
    "- articlesArray.length (before filtering):",
    articlesArray.length
  );

  // Filter in JavaScript based on related tables
  const articlesArrayFiltered = articlesArray.filter((article) => {
    // Filter out not approved if requested
    if (
      returnOnlyIsNotApproved &&
      article.ArticleApproveds &&
      article.ArticleApproveds.length > 0
    ) {
      return false;
    }

    // Filter out not relevant if requested
    if (
      returnOnlyIsRelevant &&
      article.ArticleIsRelevants &&
      article.ArticleIsRelevants.some((entry) => entry.isRelevant === false)
    ) {
      return false;
    }

    return true;
  });

  console.log(
    "- articlesArrayFiltered.length (after filtering):",
    articlesArrayFiltered.length
  );

  const articlesArrayModified = articlesArrayFiltered.map((article) => {
    const states = article.States.map((state) => state.name).join(", ");
    const isRelevant =
      !article.ArticleIsRelevants ||
      article.ArticleIsRelevants.every((entry) => entry.isRelevant !== false);
    const isApproved =
      article.ArticleApproveds &&
      article.ArticleApproveds.some((entry) => entry.userId !== null);

    let keyword = "";
    if (article.NewsApiRequest?.andString)
      keyword += `AND ${article.NewsApiRequest.andString}`;
    if (article.NewsApiRequest?.orString)
      keyword += ` OR ${article.NewsApiRequest.orString}`;
    if (article.NewsApiRequest?.notString)
      keyword += ` NOT ${article.NewsApiRequest.notString}`;

    return {
      // ...article.dataValues,
      id: article.id,
      title: article.title,
      description: article.description,
      publishedDate: article.publishedDate,
      url: article.url,
      states,
      isRelevant,
      isApproved,
      keyword,
    };
  });

  res.json({ articlesArray: articlesArrayModified });
});

// 🔹 GET /articles/approved
router.get("/approved", authenticateToken, async (req, res) => {
  console.log("- GET /articles/approved");

  const articlesArray = await Article.findAll({
    // where: whereClause,
    include: [
      {
        model: State,
        through: { attributes: [] },
      },
      {
        model: ArticleIsRelevant,
      },
      {
        model: ArticleApproved,
      },
      {
        model: NewsApiRequest,
      },
      { model: ArticleReportContract },
    ],
  });

  // Filter in JavaScript based on related tables
  const articlesArrayFiltered = articlesArray.filter((article) => {
    // Filter out not approved if requested
    if (article.ArticleApproveds && article.ArticleApproveds.length > 0) {
      return true;
    }

    return false;
  });

  const articlesArrayModified = articlesArrayFiltered.map((article) => {
    return {
      ...article.dataValues,
      isSubmitted: article.ArticleReportContracts.length > 0 ? "Yes" : "No",
      articleReferenceNumberInReport:
        article.ArticleReportContracts.length > 0
          ? article.ArticleReportContracts[
              article.ArticleReportContracts.length - 1
            ].articleReferenceNumberInReport
          : "N/A",
    };
  });

  console.log(
    "- articlesArrayFiltered.length (after filtering):",
    articlesArrayModified.length
  );

  res.json({ articlesArray: articlesArrayModified });
});

// 🔹 POST /articles/user-toggle-is-not-relevant/:articleId
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
      articleIsRelevant = true;
    } else {
      await ArticleIsRelevant.create({
        articleId: articleId,
        userId: user.id,
        isRelevant: false,
      });
      status = `articleId ${articleId} is marked as NOT relevant`;
      articleIsRelevant = false;
    }
    res.json({ result: true, status, articleIsRelevant });
  }
);

// 🔹 GET /articles/get-approved/:articleId
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

// 🔹 POST /articles/approve/:articleId
router.post("/approve/:articleId", authenticateToken, async (req, res) => {
  const { articleId } = req.params;
  const {
    isApproved,
    headlineForPdfReport,
    publicationNameForPdfReport,
    publicationDateForPdfReport,
    textForPdfReport,
    urlForPdfReport,
    kmNotes,
  } = req.body;
  const user = req.user;

  console.log(`articleId ${articleId}: ${headlineForPdfReport}`);

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

  res.json({ result: true, status: `articleId ${articleId} is approved` });
});

// 🔹 GET /articles/summary-statistics
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
  const yesterdayEastCoastDateStr = DateTime.now()
    .setZone("America/New_York")
    .minus({ days: 1 })
    .toISODate(); // e.g. "2025-05-12"
  let addedYesterday = 0;
  const lastFridayEastern = getMostRecentEasternFriday();
  let approvedThisWeek = 0;
  console.log(`yesterdayEastCoastDateStr: ${yesterdayEastCoastDateStr}`);

  articlesArray.map((article) => {
    articlesCount++;
    if (article.ArticleIsRelevants.isRelevant !== false) {
      articlesIsRelevantCount++;
    }
    if (article.ArticleApproveds.length > 0) {
      articlesIsApprovedCount++;
    }
    if (article.States.length > 0) {
      hasStateAssigned++;
    }
    const articleDateStr = convertUtcDateOrStringToEasternString(
      article.createdAt
    ).split(" ")[0];
    if (articleDateStr === yesterdayEastCoastDateStr) {
      addedYesterday++;
    }
    if (
      article.ArticleApproveds.some((entry) => {
        const approvalDate = DateTime.fromJSDate(entry.createdAt, {
          zone: "utc",
        }).setZone("America/New_York");
        return (
          approvalDate >=
          DateTime.fromJSDate(lastFridayEastern, { zone: "America/New_York" })
        );
      })
    ) {
      approvedThisWeek++;
    }
  });

  const summaryStatistics = {
    articlesCount,
    articlesIsRelevantCount,
    articlesIsApprovedCount,
    hasStateAssigned,
    addedYesterday,
    approvedThisWeek,
  };
  res.json({ summaryStatistics });
});

// 🔹 POST /add-article
router.post("/add-article", authenticateToken, async (req, res) => {
  const {
    publicationName,
    author,
    title,
    description,
    content,
    url,
    publishedDate,
    stateObjArray,
    isApproved,
    kmNotes,
  } = req.body;

  console.log(`publicationName: ${publicationName}`);
  console.log(`author: ${author}`);
  console.log(`title: ${title}`);
  console.log(`description: ${description}`);
  console.log(`content: ${content}`);
  console.log(`url: ${url}`);
  console.log(`publishedDate: ${publishedDate}`);
  console.log(`stateObjArray: ${stateObjArray}`);
  console.log(`isApproved: ${isApproved}`);
  console.log(`kmNotes: ${kmNotes}`);

  const user = req.user;

  const entityWhoFoundArticleObj = await EntityWhoFoundArticle.findOne({
    where: { userId: user.id },
  });

  const newArticle = await Article.create({
    publicationName,
    author,
    title,
    description,
    url,
    publishedDate,
    entityWhoFoundArticleId: entityWhoFoundArticleObj.id,
  });

  console.log(`stateObjArray: ${stateObjArray}`);

  for (let stateObj of stateObjArray) {
    await ArticleStateContract.create({
      articleId: newArticle.id,
      stateId: stateObj.id,
    });
  }

  if (isApproved) {
    await ArticleApproved.create({
      userId: user.id,
      articleId: newArticle.id,
      isApproved,
      headlineForPdfReport: title,
      publicationNameForPdfReport: publicationName,
      publicationDateForPdfReport: publishedDate,
      textForPdfReport: content,
      urlForPdfReport: url,
      kmNotes,
    });
  }

  res.json({ result: true, newArticle });
});

// 🔹 DELETE /articles/:articleId - Delete Article
router.delete("/:articleId", authenticateToken, async (req, res) => {
  const { articleId } = req.params;
  await Article.destroy({
    where: { id: articleId },
  });
  await ArticleApproved.destroy({
    where: { articleId },
  });
  await ArticleIsRelevant.destroy({
    where: { articleId },
  });
  await ArticleStateContract.destroy({
    where: { articleId },
  });
  await ArticleContent.destroy({
    where: { articleId },
  });
  res.json({ result: true, status: `articleId ${articleId} deleted` });
});

// 🔹 POST /articles/with-ratings - Get articles with ratings
router.post("/with-ratings", authenticateToken, async (req, res) => {
  console.log("- POST /articles/with-ratings");

  const {
    returnOnlyThisPublishedDateOrAfter,
    semanticScorerEntityName,
    zeroShotScorerEntityName,
  } = req.body;

  let semanticScorerEntityId;
  let zeroShotScorerEntityId;

  if (semanticScorerEntityName) {
    const semanticScorerEntityObj = await ArtificialIntelligence.findOne({
      where: { name: semanticScorerEntityName },
    });
    semanticScorerEntityId = semanticScorerEntityObj.id;
  } else {
    console.log(
      `semanticScorerEntityName: ${semanticScorerEntityName} not found`
    );
  }

  if (zeroShotScorerEntityName) {
    const zeroShotScorerEntityObj = await ArtificialIntelligence.findOne({
      where: { name: zeroShotScorerEntityName },
    });
    zeroShotScorerEntityId = zeroShotScorerEntityObj.id;
  } else {
    console.log(
      `zeroShotScorerEntityName: ${zeroShotScorerEntityName} not found`
    );
  }

  try {
    // 🔹 Step 1: Get full list of articles as base array
    const whereClause = {};
    if (returnOnlyThisPublishedDateOrAfter) {
      whereClause.publishedDate = {
        [require("sequelize").Op.gte]: new Date(
          returnOnlyThisPublishedDateOrAfter
        ),
      };
    }

    const articlesArray = await Article.findAll({
      where: whereClause,
      include: [
        { model: State, through: { attributes: [] } },
        { model: ArticleIsRelevant },
        { model: ArticleApproved },
        { model: NewsApiRequest },
        { model: ArticleEntityWhoCategorizedArticleContract },
      ],
    });

    // 🔹 Step 2: Build final article objects
    const finalArticles = articlesArray.map((article) => {
      const states = article.States.map((state) => state.name).join(", ");
      const isRelevant =
        !article.ArticleIsRelevants ||
        article.ArticleIsRelevants.every((entry) => entry.isRelevant !== false);
      const isApproved =
        article.ArticleApproveds &&
        article.ArticleApproveds.some((entry) => entry.userId !== null);

      let semanticRatingMaxLabel = "N/A";
      let semanticRatingMax = "N/A";
      let zeroShotRatingMaxLabel = "N/A";
      let zeroShotRatingMax = "N/A";

      if (article.ArticleEntityWhoCategorizedArticleContracts?.length > 0) {
        article.ArticleEntityWhoCategorizedArticleContracts.forEach(
          (contract) => {
            if (contract.entityWhoCategorizesId === semanticScorerEntityId) {
              semanticRatingMaxLabel = contract.keyword;
              semanticRatingMax = contract.keywordRating;
            }
            if (zeroShotScorerEntityId) {
              if (contract.entityWhoCategorizesId === zeroShotScorerEntityId) {
                zeroShotRatingMaxLabel = contract.keyword;
                zeroShotRatingMax = contract.keywordRating;
              }
            }
          }
        );
      }

      let keyword = "";
      if (article.NewsApiRequest?.andString)
        keyword += `AND ${article.NewsApiRequest.andString}`;
      if (article.NewsApiRequest?.orString)
        keyword += ` OR ${article.NewsApiRequest.orString}`;
      if (article.NewsApiRequest?.notString)
        keyword += ` NOT ${article.NewsApiRequest.notString}`;

      return {
        id: article.id,
        title: article.title,
        description: article.description,
        publishedDate: article.publishedDate,
        publicationName: article.publicationName,
        url: article.url,
        States: article.States,
        states,
        isRelevant,
        isApproved,
        keyword,
        semanticRatingMaxLabel,
        semanticRatingMax,
        zeroShotRatingMaxLabel,
        zeroShotRatingMax,
      };
    });

    res.json({ articlesArray: finalArticles });
  } catch (error) {
    console.error("❌ Error in /articles/with-ratings:", error);
    res.status(500).json({ error: "Failed to fetch articles with ratings." });
  }
});

// 🔹 POST /articles/with-ratings-sql - Get articles with ratings (SQL version)
router.post("/with-ratings-sql", authenticateToken, async (req, res) => {
  console.log("- POST /articles/with-ratings-sql");

  const { returnOnlyThisPublishedDateOrAfter, entityWhoCategorizesIdSemantic } =
    req.body;

  if (!entityWhoCategorizesIdSemantic) {
    return res
      .status(400)
      .json({ error: "Missing entityWhoCategorizesIdSemantic" });
  }

  try {
    // 🔹 Step 1: Get full list of articles as base array
    const whereClause = {};
    if (returnOnlyThisPublishedDateOrAfter) {
      whereClause.publishedDate = {
        [require("sequelize").Op.gte]: new Date(
          returnOnlyThisPublishedDateOrAfter
        ),
      };
    }

    const articlesArray = await Article.findAll({
      where: whereClause,
      include: [
        { model: State, through: { attributes: [] } },
        { model: ArticleIsRelevant },
        { model: ArticleApproved },
        { model: NewsApiRequest },
      ],
    });

    const articleIds = articlesArray.map((a) => a.id);

    // 🔹 Step 2: Get keywordRating and keywordOfRating per article
    const ratedArticles =
      await createArticlesArrayWithSqlForSemanticKeywordsRating(
        entityWhoCategorizesIdSemantic,
        returnOnlyThisPublishedDateOrAfter
      );

    const ratingMap = new Map();
    ratedArticles.forEach((item) => {
      ratingMap.set(item.id, {
        semanticRatingMaxLabel: item.keywordOfRating,
        semanticRatingMax: item.keywordRating,
      });
    });

    // 🔹 Step 2.1: Get zero-shot ratings
    const ratedArticles02 =
      await createArticlesArrayWithSqlForSemanticKeywordsRating(
        2,
        returnOnlyThisPublishedDateOrAfter
      );
    const ratingMap02 = new Map();
    ratedArticles02.forEach((item) => {
      ratingMap02.set(item.id, {
        zeroShotRatingMaxLabel: item.keywordOfRating,
        zeroShotRatingMax: item.keywordRating,
      });
    });

    // 🔹 Step 3: Build final article objects
    const finalArticles = articlesArray.map((article) => {
      const states = article.States.map((state) => state.name).join(", ");
      const isRelevant =
        !article.ArticleIsRelevants ||
        article.ArticleIsRelevants.every((entry) => entry.isRelevant !== false);
      const isApproved =
        article.ArticleApproveds &&
        article.ArticleApproveds.some((entry) => entry.userId !== null);

      let keyword = "";
      if (article.NewsApiRequest?.andString)
        keyword += `AND ${article.NewsApiRequest.andString}`;
      if (article.NewsApiRequest?.orString)
        keyword += ` OR ${article.NewsApiRequest.orString}`;
      if (article.NewsApiRequest?.notString)
        keyword += ` NOT ${article.NewsApiRequest.notString}`;

      const rating = ratingMap.get(article.id) || {};
      const rating02 = ratingMap02.get(article.id) || {};

      return {
        id: article.id,
        title: article.title,
        description: article.description,
        publishedDate: article.publishedDate,
        url: article.url,
        states,
        isRelevant,
        isApproved,
        keyword,
        semanticRatingMaxLabel: rating.semanticRatingMaxLabel || null,
        semanticRatingMax: rating.semanticRatingMax || null,
        zeroShotRatingMaxLabel: rating02.zeroShotRatingMaxLabel || null,
        zeroShotRatingMax: rating02.zeroShotRatingMax || null,
      };
    });

    res.json({ articlesArray: finalArticles });
  } catch (error) {
    console.error("❌ Error in /articles/with-ratings:", error);
    res.status(500).json({ error: "Failed to fetch articles with ratings." });
  }
});

module.exports = router;
