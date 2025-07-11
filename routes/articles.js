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
  ArticleReportContract,
  ArticleEntityWhoCategorizedArticleContract,
  ArtificialIntelligence,
  ArticleReviewed,
  Report,
  NewsArticleAggregatorSource,
} = require("newsnexus07db");
const { authenticateToken } = require("../modules/userAuthentication");
const {
  createArticlesArrayWithSqlForSemanticKeywordsRating,
  createNewsApiRequestsArray,
  createArticlesApprovedArray,
} = require("../modules/articles");
const {
  convertDbUtcDateOrStringToEasternString,
  // getLastThursdayAt20h,
  getLastThursdayAt20hInNyTimeZone,
} = require("../modules/common");
const { DateTime } = require("luxon");
const { createSpreadsheetFromArray } = require("../modules/excelExports");
const path = require("path");
const fs = require("fs");
const {
  sqlQueryArticles,
  sqlQueryArticlesSummaryStatistics,
  // sqlQueryArticlesWithRatings,
  sqlQueryArticlesWithStatesApprovedReportContract,
  sqlQueryArticlesForWithRatingsRoute,
  sqlQueryArticlesWithStates,
  sqlQueryArticlesApproved,
  sqlQueryArticlesReport,
  sqlQueryArticlesIsRelevant,
} = require("../modules/queriesSql");

router.post("/test", async (req, res) => {
  const articlesArrayWithRelevants = await sqlQueryArticlesIsRelevant();
  const isRelevantByArticleId = new Map();
  for (const entry of articlesArrayWithRelevants) {
    if (!isRelevantByArticleId.has(entry.articleId)) {
      isRelevantByArticleId.set(entry.articleId, []);
    }
    isRelevantByArticleId.get(entry.articleId).push({
      articleId: entry.articleId,
      isRelevant: entry.isRelevant,
    });
  }

  let articlesArrayGrouped = Array.from(isRelevantByArticleId.values());
  res.json({ articlesArrayGrouped });
});

