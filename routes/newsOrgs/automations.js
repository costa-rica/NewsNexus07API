var express = require("express");
var router = express.Router();
const { authenticateToken } = require("../../modules/userAuthentication");
const fs = require("fs");
const path = require("path");

const multer = require("multer");

const excelFilesDir = process.env.PATH_TO_AUTOMATION_EXCEL_FILES;
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, excelFilesDir);
  },
  filename: function (req, file, cb) {
    cb(null, req.params.filename); // force filename to be what the client specifies
  },
});
const upload = multer({ storage: storage });

// 🔹 GET /automations/excel-files
router.get("/excel-files", authenticateToken, async (req, res) => {
  try {
    const excelFilesDir = process.env.PATH_TO_AUTOMATION_EXCEL_FILES;
    if (!excelFilesDir) {
      return res
        .status(500)
        .json({ result: false, message: "Backup directory not configured." });
    }

    // Read files in the backup directory
    const files = await fs.promises.readdir(excelFilesDir);

    // Filter only .zip files
    const excelFileNamesArray = files.filter((file) => file.endsWith(".xlsx"));

    // console.log(`Found ${zipFiles.length} backup files.`);

    res.json({ result: true, excelFileNamesArray });
  } catch (error) {
    console.error("Error retrieving excel file list:", error);
    res.status(500).json({
      result: false,
      message: "Internal server error",
      error: error.message,
    });
  }
});

// GET /excel-file/:filename
router.get("/excel-file/:filename", authenticateToken, (req, res) => {
  const filePath = path.join(excelFilesDir, req.params.filename);

  // Extra check for file existence
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ result: false, message: "File not found." });
  }

  // Set content type explicitly
  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );

  // Let Express handle download
  res.download(filePath, req.params.filename, (err) => {
    if (err) {
      console.error("Download error:", err);
      res.status(500).json({ result: false, message: "File download failed." });
    }
  });
});

// 🔹 POST /excel-file/:filename
router.post(
  "/excel-file/:filename",
  authenticateToken,
  upload.single("file"),
  (req, res) => {
    if (!req.file) {
      return res
        .status(400)
        .json({ result: false, message: "No file uploaded." });
    }

    res.json({ result: true, message: "File uploaded successfully." });
  }
);

// 🔹 GET /web-browser-extensions
router.get("/web-browser-extensions", authenticateToken, async (req, res) => {
  try {
    const webBrowserExtensionsDir = path.join(
      process.env.PATH_PROJECT_RESOURCES,
      "utilities",
      "web_browser_extensions"
    );
    if (!webBrowserExtensionsDir) {
      return res
        .status(500)
        .json({ result: false, message: "Backup directory not configured." });
    }

    // Read files in the backup directory
    const files = await fs.promises.readdir(webBrowserExtensionsDir);

    // Filter only .zip files
    const webBrowserExtensionsArray = files.filter((file) =>
      file.endsWith(".zip")
    );

    // console.log(`Found ${zipFiles.length} backup files.`);

    res.json({ result: true, webBrowserExtensionsArray });
  } catch (error) {
    console.error("Error retrieving web browser extensions list:", error);
    res.status(500).json({
      result: false,
      message: "Internal server error",
      error: error.message,
    });
  }
});

// 🔹 GET /web-browser-extensions/:filename
router.get(
  "/web-browser-extension/:filename",
  authenticateToken,
  (req, res) => {
    const webBrowserExtensionsDir = path.join(
      process.env.PATH_PROJECT_RESOURCES,
      "utilities",
      "web_browser_extensions"
    );
    const filePath = path.join(webBrowserExtensionsDir, req.params.filename);

    // Extra check for file existence
    if (!fs.existsSync(filePath)) {
      return res
        .status(404)
        .json({ result: false, message: "File not found." });
    }

    // Set content type explicitly
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );

    // Let Express handle download
    res.download(filePath, req.params.filename, (err) => {
      if (err) {
        console.error("Download error:", err);
        res
          .status(500)
          .json({ result: false, message: "File download failed." });
      }
    });
  }
);

module.exports = router;
