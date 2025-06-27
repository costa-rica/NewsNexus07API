const { sequelize } = require("newsnexus07db");

// These are examples of how to create SQL queries using Sequelize

async function sqlQueryArticles() {
  const sql = `
      SELECT
        a.id,
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
        a.newsRssRequestId
      FROM "Articles" a
      ORDER BY a.id;
    `;

  const results = await sequelize.query(sql, {
    type: sequelize.QueryTypes.SELECT,
  });

  return results;
}

async function sqlQueryArticlesWithStates() {
  const sql = `
      SELECT
        a.id,
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
        s.abbreviation AS "stateAbbreviation"
      FROM "Articles" a
      LEFT JOIN "ArticleStateContracts" asc ON a.id = asc."articleId"
      LEFT JOIN "States" s ON s.id = asc."stateId"
      ORDER BY a.id;
    `;

  const flatResults = await sequelize.query(sql, {
    type: sequelize.QueryTypes.SELECT,
  });

  // Group articles by articleId
  const articlesMap = new Map();

  for (const row of flatResults) {
    const {
      id,
      title,
      description,
      publishedDate,
      createdAt,
      publicationName,
      url,
      stateId,
      stateName,
      stateAbbreviation,
    } = row;

    if (!articlesMap.has(id)) {
      articlesMap.set(id, {
        id,
        title,
        description,
        publishedDate,
        createdAt,
        publicationName,
        url,
        States: [],
      });
    }

    if (stateId) {
      articlesMap.get(id).States.push({
        id: stateId,
        name: stateName,
        abbreviation: stateAbbreviation,
      });
    }
  }

  return Array.from(articlesMap.values());
}

async function sqlQueryArticlesWithStatesApproved() {
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
        aa."kmNotes"
      FROM "Articles" a
      LEFT JOIN "ArticleStateContracts" asc ON a.id = asc."articleId"
      LEFT JOIN "States" s ON s.id = asc."stateId"
      LEFT JOIN "ArticleApproveds" aa ON aa."articleId" = a.id
      ORDER BY a.id;
    `;

  const flatResults = await sequelize.query(sql, {
    type: sequelize.QueryTypes.SELECT,
  });

  // Group articles by articleId
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
      });
    }

    if (stateId) {
      articlesMap.get(articleId).States.push({
        id: stateId,
        name: stateName,
        abbreviation: stateAbbreviation,
      });
    }

    if (approvedId) {
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

  return Array.from(articlesMap.values());
}

module.exports = {
  sqlQueryArticles,
  sqlQueryArticlesWithStates,
  sqlQueryArticlesWithStatesApproved,
};