// NOTE: ---- > will need to refactor because sqlQueryArticles is changed
// 🔹 POST /articles: filtered list of articles
router.post("/", authenticateToken, async (req, res) => {
  console.log("- POST /articles");

  const {
    returnOnlyThisPublishedDateOrAfter,
    returnOnlyIsNotApproved,
    returnOnlyIsRelevant,
  } = req.body;

  // const articlesArray = await sqlQueryArticlesOld({
  const articlesArray = await sqlQueryArticles({
    publishedDate: returnOnlyThisPublishedDateOrAfter,
  });

  console.log(
    "- articlesArray.length (before filtering):",
    articlesArray.length
  );

  // Create Article - State Map for modifing the articlesArray
  const articlesArrayWithStates = await sqlQueryArticlesWithStates();
  const statesByArticleId = new Map();
  for (const entry of articlesArrayWithStates) {
    if (!statesByArticleId.has(entry.articleId)) {
      statesByArticleId.set(entry.articleId, []);
    }
    statesByArticleId.get(entry.articleId).push({
      id: entry.stateId,
      name: entry.stateName,
      abbreviation: entry.abbreviation,
    });
  }

  // Create ARticle - Relevants Map for modifying the articleArray
  const articlesArrayWithRelevants = await sqlQueryArticlesIsRelevant();
  const isRelevantByArticleId = new Map();
  for (const entry of articlesArrayWithRelevants) {
    if (!isRelevantByArticleId.has(entry.articleId)) {
      isRelevantByArticleId.set(entry.articleId, []);
    }
    isRelevantByArticleId.get(entry.articleId).push({
      isRelevant: entry.isRelevant,
    });
  }

  // Create Article - Approved Map for modifying the articlesArray
  const articlesArrayWithApproveds = await sqlQueryArticlesApproved();
  const approvedByUserIdByArticleId = new Map();
  for (const entry of articlesArrayWithApproveds) {
    if (!approvedByUserIdByArticleId.has(entry.articleId)) {
      approvedByUserIdByArticleId.set(entry.articleId, []);
    }
    approvedByUserIdByArticleId.get(entry.articleId).push({
      userId: entry.userId,
    });
  }

  // Filter in JavaScript based on related tables
  const articlesMap = new Map();

  for (const row of articlesArray) {
    if (!articlesMap.has(row.articleId)) {
      articlesMap.set(row.articleId, {
        id: row.articleId,
        title: row.title,
        description: row.description,
        publishedDate: row.publishedDate,
        url: row.url,
        States: [],
        statesStringCommaSeparated: "",
        ArticleIsRelevant: true,
        // ArticleApproveds: [],
        articleIsApproved: false,
        keyword: "",
        NewsApiRequest: {
          andString: row.andString,
          orString: row.orString,
          notString: row.notString,
        },
      });
    }

    const article = articlesMap.get(row.articleId);

    // Check is articlesArrayWithStates contains the row.articleId
    if (statesByArticleId.has(row.articleId)) {
      const states = statesByArticleId.get(row.articleId);
      for (const state of states) {
        // Only push if not already present
        if (!article.States.some((s) => s.id === state.id)) {
          article.States.push(state);
        }
        // add comma separated abbreviation
        if (article.statesStringCommaSeparated === "") {
          article.statesStringCommaSeparated = state.abbreviation;
        } else {
          article.statesStringCommaSeparated =
            article.statesStringCommaSeparated + ", " + state.abbreviation;
        }
      }
    }

    // Check if isRelevant
    if (isRelevantByArticleId.has(row.articleId)) {
      article.ArticleIsRelevant = false;
    }

    if (approvedByUserIdByArticleId.has(row.articleId)) {
      article.articleIsApproved = true;
    }
    // if (row.approvedByUserId) {
    //   article.ArticleApproveds.push({ userId: row.approvedByUserId });
    // }

    if (article.NewsApiRequest?.andString) {
      article.keyword =
        article.keyword + `AND ${article.NewsApiRequest.andString}`;
    }
    if (article.NewsApiRequest?.orString) {
      article.keyword =
        article.keyword + ` OR ${article.NewsApiRequest.orString}`;
    }
    if (article.NewsApiRequest?.notString) {
      article.keyword =
        article.keyword + ` NOT ${article.NewsApiRequest.notString}`;
    }
  }

  let articlesArrayGrouped = Array.from(articlesMap.values());

  if (returnOnlyIsNotApproved) {
    articlesArrayGrouped = articlesArrayGrouped.filter((article) => {
      return !article.articleIsApproved;
    });
  }

  if (returnOnlyIsRelevant) {
    articlesArrayGrouped = articlesArrayGrouped.filter((article) => {
      return article.ArticleIsRelevant;
    });
  }

  // articlesFiltered = articlesArrayGrouped.filter((article) => {
  //   if (article.id === 42) {
  //     return true;
  //   }

  //   return false;
  // });

  res.json({ articlesArray: articlesArrayGrouped });
});

// 🔹 GET /articles/approved
router.get("/approved", authenticateToken, async (req, res) => {
  console.log("- GET /articles/approved");
  const startTime = Date.now();
  const articlesArray =
    await sqlQueryArticlesWithStatesApprovedReportContract();

  console.log(
    `- articlesArray.length (before filtering): ${articlesArray.length}`
  );

  const approvedArticlesArray = articlesArray.filter(
    (article) => article.ArticleApproveds?.length > 0
  );

  const approvedArticlesArrayModified = approvedArticlesArray.map((article) => {
    const isSubmitted =
      article.ArticleReportContracts.length > 0 ? "Yes" : "No";
    const articleHasBeenAcceptedByAll = article.ArticleReportContracts.every(
      (contract) => contract.articleAcceptedByCpsc === 1
    );
    return {
      ...article,
      isSubmitted,
      articleHasBeenAcceptedByAll,
    };
  });

  console.log(
    `- approvedArticlesArrayModified.length (after filtering): ${approvedArticlesArrayModified.length}`
  );

  const timeToRenderResponseFromApiInSeconds = (Date.now() - startTime) / 1000;
  res.json({
    articlesArray: approvedArticlesArrayModified,
    timeToRenderResponseFromApiInSeconds,
  });
});

