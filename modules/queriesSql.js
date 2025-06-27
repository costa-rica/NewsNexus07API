const { sequelize } = require("newsnexus07db");

// async function sqlQueryArticlesWithRatings({ publishedDate, createdAt }) {
//   // ------ NOTE -----------------------------------
//   // This funciton replaces:
//   // const articlesArray = await Article.findAll({
//   //   where: whereClause,
//   //   include: [
//   //     { model: State, through: { attributes: [] } },
//   //     { model: ArticleIsRelevant },
//   //     { model: ArticleApproved },
//   //     {
//   //       model: NewsApiRequest,
//   //       include: [
//   //         {
//   //           model: NewsArticleAggregatorSource,
//   //         },
//   //       ],
//   //     },
//   //     { model: ArticleEntityWhoCategorizedArticleContract },
//   //     { model: ArticleReviewed },
//   //   ],
//   // });
//   // -----------------------------------------

//   const replacements = {};
//   const whereClauses = [];

//   if (publishedDate) {
//     whereClauses.push(`a."publishedDate" >= :publishedDate`);
//     replacements.publishedDate = publishedDate;
//   }

//   if (createdAt) {
//     whereClauses.push(`a."createdAt" >= :createdAt`);
//     replacements.createdAt = createdAt;
//   }

//   const whereString =
//     whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

//   const sql = `
//     SELECT
//       a.id AS "articleId",
//       a.title,
//       a.description,
//       a."publishedDate",
//       a."publicationName",
//       a.url,
//       s.id AS "stateId",
//       s.name AS "stateName",
//       ar."isRelevant",
//       aa."userId" AS "approvedByUserId",
//       nar."andString",
//       nar."orString",
//       nar."notString",
//       nas."nameOfOrg",
//       arc."entityWhoCategorizesId",
//       arc."keyword",
//       arc."keywordRating",
//       arw."userId" AS "reviewedByUserId"
//     FROM "Articles" a
//     LEFT JOIN "ArticleStateContracts" asc ON a.id = asc."articleId"
//     LEFT JOIN "States" s ON asc."stateId" = s.id
//     LEFT JOIN "ArticleIsRelevants" ar ON ar."articleId" = a.id
//     LEFT JOIN "ArticleApproveds" aa ON aa."articleId" = a.id
//     LEFT JOIN "NewsApiRequests" nar ON nar.id = a."newsApiRequestId"
//     LEFT JOIN "NewsArticleAggregatorSources" nas ON nas.id = nar."newsArticleAggregatorSourceId"
//     LEFT JOIN "ArticleEntityWhoCategorizedArticleContracts" arc ON arc."articleId" = a.id
//     LEFT JOIN "ArticleRevieweds" arw ON arw."articleId" = a.id
//     ${whereString}
//     ORDER BY a.id;
//   `;

//   const results = await sequelize.query(sql, {
//     replacements,
//     type: sequelize.QueryTypes.SELECT,
//   });

//   return results;
// }

async function sqlQueryArticlesSummaryStatistics() {
  // ------ NOTE -----------------------------------
  //  const articlesArray = await Article.findAll({
  //   include: [
  //     {
  //       model: State,
  //       through: { attributes: [] }, // omit ArticleStateContract from result
  //     },
  //     {
  //       model: ArticleIsRelevant,
  //     },
  //     {
  //       model: ArticleApproved,
  //     },
  //   ],
  // });
  // -----------------------------------------

  const sql = `
  SELECT
    a.id AS "articleId",
    a."createdAt",
    ar."isRelevant",
    aa."createdAt" AS "approvalCreatedAt",
    s.id AS "stateId",
    arc."reportId"
  FROM "Articles" a
  LEFT JOIN "ArticleIsRelevants" ar ON ar."articleId" = a.id
  LEFT JOIN "ArticleApproveds" aa ON aa."articleId" = a.id
  LEFT JOIN "ArticleStateContracts" asc ON asc."articleId" = a.id
  LEFT JOIN "States" s ON s.id = asc."stateId"
  LEFT JOIN "ArticleReportContracts" arc ON arc."articleId" = a.id;
`;

  const results = await sequelize.query(sql, {
    type: sequelize.QueryTypes.SELECT,
  });

  return results;
}

