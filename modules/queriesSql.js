const { sequelize } = require("newsnexus07db");

async function sqlQueryArticlesWithRatings({ publishedDate, createdAt }) {
  // ------ NOTE -----------------------------------
  // This funciton replaces:
  // const articlesArray = await Article.findAll({
  //   where: whereClause,
  //   include: [
  //     { model: State, through: { attributes: [] } },
  //     { model: ArticleIsRelevant },
  //     { model: ArticleApproved },
  //     {
  //       model: NewsApiRequest,
  //       include: [
  //         {
  //           model: NewsArticleAggregatorSource,
  //         },
  //       ],
  //     },
  //     { model: ArticleEntityWhoCategorizedArticleContract },
  //     { model: ArticleReviewed },
  //   ],
  // });
  // -----------------------------------------

  const replacements = {};
  const whereClauses = [];

  if (publishedDate) {
    whereClauses.push(`a."publishedDate" >= :publishedDate`);
    replacements.publishedDate = publishedDate;
  }

  if (createdAt) {
    whereClauses.push(`a."createdAt" >= :createdAt`);
    replacements.createdAt = createdAt;
  }

  const whereString =
    whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

  const sql = `
    SELECT
      a.id AS "articleId",
      a.title,
      a.description,
      a."publishedDate",
      a."publicationName",
      a.url,
      s.id AS "stateId",
      s.name AS "stateName",
      ar."isRelevant",
      aa."userId" AS "approvedByUserId",
      nar."andString",
      nar."orString",
      nar."notString",
      nas."nameOfOrg",
      arc."entityWhoCategorizesId",
      arc."keyword",
      arc."keywordRating",
      arw."userId" AS "reviewedByUserId"
    FROM "Articles" a
    LEFT JOIN "ArticleStateContracts" asc ON a.id = asc."articleId"
    LEFT JOIN "States" s ON asc."stateId" = s.id
    LEFT JOIN "ArticleIsRelevants" ar ON ar."articleId" = a.id
    LEFT JOIN "ArticleApproveds" aa ON aa."articleId" = a.id
    LEFT JOIN "NewsApiRequests" nar ON nar.id = a."newsApiRequestId"
    LEFT JOIN "NewsArticleAggregatorSources" nas ON nas.id = nar."newsArticleAggregatorSourceId"
    LEFT JOIN "ArticleEntityWhoCategorizedArticleContracts" arc ON arc."articleId" = a.id
    LEFT JOIN "ArticleRevieweds" arw ON arw."articleId" = a.id
    ${whereString}
    ORDER BY a.id;
  `;

  const results = await sequelize.query(sql, {
    replacements,
    type: sequelize.QueryTypes.SELECT,
  });

  // console.log("results:", results);
  return results;
}

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
    s.id AS "stateId"
  FROM "Articles" a
  LEFT JOIN "ArticleIsRelevants" ar ON ar."articleId" = a.id
  LEFT JOIN "ArticleApproveds" aa ON aa."articleId" = a.id
  LEFT JOIN "ArticleStateContracts" asc ON asc."articleId" = a.id
  LEFT JOIN "States" s ON s.id = asc."stateId";
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

module.exports = {
  sqlQueryArticles,
  sqlQueryArticlesSummaryStatistics,
  sqlQueryArticlesApproved,
  sqlQueryRequestsFromApi,
  sqlQueryArticlesWithRatings,
};