// 🔹 POST /articles/update-approved
router.post("/update-approved", async (req, res) => {
  const { articleId, contentToUpdate } = req.body;
  console.log(`articleId: ${articleId}`);
  console.log(`contentToUpdate: ${contentToUpdate}`);

  const articleApprovedArrayOriginal = await ArticleApproved.findAll({
    where: { articleId },
  });

  let articleApprovedArrayModified = [];
  if (articleApprovedArrayOriginal.length > 0) {
    await ArticleApproved.update(
      {
        textForPdfReport: contentToUpdate,
      },
      {
        where: { articleId },
      }
    );

    articleApprovedArrayModified = await ArticleApproved.findAll({
      where: { articleId },
    });
  }

  return res.json({ result: true, articleApprovedArrayModified });
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
    return res.json({
      articleIsApproved: false,
      article: {},
    });
  }

  res.json({
    articleIsApproved: true,
    article: articleApproved.Article,
    content: articleApproved.textForPdfReport,
    States: articleApproved.Article.States,
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
  // Article count AND Article count since last Thursday at 20h
  const articlesArray = await sqlQueryArticles({});
  let articlesCount = articlesArray.length;
  let articlesSinceLastThursday20hEst = 0;
  const lastThursday20hEst = getLastThursdayAt20hInNyTimeZone();

  articlesArray.map((article) => {
    const articleCreatedAtDate = new Date(article.createdAt);
    if (articleCreatedAtDate >= lastThursday20hEst) {
      articlesSinceLastThursday20hEst++;
    }
  });

  // Article count with states
  const articlesArrayIncludeStates = await sqlQueryArticlesWithStates();
  const articlesArrayWithStatesSubset = articlesArrayIncludeStates.filter(
    (article) => article.stateId
  );
  const uniqueArticleIdsWithStatesSubset = [
    ...new Set(
      articlesArrayWithStatesSubset.map((article) => article.articleId)
    ),
  ];

  // Approved articles
  const articlesArrayApproved = await sqlQueryArticlesApproved();

  const uniqueArticleIdsApprovedSubset = [
    ...new Set(articlesArrayApproved.map((article) => article.articleId)),
  ];

  const articlesInReportArray = await sqlQueryArticlesReport();

  // articlesInReportArray.map((article) => {
  //   if (article.articleId === 27369) {
  //     console.log(article);
  //   }
  // });

  // Get all articleIds from articles in report
  const articleIdsInReport = [];
  articlesInReportArray.map((article) => {
    if (article.reportId) {
      articleIdsInReport.push(article.articleId);
    }
  });

  let approvedButNotInReport = [];
  articlesArrayApproved.map((article) => {
    if (!articleIdsInReport.includes(article.articleId)) {
      approvedButNotInReport.push(article);
    }
  });

  res.json({
    summaryStatistics: {
      articlesCount,
      articlesSinceLastThursday20hEst,
      articleHasStateCount: uniqueArticleIdsWithStatesSubset.length,
      articleIsApprovedCount: uniqueArticleIdsApprovedSubset.length,
      approvedButNotInReportCount: approvedButNotInReport.length,
    },
  });
});

// // 🔹 GET /articles/summary-statistics-obe
// router.get("/summary-statistics-obe", authenticateToken, async (req, res) => {
//   const articlesArray = await sqlQueryArticles({});
//   const articlesArrayWithSummaryStatistics =
//     await sqlQueryArticlesSummaryStatistics();

//   let articlesCount = articlesArray.length;
//   let articlesIsRelevantCount = 0;
//   let articlesIsApprovedCount = 0;
//   let hasStateAssigned = 0;

//   let approvedButNotInReport = 0;
//   let articlesSinceLastThursday20hEst = 0;
//   const lastThursday20hEst = getLastThursdayAt20hInNyTimeZone();

//   articlesArrayWithSummaryStatistics.map((article) => {
//     // articlesCount++;
//     if (article.isRelevant !== false) {
//       articlesIsRelevantCount++;
//     }
//     if (article.approvalCreatedAt) {
//       articlesIsApprovedCount++;
//     }
//     if (article.stateId) {
//       hasStateAssigned++;
//     }

//     const articleCreatedAtDate = new Date(article.createdAt);
//     if (articleCreatedAtDate >= lastThursday20hEst) {
//       articlesSinceLastThursday20hEst++;
//     }

//     if (!article.reportId && article.approvalCreatedAt) {
//       approvedButNotInReport++;
//     }
//   });

//   const summaryStatistics = {
//     articlesCount,
//     articlesIsRelevantCount,
//     articlesIsApprovedCount,
//     hasStateAssigned,
//     articlesSinceLastThursday20hEst,
//     approvedButNotInReport,
//   };
//   res.json({ summaryStatistics });
// });

// // 🔹 GET /articles/summary-stats-test
// router.get("/summary-stats-test", async (req, res) => {
//   const articlesInReportArray = await sqlQueryArticlesReport();

//   res.json({
//     articlesInReportArray: articlesInReportArray.splice(0, 120),
//   });
// });

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

// 🔹 POST /articles/is-being-reviewed/:articleId
router.post(
  "/is-being-reviewed/:articleId",
  authenticateToken,
  async (req, res) => {
    const { articleId } = req.params;
    const { isBeingReviewed } = req.body;
    const user = req.user;

    console.log(`articleId ${articleId}: ${isBeingReviewed}`);

    if (isBeingReviewed) {
      // Create or update the record
      await ArticleReviewed.upsert({
        articleId: articleId,
        userId: user.id,
      });
      return res.json({
        result: true,
        status: `articleId ${articleId} IS being reviewed`,
      });
    } else {
      // Remove the record if it exists
      await ArticleReviewed.destroy({
        where: { articleId },
      });
      return res.json({
        result: true,
        status: `articleId ${articleId} IS NOT being reviewed`,
      });
    }
  }
);
// 🔹 POST /articles/with-ratings - Get articles with ratings
router.post("/with-ratings", authenticateToken, async (req, res) => {
  console.log("- POST /articles/with-ratings");
  const startTime = Date.now();
  const {
    returnOnlyThisPublishedDateOrAfter,
    returnOnlyThisCreatedAtDateOrAfter,
    semanticScorerEntityName,
    zeroShotScorerEntityName,
    returnOnlyIsNotApproved,
    returnOnlyIsRelevant,
  } = req.body;

  let semanticScorerEntityId;
  let zeroShotScorerEntityId;

  if (semanticScorerEntityName) {
    const semanticScorerEntityObj = await ArtificialIntelligence.findOne({
      where: { name: semanticScorerEntityName },
    });
    semanticScorerEntityId = semanticScorerEntityObj.id;
  }

  if (zeroShotScorerEntityName) {
    const zeroShotScorerEntityObj = await ArtificialIntelligence.findOne({
      where: { name: zeroShotScorerEntityName },
    });
    zeroShotScorerEntityId = zeroShotScorerEntityObj.id;
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

    if (returnOnlyThisCreatedAtDateOrAfter) {
      whereClause.createdAt = {
        [require("sequelize").Op.gte]: new Date(
          returnOnlyThisCreatedAtDateOrAfter
        ),
      };
    }
    const articlesArray = await sqlQueryArticlesForWithRatingsRoute(
      returnOnlyThisCreatedAtDateOrAfter,
      returnOnlyThisPublishedDateOrAfter
    );

    // Step 2: Filter articles
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
        article.ArticleIsRelevants.some((entry) => entry.isRelevant !== null)
      ) {
        return false;
      }
      return true;
    });

    // console.log(
    //   articlesArrayFiltered[0].NewsApiRequest.newsArticleAggregatorSourceId
    // );
    let counter = 0;

    // 🔹 Step 3: Build final article objects
    // const finalArticles = articlesArray.map((article) => {
    const finalArticles = articlesArrayFiltered.map((article) => {
      const statesStringCommaSeparated = article.States.map(
        (state) => state.name
      ).join(", ");

      let isRelevant = true;
      if (article.ArticleIsRelevants.every((entry) => entry.isRelevant === 0)) {
        isRelevant = false;
      }
      // const isRelevant = article.ArticleIsRelevants.every(
      //   (entry) => entry.isRelevant !== null
      // );
      const isApproved =
        article.ArticleApproveds &&
        article.ArticleApproveds.some((entry) => entry.userId !== null);

      // let keyword = "";
      let requestQueryString = "";
      if (article.NewsApiRequest?.andString)
        requestQueryString += `AND ${article.NewsApiRequest.andString}`;
      if (article.NewsApiRequest?.orString)
        requestQueryString += ` OR ${article.NewsApiRequest.orString}`;
      if (article.NewsApiRequest?.notString)
        requestQueryString += ` NOT ${article.NewsApiRequest.notString}`;

      let nameOfOrg = "";
      if (article.NewsApiRequest?.NewsArticleAggregatorSource?.nameOfOrg) {
        nameOfOrg =
          article.NewsApiRequest.NewsArticleAggregatorSource.nameOfOrg;
      }

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

      const isBeingReviewed = article.ArticleRevieweds?.length > 0;

      return {
        id: article.id,
        title: article.title,
        description: article.description,
        publishedDate: article.publishedDate,
        publicationName: article.publicationName,
        url: article.url,
        States: article.States,
        statesStringCommaSeparated,
        isRelevant,
        isApproved,
        requestQueryString,
        nameOfOrg,
        semanticRatingMaxLabel,
        semanticRatingMax,
        zeroShotRatingMaxLabel,
        zeroShotRatingMax,
        isBeingReviewed,
      };
    });
    // console.log("counter: ", counter);
    const timeToRenderResponseFromApiInSeconds =
      (Date.now() - startTime) / 1000;
    console.log(
      `timeToRenderResponseFromApiInSeconds: ${timeToRenderResponseFromApiInSeconds}`
    );
    res.json({
      articleCount: finalArticles.length,
      articlesArray: finalArticles,
      timeToRenderResponseFromApiInSeconds,
    });
  } catch (error) {
    console.error("❌ Error in /articles/with-ratings:", error);
    res.status(500).json({ error: "Failed to fetch articles with ratings." });
  }
});

