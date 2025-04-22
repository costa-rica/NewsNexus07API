const fs = require("fs");
const path = require("path");
const { Parser } = require("json2csv");
const PDFDocument = require("pdfkit");
const archiver = require("archiver");

function createCsvForReport(dataArray) {
  const fields = [
    { label: "Ref #", value: "refNumber" },
    { label: "Submitted", value: "submitted" },
    { label: "Headline", value: "headline" },
    { label: "Publication", value: "publication" },
    { label: "Date", value: "datePublished" },
    { label: "State", value: "state" },
    { label: "Text", value: "text" },
  ];

  const json2csvParser = new Parser({ fields });
  const csv = json2csvParser.parse(dataArray);

  const outputDir = process.env.PATH_PROJECT_RESOURCES_REPORTS;
  if (!outputDir) {
    throw new Error(
      "PATH_PROJECT_RESOURCES_REPORTS environment variable not set."
    );
  }

  const now = new Date();
  const timestamp = now
    .toISOString()
    .replace(/[-:]/g, "")
    .replace("T", "-")
    .slice(2, 8);
  const fileName = `cr${timestamp}.csv`;
  const filePath = path.join(outputDir, fileName);
  // fs.writeFileSync(filePath, csv);
  fs.writeFileSync(filePath, "\uFEFF" + csv); // prepend UTF-8 BOM

  return fileName;
}

function createReportPdfFiles(dataArray) {
  const outputDir = process.env.PATH_PROJECT_RESOURCES_REPORTS;
  if (!outputDir) {
    throw new Error(
      "PATH_PROJECT_RESOURCES_REPORTS environment variable not set."
    );
  }

  const pdfOutputDir = path.join(outputDir, "article_pdfs");
  if (!fs.existsSync(pdfOutputDir)) {
    fs.mkdirSync(pdfOutputDir, { recursive: true });
  }

  dataArray.forEach((article) => {
    const doc = new PDFDocument({ margin: 50 });
    const filePath = path.join(pdfOutputDir, `${article.refNumber}.pdf`);
    const writeStream = fs.createWriteStream(filePath);
    doc.pipe(writeStream);

    const fields = [
      { label: "Ref #", value: article.refNumber },
      { label: "Submitted", value: article.submitted },
      { label: "Headline", value: article.headline },
      { label: "Publication", value: article.publication },
      { label: "Date", value: article.datePublished },
      { label: "State", value: article.state },
      { label: "Text", value: article.text },
    ];

    fields.forEach(({ label, value }, index) => {
      if (index !== 0) {
        doc.moveDown(1);
      }
      doc.font("Helvetica-Bold").text(`${label} :`, { continued: true });
      doc.font("Helvetica").text(` ${value}`);
    });

    doc.end();
  });

  return pdfOutputDir;
}

function createReportZipFile(csvFilename) {
  const outputDir = process.env.PATH_PROJECT_RESOURCES_REPORTS;
  if (!outputDir) {
    throw new Error(
      "PATH_PROJECT_RESOURCES_REPORTS environment variable not set."
    );
  }

  const pdfDir = path.join(outputDir, "article_pdfs");

  const now = new Date();
  const timestamp = now
    .toISOString()
    .replace(/[-:]/g, "")
    .replace("T", "-")
    .slice(0, 8);

  const zipFilename = `report_bundle_${timestamp}.zip`;
  const zipPath = path.join(outputDir, zipFilename);

  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(zipPath);
    const archive = archiver("zip", { zlib: { level: 9 } });

    output.on("close", () => {
      // ✅ Only run cleanup AFTER the zip file is fully written
      try {
        fs.unlinkSync(path.join(outputDir, csvFilename)); // delete .csv
        fs.rmSync(pdfDir, { recursive: true, force: true }); // delete pdf dir and all contents
        resolve(zipFilename);
      } catch (cleanupError) {
        reject(cleanupError);
      }
    });

    archive.on("error", (err) => reject(err));
    archive.pipe(output);

    archive.file(path.join(outputDir, csvFilename), { name: csvFilename });
    archive.directory(pdfDir, "article_pdfs");

    archive.finalize();
  });
}

module.exports = {
  createCsvForReport,
  createReportPdfFiles,
  createReportZipFile,
};
