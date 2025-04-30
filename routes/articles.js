var express = require("express");
var router = express.Router();
const {
  Article,
  State,
  ArticleIsRelevant,
  ArticleApproved,
  NewsApiRequest,
  EntityWhoFoundArticle,
  ArticleStateContract,
  ArticleContent,
} = require("newsnexus07db");
const { checkBodyReturnMissing } = require("../modules/common");
const { authenticateToken } = require("../modules/userAuthentication");

// // OBE GET /articles: all articles
// router.get("/", authenticateToken, async (req, res) => {
//   console.log("- GET /articles");
//   const articlesArray = await Article.findAll({
//     include: [
//       {
//         model: State,
//         through: { attributes: [] }, // omit ArticleStateContract from result
//       },
//       {
//         model: ArticleIsRelevant,
//       },
//       {
//         model: ArticleApproved,
//       },
//       {
//         model: NewsApiRequest,
//         // include: [Keyword],
//       },
//     ],
//   });

//   console.log("- articlesArray.length: ", articlesArray.length);
//   // make an array of just the articles
//   const articlesArrayModified = articlesArray.map((article) => {
//     // create states string
//     const states = article.States.map((state) => state.name).join(", ");
//     // create isRelevant boolean: if there is any false isRelevant, return false
//     const isRelevant =
//       !article.ArticleIsRelevants ||
//       article.ArticleIsRelevants.every((entry) => entry.isRelevant !== false);
//     // create isApproved boolean: if there is any true isApproved, return true
//     const isApproved =
//       article.ArticleApproveds &&
//       article.ArticleApproveds.some((entry) => entry.userId !== null);
//     let keyword = null;
//     if (!keyword) {
//       let keywordString = "";
//       if (article.NewsApiRequest?.andString) {
//         keywordString = `AND ${article.NewsApiRequest?.andString}`;
//       }
//       if (article.NewsApiRequest?.orString) {
//         keywordString += ` OR ${article.NewsApiRequest?.orString}`;
//       }
//       if (article.NewsApiRequest?.notString) {
//         keywordString += ` NOT ${article.NewsApiRequest?.notString}`;
//       }
//       keyword = keywordString;
//     }

//     return {
//       ...article.dataValues,
//       states,
//       isRelevant,
//       isApproved,
//       keyword,
//     };
//   });
//   console.log(
//     "- returning articlesArrayModified.length: ",
//     articlesArrayModified.length
//   );
//   res.json({ articlesArray: articlesArrayModified });
// });

// 🔹 POST /articles: filtered list of articles
router.post("/", authenticateToken, async (req, res) => {
  console.log("- POST /articles");

  const {
    returnOnlyThisPublishedDateOrAfter,
    returnOnlyIsNotApproved,
    returnOnlyIsRelevant,
  } = req.body;
  // const {
  //   returnOnlyThisPublishedDateOrAfter,
  //   returnApprovedAlso,
  //   returnNotRelevantAlso,
  // } = req.body;

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
      ...article.dataValues,
      states,
      isRelevant,
      isApproved,
      keyword,
    };
  });

  res.json({ articlesArray: articlesArrayModified });
});

// // 🔹 POST /articles: all articles
// router.post("/", authenticateToken, async (req, res) => {
//   console.log("- POST /articles");

//   const {
//     returnOnlyThisPublishedDateOrAfter,
//     returnOnlyIsNotApproved,
//     returnOnlyIsRelevant,
//   } = req.body;

//   const articlesArray = await Article.findAll({
//     where: {
//       publishedDate: {
//         [Op.gte]: returnOnlyThisPublishedDateOrAfter,
//       },
//     },
//     include: [
//       {
//         model: State,
//         through: { attributes: [] }, // omit ArticleStateContract from result
//       },
//       {
//         model: ArticleIsRelevant,
//       },
//       {
//         model: ArticleApproved,
//       },
//       {
//         model: NewsApiRequest,
//         // include: [Keyword],
//       },
//     ],
//   });

//   console.log("- articlesArray.length: ", articlesArray.length);
//   // make an array of just the articles
//   const articlesArrayModified = articlesArray.map((article) => {
//     // create states string
//     const states = article.States.map((state) => state.name).join(", ");
//     // create isRelevant boolean: if there is any false isRelevant, return false
//     const isRelevant =
//       !article.ArticleIsRelevants ||
//       article.ArticleIsRelevants.every((entry) => entry.isRelevant !== false);
//     // create isApproved boolean: if there is any true isApproved, return true
//     const isApproved =
//       article.ArticleApproveds &&
//       article.ArticleApproveds.some((entry) => entry.userId !== null);
//     let keyword = null;
//     if (!keyword) {
//       let keywordString = "";
//       if (article.NewsApiRequest?.andString) {
//         keywordString = `AND ${article.NewsApiRequest?.andString}`;
//       }
//       if (article.NewsApiRequest?.orString) {
//         keywordString += ` OR ${article.NewsApiRequest?.orString}`;
//       }
//       if (article.NewsApiRequest?.notString) {
//         keywordString += ` NOT ${article.NewsApiRequest?.notString}`;
//       }
//       keyword = keywordString;
//     }

//     return {
//       ...article.dataValues,
//       states,
//       isRelevant,
//       isApproved,
//       keyword,
//     };
//   });
//   console.log(
//     "- returning articlesArrayModified.length: ",
//     articlesArrayModified.length
//   );
//   res.json({ articlesArray: articlesArrayModified });
// });

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
    if (article.ArticleApproveds.length > 0) {
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

module.exports = router;
