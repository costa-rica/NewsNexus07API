const fs = require("fs");
const path = require("path");
function checkBody(body, keys) {
  let isValid = true;

  for (const field of keys) {
    if (!body[field] || body[field] === "") {
      isValid = false;
    }
  }

  return isValid;
}

function checkBodyReturnMissing(body, keys) {
  let isValid = true;
  let missingKeys = [];

  for (const field of keys) {
    if (!body[field] || body[field] === "") {
      isValid = false;
      missingKeys.push(field);
    }
  }

  return { isValid, missingKeys };
}

function writeRequestArgs(requestBody, fileNameSuffix) {
  // 🔹 Write request arguments to a JSON file
  const testDir = process.env.PATH_TEST_REQUEST_ARGS;
  if (testDir) {
    try {
      // Ensure the directory exists
      if (!fs.existsSync(testDir)) {
        fs.mkdirSync(testDir, { recursive: true });
      }

      // Generate file name with timestamp
      const timestamp = new Date()
        .toISOString()
        .replace(/[:.]/g, "-")
        .split("T")[1]
        .split("Z")[0]; // HHMMSS format
      const filePath = path.join(
        testDir,
        `request_${timestamp}_${fileNameSuffix}.json`
      );

      // Write request body to file
      fs.writeFileSync(filePath, JSON.stringify(requestBody, null, 2), "utf8");
      console.log(`✅ Request arguments saved to: ${filePath}`);
    } catch (err) {
      console.error("❌ Error writing request arguments file:", err);
    }
  } else {
    console.warn(
      "⚠️ PATH_TEST_REQUEST_ARGS is not set, skipping request logging."
    );
  }
}

function writeResponseDataFromNewsAggregator(
  NewsArticleAggregatorSourceId,
  keywordId = "none",
  requestResponseData,
  prefix = false,
  requestUrl = ""
) {
  const formattedDate = new Date()
    .toISOString()
    .split("T")[0]
    .replace(/-/g, "");
  const responseDir = process.env.PATH_TO_API_RESPONSE_JSON_FILES;
  let responseFilename;
  if (prefix) {
    responseFilename = `failedToSave${formattedDate}apiId${NewsArticleAggregatorSourceId}keywordId${keywordId}.json`;
  } else {
    responseFilename = `${formattedDate}apiId${NewsArticleAggregatorSourceId}keywordId${keywordId}.json`;
  }
  const responseFilePath = path.join(responseDir, responseFilename);
  let jsonToStore = requestResponseData;
  if (requestUrl) {
    jsonToStore.requestUrl = requestUrl;
  }
  fs.writeFileSync(
    responseFilePath,
    JSON.stringify(jsonToStore, null, 2),
    "utf-8"
  );
}

module.exports = {
  checkBody,
  checkBodyReturnMissing,
  writeRequestArgs,
  writeResponseDataFromNewsAggregator,
};
