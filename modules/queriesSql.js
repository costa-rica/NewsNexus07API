const { sequelize } = require("newsnexus07db");

async function sqlQueryArticles({ publishedDate, createdAt }) {
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

module.exports = {
  sqlQueryArticles,
  sqlQueryArticlesSummaryStatistics,
};