// 🔹 POST /articles/table-approved-by-request
router.post(
  "/table-approved-by-request",
  authenticateToken,
  async (req, res) => {
    console.log("- POST /articles/table-approved-by-request");
    let { dateRequestsLimit } = req.body;
    if (!dateRequestsLimit) {
      dateRequestsLimit = null;
    }

    try {
      const requestsArray = await createNewsApiRequestsArray();
      const { requestIdArray, manualFoundCount } =
        await createArticlesApprovedArray(dateRequestsLimit);

      // Count how many times each requestId appears in requestIdArray
      const countMap = {};
      for (const id of requestIdArray) {
        countMap[id] = (countMap[id] || 0) + 1;
      }

      // Add countOfApprovedArticles to each request in the array
      const requestsArrayWithCounts = requestsArray.map((request) => ({
        ...request,
        // date: request.createdAt,
        countOfApprovedArticles: countMap[request.id] || 0,
      }));

      // Filter out requests with no approved articles
      const filteredRequestsArray = requestsArrayWithCounts.filter(
        (request) => {
          // if (request.id === 6002) {
          //   console.log(request);
          // }
          return request.countOfApprovedArticles > 0;
        }
      );

      // Sort by count descending
      const sortedRequestsArray = filteredRequestsArray.sort(
        (a, b) => b.countOfApprovedArticles - a.countOfApprovedArticles
      );

      // const outputFilePath = path.join(
      //   process.env.PATH_TO_UTILITIES_ANALYSIS_SPREADSHEETS,
      //   `approved_by_request_${new Date().toISOString().split("T")[0]}.xlsx`
      // );
      // await createSpreadsheetFromArray(sortedRequestsArray, outputFilePath);
      // console.log(`✅ Excel file saved to: ${outputFilePath}`);

      res.json({
        countOfApprovedArticles: requestIdArray.length + manualFoundCount,
        countOfManuallyApprovedArticles: manualFoundCount,
        requestsArray: sortedRequestsArray,
      });
    } catch (error) {
      console.error("❌ Error in /articles/table-approved-by-request:", error);
      res.status(500).json({ error: "Failed to fetch request summary." });
    }
  }
);

