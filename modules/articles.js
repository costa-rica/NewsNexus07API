const { sequelize } = require("newsnexus07db");

/**
 * Returns article metadata with the max keywordRating and its keyword,
 * filtered by a specific entityWhoCategorizesId.
 *
 * @param {number} entityWhoCategorizesId
 * @param {string|null} publishedDateAfter - Optional publishedDate filter
 * @returns {Promise<Array>} rawArticles
 */
async function createArticlesArrayWithSqlForSemanticKeywordsRating(
  entityWhoCategorizesId,
  publishedDateAfter = null
) {
  let dateCondition = "";
  if (publishedDateAfter) {
    dateCondition = `AND a.publishedDate >= '${publishedDateAfter}'`;
  }

  const sql = `
    SELECT
      a.id,
      a.title,
      a.description,
      a.url,
      a.publishedDate,
      arc.keyword AS keywordOfRating,
      arc.keywordRating
    FROM Articles a
    LEFT JOIN (
      SELECT arc1.*
      FROM ArticleEntityWhoCategorizedArticleContracts arc1
      JOIN (
        SELECT articleId, MAX(keywordRating) AS maxRating
        FROM ArticleEntityWhoCategorizedArticleContracts
        WHERE entityWhoCategorizesId = ${entityWhoCategorizesId}
        GROUP BY articleId
      ) arc2
      ON arc1.articleId = arc2.articleId AND arc1.keywordRating = arc2.maxRating
      WHERE arc1.entityWhoCategorizesId = ${entityWhoCategorizesId}
    ) arc
    ON a.id = arc.articleId
    WHERE 1=1 ${dateCondition}
  `;

  const [rawArticles, metadata] = await sequelize.query(sql);
  return rawArticles;
}

module.exports = {
  createArticlesArrayWithSqlForSemanticKeywordsRating,
};
