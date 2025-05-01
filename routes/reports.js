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
  createXlsxForReport,
} = require("../modules/reports");
const fs = require("fs");
const path = require("path");
const { Op } = require("sequelize");

// 🔹 GET /reports: Get all the saved reports
router.get("/", authenticateToken, async (req, res) => {
  const reports = await Report.findAll({
    include: [
      {
        model: ArticleReportContract,
      },
    ],
  });

  const reportsArrayModified = reports.map((report) => {
    let dateSubmittedToClient;
    if (report.dateSubmittedToClient === null) {
      dateSubmittedToClient = "N/A";
    } else {
      dateSubmittedToClient = report.dateSubmittedToClient;
    }
    return {
      ...report.dataValues,
      dateSubmittedToClient,
    };
  });

  res.json({ reportsArray: reportsArrayModified });
});

// 🔹 POST /reports/create: Create a new report
router.post("/create", authenticateToken, async (req, res) => {
  const { articlesIdArrayForReport } = req.body; // if this is not set we only make report of articles that are not already in a report
  console.log(
    `- in POST /reports/create - articlesIdArrayForReport: ${articlesIdArrayForReport}`
  );
  // Step 1: get array of all articles in articlesIdArray
  let approvedArticlesObjArray = await Article.findAll({
    where: {
      id: {
        [Op.in]: articlesIdArrayForReport,
      },
    },
    include: [
      {
        model: ArticleApproved,
        // where: { isApproved: true },
      },
      { model: State },
    ],
  });

  if (!approvedArticlesObjArray) {
    return res.status(400).json({ error: "No approved articles found" });
  }

  console.log(
    `1) approvedArticlesObjArray.length: ${approvedArticlesObjArray.length}`
  );

  // Step 2: create a report
  const report = await Report.create({
    userId: req.user.id,
  });

  const zipFilename = `report_bundle_${report.id}.zip`;

  // // NOTE:  if not includeAllArticles -- > take out all articles already in a report
  // if (!includeAllArticles) {
  //   const articlesInReport = await ArticleReportContract.findAll();
  //   approvedArticlesObjArray = approvedArticlesObjArray.filter(
  //     (article) => !articlesInReport.some((a) => a.articleId === article.id)
  //   );
  // }

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

    console.log(
      `article.ArticleApproveds.length: ${article.ArticleApproveds.length}`
    );

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
    // const csvFilename = createCsvForReport(filteredArticles);
    const xlsxFilename = await createXlsxForReport(filteredArticles);
    createReportPdfFiles(filteredArticles); // Generate PDFs for each article
    // const zipFilename = await createReportZipFile(xlsxFilename);
    await createReportZipFile(xlsxFilename, zipFilename);
    // report.reportName = zipFilename;
    report.reportName = zipFilename;
    // report.pathToReport = path.join(
    //   process.env.PATH_PROJECT_RESOURCES_REPORTS,
    //   zipFilename
    // );
    // report.hasPdf = true;
    // report.hasCsv = true;
    await report.save();

    res.json({ message: "CSV created", zipFilename });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
// router.post("/create", authenticateToken, async (req, res) => {
//   const { includeAllArticles } = req.body; // if this is not set we only make report of articles that are not already in a report
//   console.log(
//     `- in POST /reports/create - includeAllArticles: ${includeAllArticles}`
//   );
//   // Step 1: get array of all approved articles
//   let approvedArticlesObjArray = await Article.findAll({
//     include: [
//       {
//         model: ArticleApproved,
//         where: { isApproved: true },
//       },
//       { model: State },
//     ],
//   });

//   if (!approvedArticlesObjArray) {
//     return res.status(400).json({ error: "No approved articles found" });
//   }

//   // Step 2: create a report
//   const report = await Report.create({
//     userId: req.user.id,
//   });

//   // NOTE:  if not includeAllArticles -- > take out all articles already in a report
//   if (!includeAllArticles) {
//     const articlesInReport = await ArticleReportContract.findAll();
//     approvedArticlesObjArray = approvedArticlesObjArray.filter(
//       (article) => !articlesInReport.some((a) => a.articleId === article.id)
//     );
//   }

//   const datePrefix = new Date().toISOString().slice(2, 10).replace(/-/g, ""); // YYMMDD
//   // let approvedArticlesObjArrayModified = approvedArticlesObjArray.map(
//   let approvedArticlesObjArrayModified = [];

//   for (let i = 0; i < approvedArticlesObjArray.length; i++) {
//     const article = approvedArticlesObjArray[i];

//     // create ArticleReportContract
//     await ArticleReportContract.create({
//       reportId: report.id,
//       articleId: article.id,
//     });

//     const counter = String(i + 1).padStart(3, "0"); // 001, 002, ...
//     article.refNumber = `${datePrefix}${counter}`; // e.g., 250418001
//     let state;
//     if (article.States?.length > 0) {
//       state = article.States[0].abbreviation;
//     }
//     approvedArticlesObjArrayModified.push({
//       refNumber: article.refNumber,
//       submitted: new Date().toISOString().slice(0, 10),
//       headline: article.ArticleApproveds[0].headlineForPdfReport,
//       publication: article.ArticleApproveds[0].publicationNameForPdfReport,
//       datePublished: article.ArticleApproveds[0].publicationDateForPdfReport,
//       state,
//       text: article.ArticleApproveds[0].textForPdfReport,
//     });
//   }

//   console.log(`finished loops`);

//   // step 2: create a csv file and save to PATH_PROJECT_RESOURCES_REPORTS
//   try {
//     const filteredArticles = approvedArticlesObjArrayModified.filter(Boolean); // remove nulls
//     // const csvFilename = createCsvForReport(filteredArticles);
//     const xlsxFilename = await createXlsxForReport(filteredArticles);
//     createReportPdfFiles(filteredArticles); // Generate PDFs for each article
//     const zipFilename = await createReportZipFile(xlsxFilename);
//     report.reportName = zipFilename;
//     // report.pathToReport = path.join(
//     //   process.env.PATH_PROJECT_RESOURCES_REPORTS,
//     //   zipFilename
//     // );
//     // report.hasPdf = true;
//     // report.hasCsv = true;
//     await report.save();

//     res.json({ message: "CSV created", zipFilename });
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// });

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
    const filePath = path.join(reportsDir, report.reportName);
    if (reportsDir) {
      console.log(`- Deleting report file: ${filePath}`);
      if (fs.existsSync(filePath)) {
        console.log(`---->  in if (fs.existsSync(filePath))`);
        fs.unlinkSync(filePath);
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

// 🔹 GET /reports/download/:reportId - Download Report
router.get("/download/:reportId", authenticateToken, async (req, res) => {
  console.log(`- in GET /reports/download/${req.params.reportId}`);

  const reportId = req.params.reportId;
  const report = await Report.findByPk(reportId);
  if (!report) {
    return res
      .status(404)
      .json({ result: false, message: "Report not found." });
  }
  try {
    const reportsDir = process.env.PATH_PROJECT_RESOURCES_REPORTS;

    if (!reportsDir) {
      return res
        .status(500)
        .json({ result: false, message: "Reports directory not configured." });
    }

    // const filePath = path.join(backupDir, filename);

    const filePath = path.join(reportsDir, report.reportName);
    console.log(`filePath: ${filePath}`);

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res
        .status(404)
        .json({ result: false, message: "File not found." });
    }

    console.log(`Sending file: ${filePath}`);
    // const filename = path.basename(report.pathToReport);
    console.log(`filename: ${report.reportName}`);
    // res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${report.reportName}"`
    );
    res.setHeader("Access-Control-Expose-Headers", "Content-Disposition");
    // res.download(filePath, filename, (err) => {
    res.download(filePath, (err) => {
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

module.exports = router;
