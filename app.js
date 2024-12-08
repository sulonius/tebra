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

// Konstante za fajlove i direktorijume
const filePath = path.resolve(process.env.DOCX_FILE || "./una.docx");
const tempDir = path.resolve(process.env.TEMP_DIR || "./temp_extract");
const libreOfficeDir = path.resolve("./squashfs-root"); // Ekstrahovani direktorijum AppImage-a

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

    // 1. Postavljanje izvršnih dozvola za LibreOffice AppImage
    const appRunPath = `${libreOfficeDir}/AppRun`;
    try {
      fs.chmodSync(appRunPath, "755"); // Dodavanje izvršnih dozvola
    } catch (err) {
      console.error("Failed to set executable permissions:", err);
      return res.status(500).send("Error during LibreOffice setup.");
    }

    // 2. Ekstrakcija .docx fajla
    fs.createReadStream(filePath)
      .pipe(unzipper.Extract({ path: tempDir }))
      .on("close", async () => {
        console.log("Extraction complete.");

        // 3. Izmena XML fajlova u header-u i telu
        const headerFiles = fs
          .readdirSync(`${tempDir}/word`)
          .filter((file) => file.startsWith("header") && file.endsWith(".xml"));

        headerFiles.forEach((headerFile) => {
          const headerPath = `${tempDir}/word/${headerFile}`;
          let headerXML = fs.readFileSync(headerPath, "utf-8");

          const xmlDoc = new DOMParser().parseFromString(headerXML, "text/xml");
          const textNodes = xmlDoc.getElementsByTagName("w:t");

          Array.from(textNodes).forEach((node) => {
            if (node.textContent.includes("email")) {
              node.textContent = node.textContent.replace("email", replacementEmail);
            }
            if (node.textContent.includes("datum")) {
              node.textContent = node.textContent.replace("datum", replacementDatum);
            }
          });

          const updatedXML = new XMLSerializer().serializeToString(xmlDoc);
          fs.writeFileSync(headerPath, updatedXML, "utf-8");
          console.log(`Updated ${headerFile}`);
        });

        // 4. Pakovanje modifikovanog fajla nazad u .docx
        const modifiedDocxPath = path.resolve("./una_modified.docx");
        const output = fs.createWriteStream(modifiedDocxPath);
        const archive = archiver("zip", { zlib: { level: 9 } });

        archive.pipe(output);
        archive.directory(tempDir, false);
        await archive.finalize();
        console.log("Modified .docx file saved.");

        // 5. Konvertovanje u PDF koristeći LibreOffice
        const pdfPath = path.resolve("./una_modified.pdf");
        const libreOfficeCommand = `${appRunPath} --headless --convert-to pdf --outdir "${path.dirname(
          pdfPath
        )}" "${modifiedDocxPath}"`;

        exec(libreOfficeCommand, (error, stdout, stderr) => {
          if (error) {
            console.error(`Error during LibreOffice export: ${error.message}`);
            return res.status(500).send("Error during PDF conversion.");
          }

          console.log("PDF generated successfully:", stdout);

          // Čišćenje privremenih fajlova
          fs.rmSync(tempDir, { recursive: true, force: true });

          // Slanje generisanog PDF-a korisniku
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
