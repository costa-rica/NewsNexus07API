const {
  ArticleEntityWhoCategorizedArticleContract,
  Article,
  ArticleApproved,
} = require("newsnexus07db");
async function createFilteredArticlesArray(entityWhoCategorizesId) {
  // Step 1: Find all existing articleId values for this entityWhoCategorizesId
  const existingContracts =
    await ArticleEntityWhoCategorizedArticleContract.findAll({
      where: { entityWhoCategorizesId },
      attributes: ["articleId"],
      raw: true,
    });

  const alreadyProcessedIds = new Set(
    existingContracts.map((entry) => entry.articleId)
  );

  // Step 2: Get all articles
  const allArticles = await Article.findAll({
    include: [
      {
        model: ArticleApproved,
      },
    ],
  });

  // Step 3: Filter out articles already processed
  const filteredArticles = allArticles.filter(
    (article) => !alreadyProcessedIds.has(article.id)
  );

  return filteredArticles;
}

module.exports = {
  createFilteredArticlesArray,
};