async function sqlQueryArticlesApproved() {
  // ------ NOTE -----------------------------------
  //  const articlesArray = await Article.findAll({
  //   include: [
  //     {
  //       model: State,
  //       through: { attributes: [] },
  //     },
  //     {
  //       model: ArticleIsRelevant,
  //     },
  //     {
  //       model: ArticleApproved,
  //     },
  //     {
  //       model: NewsApiRequest,
  //     },
  //     { model: ArticleReportContract },
  //   ],
  // });
  // -----------------------------------------
  const sql = `
    SELECT
      a.id AS "articleId",
      a.title,
      a.description,
      a."publishedDate",
      a."createdAt",
      a.url,
      s.id AS "stateId",
      s.name AS "stateName",
      aa."userId" AS "approvedByUserId",
      arc.id AS "reportContractId",
      arc."articleReferenceNumberInReport"
    FROM "Articles" a
    LEFT JOIN "ArticleStateContracts" asc ON asc."articleId" = a.id
    LEFT JOIN "States" s ON s.id = asc."stateId"
    INNER JOIN "ArticleApproveds" aa ON aa."articleId" = a.id
    LEFT JOIN "ArticleReportContracts" arc ON arc."articleId" = a.id
    ORDER BY a.id;
  `;

  const results = await sequelize.query(sql, {
    type: sequelize.QueryTypes.SELECT,
  });

  return results;
}

async function sqlQueryRequestsFromApi({
  dateLimitOnRequestMade,
  includeIsFromAutomation,
}) {
  // ------ NOTE -----------------------------------
  // const newsApiRequestsArray = await NewsApiRequest.findAll({
  //   where: whereClause,
  //   include: [
  //     {
  //       model: NewsArticleAggregatorSource,
  //     },
  //     {
  //       model: NewsApiRequestWebsiteDomainContract,
  //       include: [
  //         {
  //           model: WebsiteDomain,
  //         },
  //       ],
  //     },
  //   ],
  // });
  // -----------------------------------------
  const replacements = {};
  const whereClauses = [];

  if (dateLimitOnRequestMade) {
    whereClauses.push(`nar."createdAt" >= :dateLimitOnRequestMade`);
    replacements.dateLimitOnRequestMade = dateLimitOnRequestMade;
  }

  if (includeIsFromAutomation !== true) {
    whereClauses.push(`nar."isFromAutomation" = false`);
  }

  const whereString =
    whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

  const sql = `
    SELECT
      nar.id AS "newsApiRequestId",
      nar."createdAt",
      nar."dateStartOfRequest",
      nar."dateEndOfRequest",
      nar."countOfArticlesReceivedFromRequest",
      nar."countOfArticlesSavedToDbFromRequest",
      nar.status,
      nar."andString",
      nar."orString",
      nar."notString",
      nas."nameOfOrg",
      wd."name" AS "domainName",
      ndc."includedOrExcludedFromRequest"
    FROM "NewsApiRequests" nar
    LEFT JOIN "NewsArticleAggregatorSources" nas ON nas.id = nar."newsArticleAggregatorSourceId"
    LEFT JOIN "NewsApiRequestWebsiteDomainContracts" ndc ON ndc."newsApiRequestId" = nar.id
    LEFT JOIN "WebsiteDomains" wd ON wd.id = ndc."websiteDomainId"
    ${whereString}
    ORDER BY nar."createdAt" DESC;
  `;

  const results = await sequelize.query(sql, {
    replacements,
    type: sequelize.QueryTypes.SELECT,
  });

  return results;
}

