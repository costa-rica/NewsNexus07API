var express = require("express");
var router = express.Router();
const {
  Report,
  Article,
  ArticleApproved,
  State,
  ArticleReportContract,
} = require("newsnexus07db");
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
  const { includeAllArticles } = req.body;
  console.log(
    `- in POST /reports/create - includeAllArticles: ${includeAllArticles}`
  );
  // Step 1: get array of all approved articles
  let approvedArticlesObjArray = await Article.findAll({
    include: [
      {
        model: ArticleApproved,
        where: { isApproved: true },
      },
      { model: State },
    ],
  });

  if (!approvedArticlesObjArray) {
    return res.status(400).json({ error: "No approved articles found" });
  }
  console.log(`- Found ${approvedArticlesObjArray.length} approved articles`);
  // Step 2: create a report
  const report = await Report.create({
    userId: req.user.id,
  });

  if (!includeAllArticles) {
    const articlesInReport = await ArticleReportContract.findAll();
    approvedArticlesObjArray = approvedArticlesObjArray.filter(
      (article) => !articlesInReport.some((a) => a.articleId === article.id)
    );
  }
  console.log(
    `- Filtered ${approvedArticlesObjArray.length} approved articles`
  );
  const datePrefix = new Date().toISOString().slice(2, 10).replace(/-/g, ""); // YYMMDD
  // let approvedArticlesObjArrayModified = approvedArticlesObjArray.map(
  let approvedArticlesObjArrayModified = [];

  for (let i = 0; i < approvedArticlesObjArray.length; i++) {
    const article = approvedArticlesObjArray[i];
    console.log(
      `- Processing article ${i + 1} of ${approvedArticlesObjArray.length}`
    );
    // create ArticleReportContract
    await ArticleReportContract.create({
      reportId: report.id,
      articleId: article.id,
    });
    console.log(
      `- Created ArticleReportContract for article ${article.id}, report: ${report.id}`
    );
    const counter = String(i + 1).padStart(3, "0"); // 001, 002, ...
    article.refNumber = `${datePrefix}${counter}`; // e.g., 250418001
    let state;
    console.log(`- Processing article ${article.id}...`);
    if (article.States?.length > 0) {
      state = article.States[0].abbreviation;
    }
    console.log(`- got here `);
    if (!state) {
      console.log(`- stuck here`);
      continue;
    }
    console.log(`- got here 3`);
    approvedArticlesObjArrayModified.push({
      refNumber: article.refNumber,
      id: article.id,
      headline: article.ArticleApproveds[0].headlineForPdfReport,
      publicationName: article.ArticleApproveds[0].publicationNameForPdfReport,
      publicationDate: article.ArticleApproveds[0].publicationDateForPdfReport,
      text: article.ArticleApproveds[0].textForPdfReport,
      url: article.ArticleApproveds[0].urlForPdfReport,
      kmNotes: article.ArticleApproveds[0].kmNotes,
      state,
    });
  }

  console.log(`finished loops`);

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
