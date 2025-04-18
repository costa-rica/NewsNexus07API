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
const fs = require("fs");
const path = require("path");

// 🔹 GET /reports: Get all the saved reports
router.get("/", authenticateToken, async (req, res) => {
  const reports = await Report.findAll({
    include: [
      {
        model: ArticleReportContract,
      },
    ],
  });
  res.json({ reports });
});

// 🔹 POST /reports/create: Create a new report
router.post("/create", authenticateToken, async (req, res) => {
  const { includeAllArticles } = req.body; // if this is not set we only make report of articles that are not already in a report
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

  // Step 2: create a report
  const report = await Report.create({
    userId: req.user.id,
  });

  // NOTE:  if not includeAllArticles -- > take out all articles already in a report
  if (!includeAllArticles) {
    const articlesInReport = await ArticleReportContract.findAll();
    approvedArticlesObjArray = approvedArticlesObjArray.filter(
      (article) => !articlesInReport.some((a) => a.articleId === article.id)
    );
  }

  const datePrefix = new Date().toISOString().slice(2, 10).replace(/-/g, ""); // YYMMDD
  // let approvedArticlesObjArrayModified = approvedArticlesObjArray.map(
  let approvedArticlesObjArrayModified = [];

  for (let i = 0; i < approvedArticlesObjArray.length; i++) {
    const article = approvedArticlesObjArray[i];

    // create ArticleReportContract
    await ArticleReportContract.create({
      reportId: report.id,
      articleId: article.id,
    });

    const counter = String(i + 1).padStart(3, "0"); // 001, 002, ...
    article.refNumber = `${datePrefix}${counter}`; // e.g., 250418001
    let state;
    if (article.States?.length > 0) {
      state = article.States[0].abbreviation;
    }
    approvedArticlesObjArrayModified.push({
      refNumber: article.refNumber,
      submitted: new Date().toISOString().slice(0, 10),
      headline: article.ArticleApproveds[0].headlineForPdfReport,
      publication: article.ArticleApproveds[0].publicationNameForPdfReport,
      datePublished: article.ArticleApproveds[0].publicationDateForPdfReport,
      state,
      text: article.ArticleApproveds[0].textForPdfReport,
    });
  }

  console.log(`finished loops`);

  // step 2: create a csv file and save to PATH_PROJECT_RESOURCES_REPORTS
  try {
    const filteredArticles = approvedArticlesObjArrayModified.filter(Boolean); // remove nulls
    const csvFilename = createCsvForReport(filteredArticles);
    createReportPdfFiles(filteredArticles); // Generate PDFs for each article
    const zipFilename = await createReportZipFile(csvFilename);

    report.pathToReport = path.join(
      process.env.PATH_PROJECT_RESOURCES_REPORTS,
      zipFilename
    );
    report.hasPdf = true;
    report.hasCsv = true;
    await report.save();

    res.json({ message: "CSV created", zipFilename });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 🔹 GET /reports/list - Get Report List
router.get("/list", authenticateToken, async (req, res) => {
  console.log(`- in GET /reports/list`);

  try {
    const reportsDir = process.env.PATH_PROJECT_RESOURCES_REPORTS;
    if (!reportsDir) {
      return res
        .status(500)
        .json({ result: false, message: "Reports directory not configured." });
    }

    // Read files in the reports directory
    const files = await fs.promises.readdir(reportsDir);

    // Filter only .zip files
    const zipFiles = files.filter((file) => file.endsWith(".zip"));

    // console.log(`Found ${zipFiles.length} backup files.`);

    res.json({ result: true, reports: zipFiles });
  } catch (error) {
    console.error("Error retrieving report list:", error);
    res.status(500).json({
      result: false,
      message: "Internal server error",
      error: error.message,
    });
  }
});

// 🔹 GET /reports/send/:reportId Send Report
router.get("/send/:reportId", authenticateToken, async (req, res) => {
  console.log(`- in GET /reports/send/${req.params.reportId}`);

  try {
    const { reportId } = req.params;
    const report = await Report.findByPk(reportId);
    if (!report) {
      return res
        .status(404)
        .json({ result: false, message: "Report not found." });
    }
    const reportsDir = process.env.PATH_PROJECT_RESOURCES_REPORTS;

    if (!reportsDir) {
      return res
        .status(500)
        .json({ result: false, message: "Reports directory not configured." });
    }

    const filePath = path.join(report.pathToReport);

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res
        .status(404)
        .json({ result: false, message: "File not found." });
    }

    console.log(`Sending file: ${report.pathToReport}`);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=${report.pathToReport}`
    );
    res.download(report.pathToReport, (err) => {
      if (err) {
        console.error("Error sending file:", err);
        res.status(500).json({ result: false, message: "Error sending file." });
      }
    });
  } catch (error) {
    console.error("Error processing request:", error);
    res.status(500).json({
      result: false,
      message: "Internal server error",
      error: error.message,
    });
  }
});

// 🔹 DELETE /reports/:reportId - Delete Report
router.delete("/:reportId", authenticateToken, async (req, res) => {
  console.log(`- in DELETE /reports/${req.params.reportId}`);

  try {
    const { reportId } = req.params;
    const report = await Report.findByPk(reportId);
    if (!report) {
      return res
        .status(404)
        .json({ result: false, message: "Report not found." });
    }

    // Delete report and associated files
    await report.destroy();
    const reportsDir = process.env.PATH_PROJECT_RESOURCES_REPORTS;
    if (reportsDir) {
      console.log(`- Deleting report file: ${report.pathToReport}`);
      if (fs.existsSync(report.pathToReport)) {
        console.log(`---->  in if (fs.existsSync(filePath))`);
        fs.unlinkSync(report.pathToReport);
      }
    }

    res.json({ result: true, message: "Report deleted successfully." });
  } catch (error) {
    console.error("Error deleting report:", error);
    res.status(500).json({
      result: false,
      message: "Internal server error",
      error: error.message,
    });
  }
});

module.exports = router;
