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
} = require("newsnexus07db");
const { authenticateToken } = require("../modules/userAuthentication");
const { getDateOfLastSubmittedReport } = require("../modules/reports");

// 🔹 GET /analysis/approved-articles-by-state
router.get(
  "/approved-articles-by-state",
  authenticateToken,
  async (req, res) => {
    try {
      const lastReportDate = await getDateOfLastSubmittedReport();

      const approvedArticlesArray = await ArticleApproved.findAll({
        include: [
          {
            model: Article,
            include: [
              {
                model: State,
              },
            ],
          },
        ],
      });

      const stateCounts = {};
      const stateCountsSinceLastReport = {};

      for (const approved of approvedArticlesArray) {
        const article = approved.Article;
        if (article && article.States && article.States.length > 0) {
          const firstState = article.States[0];
          const stateName = firstState.name;

          // All-time count
          stateCounts[stateName] = (stateCounts[stateName] || 0) + 1;

          // Since-last-report count
          if (
            lastReportDate &&
            new Date(approved.createdAt) > new Date(lastReportDate)
          ) {
            stateCountsSinceLastReport[stateName] =
              (stateCountsSinceLastReport[stateName] || 0) + 1;
          }
        }
      }

      const sumOfApproved = Object.values(stateCounts).reduce(
        (sum, val) => sum + val,
        0
      );

      const articleCountByStateArray = Object.entries(stateCounts).map(
        ([state, count]) => ({
          state,
          count,
          countSinceLastReport: stateCountsSinceLastReport[state] || 0,
        })
      );

      articleCountByStateArray.push({
        state: "sumOfApproved",
        count: sumOfApproved,
        countSinceLastReport: Object.values(stateCountsSinceLastReport).reduce(
          (sum, val) => sum + val,
          0
        ),
      });

      res.json(articleCountByStateArray);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

module.exports = router;