async function sqlQueryArticlesOld({ publishedDate }) {
  // ------ NOTE -----------------------------------
  // const articlesArray = await Article.findAll({
  //   where: whereClause,
  //   include: [
  //     {
  //       model: State,
  //       through: { attributes: [] },
  //     },
  //     {
  //       model: ArticleIsRelevant,
  //     },
  //     {
  //       model: ArticleApproved,
  //     },
  //     {
  //       model: NewsApiRequest,
  //     },
  //   ],
  // });
  // -----------------------------------------
  const replacements = {};
  const whereClauses = [];

  if (publishedDate) {
    whereClauses.push(`a."publishedDate" >= :publishedDate`);
    replacements.publishedDate = publishedDate;
  }

  const whereString =
    whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

  const sql = `
      SELECT
        a.id AS "articleId",
        a.title,
        a.description,
        a."publishedDate",
        a.url,
        s.id AS "stateId",
        s.name AS "stateName",
        ar."isRelevant",
        aa."userId" AS "approvedByUserId",
        nar."andString",
        nar."orString",
        nar."notString"
      FROM "Articles" a
      LEFT JOIN "ArticleStateContracts" asc ON a.id = asc."articleId"
      LEFT JOIN "States" s ON asc."stateId" = s.id
      LEFT JOIN "ArticleIsRelevants" ar ON ar."articleId" = a.id
      LEFT JOIN "ArticleApproveds" aa ON aa."articleId" = a.id
      LEFT JOIN "NewsApiRequests" nar ON nar.id = a."newsApiRequestId"
      ${whereString}
      ORDER BY a.id;
    `;

  const results = await sequelize.query(sql, {
    replacements,
    type: sequelize.QueryTypes.SELECT,
  });

  return results;
}

// --- New method of creating SQL query functions
async function sqlQueryArticles({ publishedDate }) {
  // ------ NOTE -----------------------------------
  // const articlesArray = await Article.findAll({
  //   where: whereClause,
  //   include: [
  //     {
  //       model: State,
  //       through: { attributes: [] },
  //     },
  //     {
  //       model: ArticleIsRelevant,
  //     },
  //     {
  //       model: ArticleApproved,
  //     },
  //     {
  //       model: NewsApiRequest,
  //     },
  //   ],
  // });
  // -----------------------------------------
  const replacements = {};
  const whereClauses = [];

  if (publishedDate) {
    whereClauses.push(`a."publishedDate" >= :publishedDate`);
    replacements.publishedDate = publishedDate;
  }

  const whereString =
    whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

  const sql = `
      SELECT
        a.id AS "articleId",
        a.title,
        a.description,
        a."publishedDate",
        a.url,
        s.id AS "stateId",
        s.name AS "stateName",
        ar."isRelevant",
        aa."userId" AS "approvedByUserId",
        nar."andString",
        nar."orString",
        nar."notString"
      FROM "Articles" a
      LEFT JOIN "ArticleStateContracts" asc ON a.id = asc."articleId"
      LEFT JOIN "States" s ON asc."stateId" = s.id
      LEFT JOIN "ArticleIsRelevants" ar ON ar."articleId" = a.id
      LEFT JOIN "ArticleApproveds" aa ON aa."articleId" = a.id
      LEFT JOIN "NewsApiRequests" nar ON nar.id = a."newsApiRequestId"
      ${whereString}
      ORDER BY a.id;
    `;

  const results = await sequelize.query(sql, {
    replacements,
    type: sequelize.QueryTypes.SELECT,
  });

  return results;
}

