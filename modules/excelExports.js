const ExcelJS = require("exceljs");
const path = require("path");
const fs = require("fs");

async function createSpreadsheetFromArray(array, outputFilePath = null) {
  if (!array || array.length === 0) {
    throw new Error("Array is empty or undefined.");
  }

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Data");

  // Step 1: Extract headers from keys of first object
  const headers = Object.keys(array[0]);
  worksheet.addRow(headers);

  // Step 2: Add data rows
  array.forEach((item) => {
    const row = headers.map((key) => item[key]);
    worksheet.addRow(row);
  });

  // Step 3: Save or return buffer
  if (outputFilePath) {
    await workbook.xlsx.writeFile(outputFilePath);
    console.log("✅ Excel file saved to:", outputFilePath);
    return outputFilePath;
  } else {
    const buffer = await workbook.xlsx.writeBuffer();
    return buffer;
  }
}

module.exports = {
  createSpreadsheetFromArray,
};
