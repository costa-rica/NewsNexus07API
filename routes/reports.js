var express = require("express");
var router = express.Router();
const { Report, Article, ArticleApproved, State } = require("newsnexus07db");
const { checkBodyReturnMissing } = require("../modules/common");
const { authenticateToken } = require("../modules/userAuthentication");
const {
  createCsvForReport,
  createReportPdfFiles,
  createReportZipFile,
} = require("../modules/reports");

// 🔹 GET /reports: Get all the saved reports
router.get("/", authenticateToken, async (req, res) => {
  const reports = await Report.findAll();
  res.json({ reports });
});

// 🔹 POST /reports/create: Create a new report
router.post("/create", authenticateToken, async (req, res) => {
  // Step 1: get array of all approved articles
  const approvedArticlesObjArray = await Article.findAll({
    include: [
      {
        model: ArticleApproved,
        where: { isApproved: true },
      },
      { model: State },
    ],
  });
  const datePrefix = new Date().toISOString().slice(2, 10).replace(/-/g, ""); // YYMMDD
  let approvedArticlesObjArrayModified = approvedArticlesObjArray.map(
    (article, index) => {
      const counter = String(index + 1).padStart(3, "0"); // 001, 002, ...
      article.refNumber = `${datePrefix}${counter}`; // e.g., 250418001
      let state;
      if (article.States?.length > 0) {
        state = article.States[0].abbreviation;
      }
      if (!state) {
        return null;
      }
      return {
        refNumber: article.refNumber,
        id: article.id,
        headline: article.ArticleApproveds[0].headlineForPdfReport,
        publicationName:
          article.ArticleApproveds[0].publicationNameForPdfReport,
        publicationDate:
          article.ArticleApproveds[0].publicationDateForPdfReport,
        text: article.ArticleApproveds[0].textForPdfReport,
        url: article.ArticleApproveds[0].urlForPdfReport,
        kmNotes: article.ArticleApproveds[0].kmNotes,
        state,
      };
    }
  );

  // step 2: create a csv file and save to PATH_PROJECT_RESOURCES_REPORTS
  try {
    const filteredArticles = approvedArticlesObjArrayModified.filter(Boolean); // remove nulls
    const csvFilename = createCsvForReport(filteredArticles);
    createReportPdfFiles(filteredArticles); // Generate PDFs for each article
    const zipFilename = await createReportZipFile(csvFilename);
    res.json({ message: "CSV created", zipFilename });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
