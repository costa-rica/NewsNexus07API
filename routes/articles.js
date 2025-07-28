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
  EntityWhoCategorizedArticle,
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
  // sqlQueryArticlesForWithRatingsRouteNoAi,
  sqlQueryArticlesAndAiScores,
} = require("../modules/queriesSql");

// router.post("/test", async (req, res) => {
//   const articlesArrayWithRelevants = await sqlQueryArticlesIsRelevant();
//   const isRelevantByArticleId = new Map();
//   for (const entry of articlesArrayWithRelevants) {
//     if (!isRelevantByArticleId.has(entry.articleId)) {
//       isRelevantByArticleId.set(entry.articleId, []);
//     }
//     isRelevantByArticleId.get(entry.articleId).push({
//       articleId: entry.articleId,
//       isRelevant: entry.isRelevant,
//     });
//   }

//   let articlesArrayGrouped = Array.from(isRelevantByArticleId.values());
//   res.json({ articlesArrayGrouped });
// });

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
    // publicationNameForPdfReport,
    // publicationDateForPdfReport,
    // textForPdfReport,
    // urlForPdfReport,
    // kmNotes,
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
  // try {
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
  const articlesArrayFilteredNoAi = articlesArray.filter((article) => {
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

  // Step 2.1: Get AI scores
  const artificialIntelligenceObject01 = await ArtificialIntelligence.findOne({
    where: { name: semanticScorerEntityName },
    include: [EntityWhoCategorizedArticle],
  });
  if (!artificialIntelligenceObject01) {
    return res.status(404).json({ message: "AI not found." });
  }
  const entityWhoCategorizedArticleId01 =
    artificialIntelligenceObject01.EntityWhoCategorizedArticles[0].id;

  if (!artificialIntelligenceObject01.EntityWhoCategorizedArticles?.length) {
    return res
      .status(500)
      .json({ message: "No related EntityWhoCategorizedArticles found" });
  }

  const articlesIdArray = articlesArrayFilteredNoAi.map(
    (article) => article.id
  );

  const articlesAndAiScores = await sqlQueryArticlesAndAiScores(
    articlesIdArray,
    entityWhoCategorizedArticleId01
  );
  const articlesArrayFilteredWithSemanticScorer = articlesArrayFilteredNoAi.map(
    (article) => {
      const aiScore = articlesAndAiScores.find(
        (score) => score.articleId === article.id
      );
      return {
        ...article,
        semanticRatingMax: aiScore?.keywordRating,
        semanticRatingMaxLabel: aiScore?.keyword,
      };
    }
  );

  // Step 2.2: Get zero shot Location Classifier scores

  const artificialIntelligenceObject02 = await ArtificialIntelligence.findOne({
    where: { name: "NewsNexusClassifierLocationScorer01" },
    include: [EntityWhoCategorizedArticle],
  });
  if (!artificialIntelligenceObject02) {
    return res.status(404).json({ message: "AI not found." });
  }
  const entityWhoCategorizedArticleId02 =
    artificialIntelligenceObject02.EntityWhoCategorizedArticles[0].id;

  const articlesAndLocationClassifierScoresArray =
    await sqlQueryArticlesAndAiScores(
      articlesIdArray,
      entityWhoCategorizedArticleId02
    );

  const articlesArrayWithBothAiScores =
    articlesArrayFilteredWithSemanticScorer.map((article) => {
      const locationClassifierScore =
        articlesAndLocationClassifierScoresArray.find(
          (score) => score.articleId === article.id
        );
      return {
        ...article,
        locationClassifierScore: locationClassifierScore?.keywordRating,
        locationClassifierScoreLabel: locationClassifierScore?.keyword,
      };
    });

  // 🔹 Step 3: Build final article objects
  const finalArticles = articlesArrayWithBothAiScores.map((article) => {
    const statesStringCommaSeparated = article.States.map(
      (state) => state.name
    ).join(", ");

    let isRelevant = true;
    if (article.ArticleIsRelevants.every((entry) => entry.isRelevant === 0)) {
      isRelevant = false;
    }
    const isApproved =
      article.ArticleApproveds &&
      article.ArticleApproveds.some((entry) => entry.userId !== null);

    let requestQueryString = "";
    if (article.NewsApiRequest?.andString)
      requestQueryString += `AND ${article.NewsApiRequest.andString}`;
    if (article.NewsApiRequest?.orString)
      requestQueryString += ` OR ${article.NewsApiRequest.orString}`;
    if (article.NewsApiRequest?.notString)
      requestQueryString += ` NOT ${article.NewsApiRequest.notString}`;

    let nameOfOrg = "";
    if (article.NewsApiRequest?.NewsArticleAggregatorSource?.nameOfOrg) {
      nameOfOrg = article.NewsApiRequest.NewsArticleAggregatorSource.nameOfOrg;
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
      semanticRatingMaxLabel: article.semanticRatingMaxLabel,
      semanticRatingMax: article.semanticRatingMax,
      locationClassifierScoreLabel: article.locationClassifierScoreLabel,
      locationClassifierScore: article.locationClassifierScore,
      isBeingReviewed,
    };
  });

  const timeToRenderResponseFromApiInSeconds = (Date.now() - startTime) / 1000;
  console.log(
    `timeToRenderResponseFromApiInSeconds: ${timeToRenderResponseFromApiInSeconds}`
  );
  res.json({
    articleCount: finalArticles.length,
    articlesArray: finalArticles,
    // articlesArray: articlesArrayFilteredWithSemanticScorer,
    timeToRenderResponseFromApiInSeconds,
  });
  // } catch (error) {
  //   console.error("❌ Error in /articles/with-ratings:", error);
  //   res.status(500).json({ error: "Failed to fetch articles with ratings." });
  // }
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

// GET /articles/test
router.get("/test-sql", authenticateToken, async (req, res) => {
  const articlesArray = await sqlQueryArticlesForWithRatingsRouteNoAi();
  const articleIdArray = articlesArray.map((article) => article.id);

  // AI 01 : NewsNexusSemanticScorer02
  // AI 02 : NewsNexusClassifierLocationScorer01
  const artificialIntelligenceObject = await ArtificialIntelligence.findOne({
    where: { name: "NewsNexusSemanticScorer02" },
    include: [EntityWhoCategorizedArticle],
  });
  if (!artificialIntelligenceObject) {
    return res.status(404).json({ error: "AI not found." });
  }
  const entityWhoCategorizedArticleId =
    artificialIntelligenceObject.EntityWhoCategorizedArticles[0].id;

  const articlesAndAiScores = await sqlQueryArticlesAndAiScores(
    articleIdArray,
    entityWhoCategorizedArticleId
  );
  const articlesArrayModified = articlesArray.map((article) => {
    const aiScore = articlesAndAiScores.find(
      (score) => score.articleId === article.id
    );
    return {
      ...article,
      // aiScore,
      semanticRatingMax: aiScore?.keywordRating,
      semanticRatingMaxLabel: aiScore?.keyword,
    };
  });

  res.json({ articlesArrayModified });
});

module.exports = router;