async function sqlQueryArticlesWithStatesApprovedReportContract() {
  const sql = `
    SELECT
      a.id AS "articleId",
      a.title,
      a.description,
      a.publishedDate,
      a.createdAt,
      a.publicationName,
      a.url,
      a.author,
      a.urlToImage,
      a.entityWhoFoundArticleId,
      a.newsApiRequestId,
      a.newsRssRequestId,
      s.id AS "stateId",
      s.name AS "stateName",
      s.abbreviation AS "stateAbbreviation",
      aa.id AS "approvedId",
      aa."userId" AS "approvedByUserId",
      aa."createdAt" AS "approvedAt",
      aa."isApproved",
      aa."headlineForPdfReport",
      aa."publicationNameForPdfReport",
      aa."publicationDateForPdfReport",
      aa."textForPdfReport",
      aa."urlForPdfReport",
      aa."kmNotes",
      arc.id AS "reportContractId",
      arc."reportId",
      arc."articleReferenceNumberInReport",
      arc."articleAcceptedByCpsc",
      arc."articleRejectionReason"
    FROM "Articles" a
    LEFT JOIN "ArticleStateContracts" asc ON a.id = asc."articleId"
    LEFT JOIN "States" s ON s.id = asc."stateId"
    LEFT JOIN "ArticleApproveds" aa ON aa."articleId" = a.id
    LEFT JOIN "ArticleReportContracts" arc ON arc."articleId" = a.id
    ORDER BY a.id;
  `;

  const flatResults = await sequelize.query(sql, {
    type: sequelize.QueryTypes.SELECT,
  });

  const articlesMap = new Map();

  for (const row of flatResults) {
    const {
      articleId,
      title,
      description,
      publishedDate,
      createdAt,
      publicationName,
      url,
      author,
      urlToImage,
      entityWhoFoundArticleId,
      newsApiRequestId,
      newsRssRequestId,
      stateId,
      stateName,
      stateAbbreviation,
      approvedId,
      approvedByUserId,
      approvedAt,
      isApproved,
      headlineForPdfReport,
      publicationNameForPdfReport,
      publicationDateForPdfReport,
      textForPdfReport,
      urlForPdfReport,
      kmNotes,
      reportContractId,
      reportId,
      articleReferenceNumberInReport,
      articleAcceptedByCpsc,
      articleRejectionReason,
    } = row;

    if (!articlesMap.has(articleId)) {
      articlesMap.set(articleId, {
        id: articleId,
        title,
        description,
        publishedDate,
        createdAt,
        publicationName,
        url,
        author,
        urlToImage,
        entityWhoFoundArticleId,
        newsApiRequestId,
        newsRssRequestId,
        States: [],
        ArticleApproveds: [],
        ArticleReportContracts: [],
      });
    }

    if (stateId) {
      const stateExists = articlesMap
        .get(articleId)
        .States.some((s) => s.id === stateId);
      if (!stateExists) {
        articlesMap.get(articleId).States.push({
          id: stateId,
          name: stateName,
          abbreviation: stateAbbreviation,
        });
      }
    }

    if (approvedId) {
      const approvedExists = articlesMap
        .get(articleId)
        .ArticleApproveds.some((a) => a.id === approvedId);
      if (!approvedExists) {
        articlesMap.get(articleId).ArticleApproveds.push({
          id: approvedId,
          userId: approvedByUserId,
          createdAt: approvedAt,
          isApproved,
          headlineForPdfReport,
          publicationNameForPdfReport,
          publicationDateForPdfReport,
          textForPdfReport,
          urlForPdfReport,
          kmNotes,
        });
      }
    }

    if (reportContractId) {
      articlesMap.get(articleId).ArticleReportContracts.push({
        id: reportContractId,
        reportId,
        articleReferenceNumberInReport,
        articleAcceptedByCpsc,
        articleRejectionReason,
      });
    }
  }

  return Array.from(articlesMap.values());
}

