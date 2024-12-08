require("dotenv").config();
const express = require("express");
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const { DOMParser, XMLSerializer } = require("xmldom");
const unzipper = require("unzipper");
const archiver = require("archiver");

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Use environment variables for file paths
const filePath = path.resolve(process.env.DOCX_FILE || "./una.docx");
const tempDir = path.resolve(process.env.TEMP_DIR || "./temp_extract");
const libreOfficeDir = path.resolve(process.env.LIBRE_OFFICE_DIR || "./squashfs-root"); // Ensure this path exists on Render

// Check if the necessary directories exist, if not create them
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

// Set executable permissions for AppRun
try {
  execSync(`chmod +x ${libreOfficeDir}/AppRun`);
  console.log('Set executable permission for AppRun');
} catch (error) {
  console.error('Error setting executable permission:', error.message);
}

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

    if (!fs.existsSync(filePath)) {
      return res.status(400).send("Original DOCX file does not exist.");
    }

    if (!fs.existsSync(libreOfficeDir)) {
      return res.status(400).send("LibreOffice directory does not exist.");
    }

    // Step 1: Extract the .docx file
    fs.createReadStream(filePath)
      .pipe(unzipper.Extract({ path: tempDir }))
      .on("close", async () => {
        console.log("Extraction complete.");

        // Step 2: Modify headers and body content
        // ... (Tvoj kod za modifikaciju dokumenta)

        // Step 3: Repack the modified Word document
        const modifiedDocxPath = path.resolve("./una_modified.docx");
        const output = fs.createWriteStream(modifiedDocxPath);
        const archive = archiver("zip", { zlib: { level: 9 } });

        archive.pipe(output);
        await archive.finalize();
        console.log("Modified .docx file saved.");

        // Step 4: Convert the modified .docx to PDF using extracted LibreOffice
        const pdfPath = path.resolve("./una_modified.pdf");
        const libreOfficeCommand = `${libreOfficeDir}/AppRun --headless --convert-to pdf --outdir "${path.dirname(
          pdfPath
        )}" "${modifiedDocxPath}"`;

        try {
          const output = execSync(libreOfficeCommand);
          console.log("PDF generated successfully:", output.toString());
        } catch (error) {
          console.error(`Error during LibreOffice export: ${error.message}`);
          return res.status(500).send("Error during PDF conversion.");
        }

        // Clean up temporary files
        fs.rmSync(tempDir, { recursive: true, force: true });

        // Send the PDF as a download
        res.download(pdfPath, "modified.pdf", (err) => {
          if (err) console.error("Error sending PDF:", err);
        });
      });
  } catch (err) {
    console.error("Error:", err);
    res.status(500).send("An error occurred while processing the document.");
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
