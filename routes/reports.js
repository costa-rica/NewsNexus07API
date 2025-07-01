var express = require("express");
var router = express.Router();
const {
  Report,
  Article,
  ArticleApproved,
  State,
  ArticleReportContract,
  ArticleStateContract,
} = require("newsnexus07db");
const {
  convertJavaScriptDateToTimezoneString,
  createJavaScriptExcelDateObjectEastCoasUs,
} = require("../modules/common");
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
const { DateTime } = require("luxon");

// // 🔹 GET /reports: Get all the saved reports
// router.get("/", authenticateToken, async (req, res) => {
//   const reports = await Report.findAll({
//     include: [
//       {
//         model: ArticleReportContract,
//       },
//     ],
//   });

//   const reportsArrayModified = reports.map((report) => {
//     const rawDate = report?.dateSubmittedToClient;
//     const isValidDate = rawDate && !isNaN(new Date(rawDate).getTime());

//     return {
//       ...report.dataValues,
//       dateSubmittedToClient: isValidDate ? rawDate : "N/A",
//     };
//   });

//   res.json({ reportsArray: reportsArrayModified });
// });

// 🔹 GET /reports/table
router.get("/table", authenticateToken, async (req, res) => {
  console.log(`- in GET /reports/table`);

  const reports = await Report.findAll({
    include: [
      {
        model: ArticleReportContract,
      },
    ],
  });

  const reportsArrayModified = reports.map((report) => {
    const rawDate = report?.dateSubmittedToClient;
    const isValidDate = rawDate && !isNaN(new Date(rawDate).getTime());

    return {
      ...report.dataValues,
      dateSubmittedToClient: isValidDate ? rawDate : "N/A",
    };
  });

  // Not quite right
  const reportsArrayByCrName = reportsArrayModified.reduce((acc, report) => {
    const crName = report.nameCrFormat;
    if (!acc[crName]) {
      acc[crName] = [];
    }
    acc[crName].push(report);
    return acc;
  }, {});

  res.json({ reportsArray: reportsArrayByCrName });
});

