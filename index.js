require("dotenv").config();
const express = require("express");
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");
const { DOMParser, XMLSerializer } = require("xmldom");
const unzipper = require("unzipper");
const archiver = require("archiver");

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const filePath = path.resolve(process.env.DOCX_FILE || "./una.docx");
const tempDir = path.resolve("/tmp/temp_extract");

app.get("/", (req, res) => {
  res.send(`
    <h1>Word Header Text Replacement</h1>
    <form method="POST" action="/replace">
      <label>Enter replacement word for "email":</label><br>
      <input type="text" name="replacementEmail" required><br><br>
      <label>Enter replacement word for "datum":</label><br>
      <input type="text" name="replacementDatum" required><br><br>
      <label>Enter replacement text for "una" (supports line breaks):</label><br>
      <textarea name="replacementUna" rows="10" cols="50" required></textarea><br><br>
      <button type="submit">Replace</button>
    </form>
  `);
});

app.post("/replace", async (req, res) => {
  const { replacementEmail, replacementDatum, replacementUna } = req.body;

  try {
    if (!replacementEmail || !replacementDatum || !replacementUna) {
      return res.status(400).send("All fields are required.");
    }

    // Step 1: Extract the .docx file
    fs.createReadStream(filePath)
      .pipe(unzipper.Extract({ path: tempDir }))
      .on("close", async () => {
        console.log("Extraction complete.");

        // Modify headers and body content as in your original code...

        // Step 3: Repack the modified Word document
        const modifiedDocxPath = path.resolve("/tmp/una_modified.docx");
        const output = fs.createWriteStream(modifiedDocxPath);
        const archive = archiver("zip", { zlib: { level: 9 } });

        archive.pipe(output);
        archive.directory(tempDir, false);
        await archive.finalize();
        console.log("Modified .docx file saved.");

        // Step 4: Convert to PDF
        const pdfPath = path.resolve("/tmp/una_modified.pdf");
        const libreOfficeCommand = `libreoffice --headless --convert-to pdf --outdir "${path.dirname(
          pdfPath
        )}" "${modifiedDocxPath}"`;

        exec(libreOfficeCommand, (error, stdout, stderr) => {
          if (error) {
            console.error(`Error during LibreOffice export: ${error.message}`);
            return res.status(500).send("Error during PDF conversion.");
          }

          console.log("PDF generated successfully:", stdout);

          // Clean up temporary files
          fs.rmSync(tempDir, { recursive: true, force: true });

          // Send the PDF as a download
          res.download(pdfPath, "modified.pdf", (err) => {
            if (err) console.error("Error sending PDF:", err);
          });
        });
      });
  } catch (err) {
    console.error("Error:", err);
    res.status(500).send("An error occurred while processing the document.");
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

