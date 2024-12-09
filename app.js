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

// Putanje do fajlova
const squashfsRoot = path.resolve(__dirname, "squashfs-root");
const libreOfficeAppRun = path.join(squashfsRoot, "AppRun");
const tempDir = path.resolve("/tmp/temp_extract");
const inputFilePath = path.resolve(__dirname, "una.docx");

// Proveri dozvole za AppRun
const checkAppRunPermissions = () => {
  if (!fs.existsSync(libreOfficeAppRun)) {
    throw new Error("AppRun not found in squashfs-root directory.");
  }

  try {
    fs.accessSync(libreOfficeAppRun, fs.constants.X_OK);
  } catch {
    fs.chmodSync(libreOfficeAppRun, 0o755); // Postavi izvršne dozvole
    console.log("Permissions for AppRun fixed.");
  }
};

// Početna stranica sa formom
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

// Ruta za zamenu teksta
app.post("/replace", async (req, res) => {
  const { replacementEmail, replacementDatum, replacementUna } = req.body;

  try {
    if (!replacementEmail || !replacementDatum || !replacementUna) {
      return res.status(400).send("All fields are required.");
    }

    // Ekstrakcija DOCX fajla
    fs.createReadStream(inputFilePath)
      .pipe(unzipper.Extract({ path: tempDir }))
      .on("close", async () => {
        console.log("Extraction complete.");

        // Zameni tekst u header fajlovima
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
            if (node.textContent.includes("una")) {
              node.textContent = node.textContent.replace("una", replacementUna);
            }
          });

          const updatedXML = new XMLSerializer().serializeToString(xmlDoc);
          fs.writeFileSync(headerPath, updatedXML, "utf-8");
        });

        // Repack DOCX
        const modifiedDocxPath = path.resolve("/tmp/una_modified.docx");
        const output = fs.createWriteStream(modifiedDocxPath);
        const archive = archiver("zip", { zlib: { level: 9 } });

        archive.pipe(output);
        archive.directory(tempDir, false);
        await archive.finalize();

        // Konverzija u PDF pomoću AppRun
        checkAppRunPermissions();
        const pdfPath = path.resolve("/tmp/una_modified.pdf");
        const libreOfficeCommand = `"${libreOfficeAppRun}" --headless --convert-to pdf --outdir "/tmp" "${modifiedDocxPath}"`;

        exec(libreOfficeCommand, (error, stdout, stderr) => {
          if (error) {
            console.error("Error during PDF conversion:", error.message);
            return res.status(500).send("Error during PDF conversion.");
          }

          // Slanje PDF fajla
          res.download(pdfPath, "modified.pdf", (err) => {
            if (err) console.error("Error sending PDF:", err);
          });
        });
      });
  } catch (err) {
    console.error("Error:", err);
    res.status(500).send("An error occurred.");
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