// 🔹 GET /reports - Return reports grouped by crName with full report and ARC data
router.get("/", authenticateToken, async (req, res) => {
  console.log(`- in GET /reports`);

  try {
    const allReports = await Report.findAll({
      include: [
        {
          model: ArticleReportContract,
        },
      ],
      order: [["createdAt", "ASC"]],
    });

    // Step 1: Map reports and normalize date
    const reportsWithFormattedDate = allReports.map((report) => {
      const rawDate = report.dateSubmittedToClient;
      const isValidDate = rawDate && !isNaN(new Date(rawDate).getTime());
      const formattedDate = isValidDate ? rawDate : "N/A";

      return {
        ...report.toJSON(),
        dateSubmittedToClient: formattedDate,
      };
    });

    // Step 2: Group by nameCrFormat
    const groupedByCrName = {};

    for (const report of reportsWithFormattedDate) {
      const crName = report.nameCrFormat;
      if (!groupedByCrName[crName]) {
        groupedByCrName[crName] = [];
      }
      groupedByCrName[crName].push(report);
    }

    // Step 3: Convert to desired array structure
    const reportsArrayByCrName = Object.entries(groupedByCrName).map(
      ([crName, reportsArray]) => ({
        crName,
        reportsArray,
      })
    );

    res.json({ reportsArrayByCrName });
  } catch (error) {
    console.error("Error generating new reports list:", error);
    res.status(500).json({
      result: false,
      message: "Internal server error",
      error: error.message,
    });
  }
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

  const nowET = convertJavaScriptDateToTimezoneString(
    new Date(),
    "America/New_York"
  ).dateString; // YYYY-MM-DD
  const datePrefixET = nowET.replace(/[-:]/g, "").slice(2, 8);
  console.log(`datePrefixET: ${datePrefixET}`);

  report.nameCrFormat = `cr${datePrefixET}`;
  await report.save();

  let approvedArticlesObjArrayModified = [];

  for (let i = 0; i < approvedArticlesObjArray.length; i++) {
    const article = approvedArticlesObjArray[i];
    const counter = String(i + 1).padStart(3, "0"); // 001, 002, ...
    article.refNumber = `${datePrefixET}${counter}`; // e.g., 250418001
    // create ArticleReportContract
    await ArticleReportContract.create({
      reportId: report.id,
      articleId: article.id,
      articleReferenceNumberInReport: article.refNumber,
    });
    let state;
    if (article.States?.length > 0) {
      state = article.States[0].abbreviation;
    }

    // if (i === 0) {
    //   console.log(
    //     `--->  article.ArticleApproveds[0]: ${typeof article.ArticleApproveds[0]
    //       .publicationDateForPdfReport} ${
    //       article.ArticleApproveds[0].publicationDateForPdfReport
    //     }`
    //   );
    // }
    try {
      approvedArticlesObjArrayModified.push({
        refNumber: article.refNumber,
        submitted: createJavaScriptExcelDateObjectEastCoasUs(),
        headline: article.ArticleApproveds[0].headlineForPdfReport,
        publication: article.ArticleApproveds[0].publicationNameForPdfReport,
        datePublished: new Date(
          article.ArticleApproveds[0].publicationDateForPdfReport
        ),
        state,
        text: article.ArticleApproveds[0].textForPdfReport,
      });
    } catch (error) {
      console.log(`Error processing article id ${article.id}: ${error}`);
      return res
        .status(500)
        .json({ error: `Error processing article id ${article.id}: ${error}` });
    }
  }

  // step 2: create a csv file and save to PATH_PROJECT_RESOURCES_REPORTS
  try {
    const filteredArticles = approvedArticlesObjArrayModified.filter(Boolean); // remove nulls
    const xlsxFilename = await createXlsxForReport(filteredArticles);
    createReportPdfFiles(filteredArticles); // Generate PDFs for each article
    await createReportZipFile(xlsxFilename, zipFilename);
    report.nameZipFile = zipFilename;
    await report.save();

    res.json({ message: "CSV created", zipFilename });
  } catch (error) {
    res.status(500).json({
      error: `Error creating report: ${error.message}`,
    });
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
    const filePath = path.join(reportsDir, report.nameZipFile);
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

    const filePath = path.join(reportsDir, report.nameZipFile);
    console.log(`filePath: ${filePath}`);

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res
        .status(404)
        .json({ result: false, message: "File not found." });
    }

    console.log(`Sending file: ${filePath}`);
    // const filename = path.basename(report.pathToReport);
    console.log(`filename: ${report.nameZipFile}`);
    // res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${report.nameZipFile}"`
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

// 🔹 POST /reports/update-submitted-to-client-date/:reportId - Update Submissions Status
router.post(
  "/update-submitted-to-client-date/:reportId",
  authenticateToken,
  async (req, res) => {
    console.log(
      `- in POST /reports/update-submitted-to-client-date/${req.params.reportId}`
    );

    const reportId = req.params.reportId;
    let { dateSubmittedToClient } = req.body;
    // dateSubmittedToClient = new Date(dateSubmittedToClient)

    const report = await Report.findByPk(reportId);
    if (!report) {
      return res
        .status(404)
        .json({ result: false, message: "Report not found." });
    }

    try {
      report.dateSubmittedToClient = dateSubmittedToClient;
      await report.save();

      res.json({
        result: true,
        message: "Submissions status updated successfully.",
      });
    } catch (error) {
      console.error("Error updating submissions status:", error);
      res.status(500).json({
        result: false,
        message: "Internal server error",
        error: error.message,
      });
    }
  }
);

// 🔹 POST /reports/toggle-article-rejection/:articleReportContractId - Toggle Article Rejection
router.post(
  "/toggle-article-rejection/:articleReportContractId",
  authenticateToken,
  async (req, res) => {
    console.log(
      `- in POST /reports/toggle-article-rejection/${req.params.articleReportContractId}`
    );

    const { articleRejectionReason } = req.body;
    const articleReportContractId = req.params.articleReportContractId;

    console.log(`articleRejectionReason: ${articleRejectionReason}`);
    console.log(`articleReportContractId: ${articleReportContractId}`);
    const articleReportContract = await ArticleReportContract.findByPk(
      articleReportContractId
    );
    if (!articleReportContract) {
      return res
        .status(404)
        .json({ result: false, message: "Article Report Contract not found." });
    }
    console.log(
      `---> current Accepted Status : ${articleReportContract.articleAcceptedByCpsc}`
    );

    if (articleReportContract.articleAcceptedByCpsc) {
      articleReportContract.articleAcceptedByCpsc = false;
      articleReportContract.articleRejectionReason = articleRejectionReason;
    } else {
      console.log(`----> Changing status to accepted`);
      articleReportContract.articleAcceptedByCpsc = true;
      articleReportContract.articleRejectionReason = articleRejectionReason;
    }
    await articleReportContract.save();

    res.json({
      result: true,
      message: "Article rejection toggled successfully.",
      articleReportContract,
    });
  }
);

// 🔹 POST /reports/update-article-report-reference-number/:articleReportContractId
router.post(
  "/update-article-report-reference-number/:articleReportContractId",
  authenticateToken,
  async (req, res) => {
    console.log(
      `- in POST /reports/update-article-report-reference-number/${req.params.articleReportContractId}`
    );

    const articleReportContractId = req.params.articleReportContractId;
    const { articleReferenceNumberInReport } = req.body;
    const articleReportContract = await ArticleReportContract.findByPk(
      articleReportContractId
    );
    if (!articleReportContract) {
      return res
        .status(404)
        .json({ result: false, message: "Article Report Contract not found." });
    }
    console.log(
      `---> current Ref Number : ${articleReportContract.articleReferenceNumberInReport}`
    );

    articleReportContract.articleReferenceNumberInReport =
      articleReferenceNumberInReport;
    await articleReportContract.save();

    res.json({
      result: true,
      message: "Article report reference number updated successfully.",
      articleReportContract,
    });
  }
);

// GET /reports/recreate/:reportId
router.get("/recreate/:reportId", authenticateToken, async (req, res) => {
  console.log(`- in GET /reports/recreate/${req.params.reportId}`);

  const reportId = req.params.reportId;
  const user = req.user;
  const reportOriginal = await Report.findByPk(reportId);
  if (!reportOriginal) {
    return res
      .status(404)
      .json({ result: false, message: "Report not found." });
  }

  const reportOriginalSubmittedDate =
    reportOriginal.dateSubmittedToClient.toLocaleDateString("en-US", {
      year: "numeric",
      month: "numeric", // no leading zero
      day: "numeric", // no leading zero
    });
  // get report Cr name
  const reportCrName = reportOriginal.nameCrFormat;
  // create a new report with the same cr name but different bunddle name
  const reportNew = await Report.create({
    nameCrFormat: reportCrName,
    userId: user.id,
  });
  const zipFilename = `report_bundle_${reportNew.id}.zip`;
  // reportNew.nameZipFile = zipFilename;
  // await reportNew.save();
  // const nowET = convertJavaScriptDateToTimezoneString(
  //   new Date(),
  //   "America/New_York"
  // ).dateString; // YYYY-MM-DD
  // const datePrefixET = nowET.replace(/[-:]/g, "").slice(2, 8);

  // get list of Aritcle IDs from the articleReportContract table
  const articleReportContractsArray = await ArticleReportContract.findAll({
    where: {
      reportId: reportOriginal.id,
    },
  });

  // console.log(
  //   `articleReportContractsArray.length: ${articleReportContractsArray.length}`
  // );

  // get array of articles from the ArticleApproved Table
  const approvedArticlesArray = await ArticleApproved.findAll({
    where: {
      articleId: {
        [Op.in]: articleReportContractsArray.map((ar) => ar.articleId),
      },
    },
  });

  let approvedArticlesObjArrayModified = [];

  for (let i = 0; i < approvedArticlesArray.length; i++) {
    const approvedArticleObj = approvedArticlesArray[i];
    const articleReportContractObj = articleReportContractsArray.find(
      (ar) => ar.articleId === approvedArticleObj.articleId
    );
    approvedArticleObj.refNumber =
      articleReportContractObj.articleReferenceNumberInReport;
    // const counter = String(i + 1).padStart(3, "0"); // 001, 002, ...
    // approvedArticleObj.refNumber = `${reportCrName.slice(2)}${counter}`; // e.g., 250418001
    // create ArticleReportContract
    await ArticleReportContract.create({
      reportId: reportNew.id,
      articleId: approvedArticleObj.articleId,
      articleReferenceNumberInReport: approvedArticleObj.refNumber,
    });
    let state;
    // Find all article states in ArticleStateContract Table
    const articleStateContractsArray = await ArticleStateContract.findAll({
      where: {
        articleId: approvedArticleObj.articleId,
      },
    });
    // console.log(JSON.stringify(articleStateContractsArray, null, 2));
    const stateId = articleStateContractsArray[0].stateId;
    const stateObj = await State.findByPk(stateId);
    state = stateObj.abbreviation;
    // if (article.States?.length > 0) {
    //   state = article.States[0].abbreviation;
    // }

    // console.log(
    //   `article ref date: ${
    //     approvedArticleObj.refNumber
    //   } submitted date: ${reportOriginal.dateSubmittedToClient.toLocaleDateString(
    //     "en-US",
    //     {
    //       year: "numeric",
    //       month: "numeric", // no leading zero
    //       day: "numeric", // no leading zero
    //     }
    //   )} headline: ${approvedArticleObj.headlineForPdfReport}`
    // );

    try {
      approvedArticlesObjArrayModified.push({
        refNumber: approvedArticleObj.refNumber,
        submitted: reportOriginalSubmittedDate,
        headline: approvedArticleObj.headlineForPdfReport,
        publication: approvedArticleObj.publicationNameForPdfReport,
        datePublished: new Date(approvedArticleObj.publicationDateForPdfReport),
        state,
        text: approvedArticleObj.textForPdfReport,
      });
    } catch (error) {
      console.log(
        `Error processing article id ${approvedArticleObj.id}: ${error}`
      );
      return res.status(500).json({
        error: `Error processing article id ${approvedArticleObj.id}: ${error}`,
      });
    }
  }

  // step 2: create a csv file and save to PATH_PROJECT_RESOURCES_REPORTS
  try {
    const filteredArticles = approvedArticlesObjArrayModified.filter(Boolean); // remove nulls
    const xlsxFilename = await createXlsxForReport(
      filteredArticles,
      `${reportCrName}.xlsx`
    );
    createReportPdfFiles(filteredArticles); // Generate PDFs for each article
    await createReportZipFile(xlsxFilename, zipFilename);
    reportNew.nameZipFile = zipFilename;
    await reportNew.save();

    // res.json({ message: "CSV created", zipFilename });
  } catch (error) {
    res.status(500).json({
      error: `Error creating report: ${error.message}`,
    });
  }

  // create a new bundle
  res.json({
    result: true,
    message: "Report recreated successfully.",
    newReportId: reportNew.id,
    originalReportId: reportOriginal.id,
    originalReportSubmittedDate: reportOriginalSubmittedDate,
  });
});

module.exports = router;