// // 🔹 GET /articles/download/table-approved-by-request - Download Report
// router.get(
//   "/download/table-approved-by-request",
//   authenticateToken,
//   async (req, res) => {
//     console.log(`- in GET /articles/download/table-approved-by-request`);

//     try {
//       const filename = `approved_by_request_${
//         new Date().toISOString().split("T")[0]
//       }.xlsx`;
//       const filePathAndName = path.join(
//         process.env.PATH_TO_UTILITIES_ANALYSIS_SPREADSHEETS,
//         filename
//       );

//       // Check if file exists
//       if (!fs.existsSync(filePathAndName)) {
//         return res
//           .status(404)
//           .json({ result: false, message: "File not found." });
//       } else {
//         console.log(`----> File exists: ${filePathAndName}`);
//       }

//       res.setHeader(
//         "Content-Type",
//         "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
//       );
//       res.setHeader(
//         "Content-Disposition",
//         `attachment; filename="${filename}"`
//       );

//       // Let Express handle download
//       res.download(filePathAndName, filename, (err) => {
//         if (err) {
//           console.error("Download error:", err);
//           res
//             .status(500)
//             .json({ result: false, message: "File download failed." });
//         }
//       });
//     } catch (error) {
//       console.error("Error processing request:", error);
//       res.status(500).json({
//         result: false,
//         message: "Internal server error",
//         error: error.message,
//       });
//     }
//   }
// );

module.exports = router;