async function sqlQueryArticlesForWithRatingsRoute(
  returnOnlyThisCreatedAtDateOrAfter,
  returnOnlyThisPublishedDateOrAfter
) {
  const replacements = {};
  const whereClauses = [];

  if (returnOnlyThisCreatedAtDateOrAfter) {
    whereClauses.push(`a."createdAt" >= :returnOnlyThisCreatedAtDateOrAfter`);
    replacements.returnOnlyThisCreatedAtDateOrAfter =
      returnOnlyThisCreatedAtDateOrAfter;
  }

  if (returnOnlyThisPublishedDateOrAfter) {
    whereClauses.push(
      `a."publishedDate" >= :returnOnlyThisPublishedDateOrAfter`
    );
    replacements.returnOnlyThisPublishedDateOrAfter =
      returnOnlyThisPublishedDateOrAfter;
  }

  const whereClause =
    whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";
  const sql = `
    SELECT
      a.id,
      a."createdAt",
      a."newsApiRequestId",
      a."title",
      a."description",
      a."publishedDate",
      a."publicationName",
      a."url",

      -- NewsApiRequest fields
      nar."andString" AS "NewsApiRequest.andString",
      nar."orString" AS "NewsApiRequest.orString",
      nar."notString" AS "NewsApiRequest.notString",
      nar.id AS "NewsApiRequest.id",
      nar."createdAt" AS "NewsApiRequest.createdAt",

      -- NewsArticleAggregatorSource fields
      nas.id AS "NewsApiRequest.NewsArticleAggregatorSource.id",
      nas."nameOfOrg" AS "NewsApiRequest.NewsArticleAggregatorSource.nameOfOrg",

      -- Review / Approval / Relevance
      ar."isRelevant",
      ar."userId" AS "ArticleIsRelevant.userId",
      ar."articleId" AS "ArticleIsRelevant.articleId",
      ar."isRelevant" AS "ArticleIsRelevant.isRelevant",
      aa.id AS "ArticleApproved.id",
      aa."userId" AS "ArticleApproved.userId",
      aa."articleId" AS "ArticleApproved.articleId",
      aa."isApproved" AS "ArticleApproved.isApproved",
      s.id AS "stateId",
      s.id AS "States.id",
      s.name AS "States.name",
      s.abbreviation AS "States.abbreviation",
      s."createdAt" AS "States.createdAt",
      s."updatedAt" AS "States.updatedAt",

      -- ArticleEntityWhoCategorizedArticleContract fields
      aewcac.id AS "ArticleEntityWhoCategorizedArticleContract.id",
      aewcac."articleId" AS "ArticleEntityWhoCategorizedArticleContract.articleId",
      aewcac."entityWhoCategorizesId" AS "ArticleEntityWhoCategorizedArticleContract.entityWhoCategorizesId",
      aewcac."keyword" AS "ArticleEntityWhoCategorizedArticleContract.keyword",
      aewcac."keywordRating" AS "ArticleEntityWhoCategorizedArticleContract.keywordRating"

    FROM "Articles" a
    LEFT JOIN "ArticleIsRelevants" ar ON ar."articleId" = a.id
    LEFT JOIN "ArticleApproveds" aa ON aa."articleId" = a.id
    LEFT JOIN "ArticleStateContracts" asc ON asc."articleId" = a.id
    LEFT JOIN "States" s ON s.id = asc."stateId"

    LEFT JOIN "NewsApiRequests" nar ON nar.id = a."newsApiRequestId"
    LEFT JOIN "NewsArticleAggregatorSources" nas ON nas.id = nar."newsArticleAggregatorSourceId"

    LEFT JOIN "ArticleEntityWhoCategorizedArticleContracts" aewcac ON aewcac."articleId" = a.id

    ${whereClause}
    ORDER BY a.id;
  `;

  // const results = await sequelize.query(sql, {
  //   type: sequelize.QueryTypes.SELECT,
  // });

  // console
  const rawResults = await sequelize.query(sql, {
    replacements,
    type: sequelize.QueryTypes.SELECT,
  });

  const articleMap = {};

  for (const row of rawResults) {
    const {
      id,
      createdAt,
      newsApiRequestId,
      title,
      description,
      publishedDate,
      url,
      isRelevant,
      approvalCreatedAt,
      publicationName,

      // NewsApiRequest
      "NewsApiRequest.id": narId,
      "NewsApiRequest.createdAt": narCreatedAt,
      "NewsApiRequest.andString": andString,
      "NewsApiRequest.orString": orString,
      "NewsApiRequest.notString": notString,

      // Aggregator
      "NewsApiRequest.NewsArticleAggregatorSource.id": nasId,
      "NewsApiRequest.NewsArticleAggregatorSource.nameOfOrg": nasName,

      // State
      "States.id": stateId,
      "States.name": stateName,
      "States.abbreviation": stateAbbr,
      "States.createdAt": stateCreatedAt,
      "States.updatedAt": stateUpdatedAt,
    } = row;

    if (!articleMap[id]) {
      articleMap[id] = {
        id,
        createdAt,
        newsApiRequestId,
        title,
        description,
        publishedDate,
        url,
        publicationName,
        isRelevant,
        approvalCreatedAt,
        NewsApiRequest: {
          id: narId,
          createdAt: narCreatedAt,
          andString,
          orString,
          notString,
          NewsArticleAggregatorSource: {
            id: nasId,
            nameOfOrg: nasName,
          },
        },
        States: [],
        ArticleIsRelevants: [],
        ArticleApproveds: [],
        ArticleEntityWhoCategorizedArticleContracts: [],
      };
    }

    if (stateId && !articleMap[id].States.some((s) => s.id === stateId)) {
      articleMap[id].States.push({
        id: stateId,
        name: stateName,
        abbreviation: stateAbbr,
        createdAt: stateCreatedAt,
        updatedAt: stateUpdatedAt,
      });
    }
    if (
      !articleMap[id].ArticleIsRelevants.some(
        (ar) => ar.id === row["ArticleIsRelevant.id"]
      )
    ) {
      articleMap[id].ArticleIsRelevants.push({
        id: row["ArticleIsRelevant.id"],
        userId: row["ArticleIsRelevant.userId"],
        articleId: row["ArticleIsRelevant.articleId"],
        isRelevant: row["ArticleIsRelevant.isRelevant"],
      });
    }
    const approvedId = row["ArticleApproved.id"];
    if (
      approvedId !== null &&
      !articleMap[id].ArticleApproveds.some((aa) => aa.id === approvedId)
    ) {
      articleMap[id].ArticleApproveds.push({
        id: approvedId,
        userId: row["ArticleApproved.userId"],
        articleId: row["ArticleApproved.articleId"],
        isApproved: row["ArticleApproved.isApproved"],
      });
    }

    const entityWhoCategorizedArticleContractId =
      row["ArticleEntityWhoCategorizedArticleContract.id"];
    if (
      entityWhoCategorizedArticleContractId !== null &&
      !articleMap[id].ArticleEntityWhoCategorizedArticleContracts.some(
        (ewcac) => ewcac.id === entityWhoCategorizedArticleContractId
      )
    ) {
      articleMap[id].ArticleEntityWhoCategorizedArticleContracts.push({
        id: entityWhoCategorizedArticleContractId,
        articleId: row["ArticleEntityWhoCategorizedArticleContract.articleId"],
        entityWhoCategorizesId:
          row[
            "ArticleEntityWhoCategorizedArticleContract.entityWhoCategorizesId"
          ],
        keyword: row["ArticleEntityWhoCategorizedArticleContract.keyword"],
        keywordRating:
          row["ArticleEntityWhoCategorizedArticleContract.keywordRating"],
      });
    }
  }

  const results = Object.values(articleMap);
  return results;
  // const results = rawResults.map((row) => {
  //   const {
  //     // Flattened fields
  //     "NewsApiRequest.id": newsApiRequestId,
  //     "NewsApiRequest.createdAt": newsApiRequestCreatedAt,
  //     "NewsApiRequest.andString": andString,
  //     "NewsApiRequest.orString": orString,
  //     "NewsApiRequest.notString": notString,
  //     "NewsApiRequest.NewsArticleAggregatorSource.id": nasId,
  //     "NewsApiRequest.NewsArticleAggregatorSource.nameOfOrg": nasName,

  //     ...articleFields
  //   } = row;

  //   return {
  //     ...articleFields,
  //     NewsApiRequest: {
  //       id: newsApiRequestId,
  //       createdAt: newsApiRequestCreatedAt,
  //       andString,
  //       orString,
  //       notString,
  //       NewsArticleAggregatorSource: {
  //         id: nasId,
  //         nameOfOrg: nasName,
  //       },
  //     },
  //   };
  // });

  // return results;
}

module.exports = {
  sqlQueryArticles,
  sqlQueryArticlesOld,
  sqlQueryArticlesSummaryStatistics,
  sqlQueryArticlesApproved,
  sqlQueryRequestsFromApi,
  // sqlQueryArticlesWithRatings,
  sqlQueryArticles,
  // sqlQueryArticlesWithStates,
  // sqlQueryArticlesWithStatesApproved,
  sqlQueryArticlesWithStatesApprovedReportContract,
  sqlQueryArticlesForWithRatingsRoute,
};
