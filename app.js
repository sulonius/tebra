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

// Putanje do fajlova i direktorijuma
const filePath = path.resolve(process.env.DOCX_FILE || "./una.docx");
const tempDir = path.resolve(process.env.TEMP_DIR || "/tmp/temp_extract");
const libreOfficeDir = path.resolve(process.env.LIBRE_OFFICE_DIR || "./squashfs-root");

// Funkcija za proveru i postavljanje dozvola
const checkAppRunPermissions = () => {
  const appRunPath = path.resolve(libreOfficeDir, "AppRun");

  if (!fs.existsSync(appRunPath)) {
    throw new Error("AppRun file does not exist in the specified LibreOffice directory.");
  }

  try {
    fs.accessSync(appRunPath, fs.constants.X_OK); // Provera dozvola
  } catch {
    console.log("Fixing permissions for AppRun...");
    fs.chmodSync(appRunPath, 0o755); // Postavljanje dozvola
    console.log("Permissions set for AppRun.");
  }
};

// Početna ruta sa formom
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

    // Korak 1: Ekstrakcija .docx fajla
    fs.createReadStream(filePath)
      .pipe(unzipper.Extract({ path: tempDir }))
      .on("close", async () => {
        console.log("Extraction complete.");

        // Korak 2: Modifikacija zaglavlja i sadržaja
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
          console.log(`Updated ${headerFile}`);
        });

        // Telo dokumenta
        const bodyFiles = fs
          .readdirSync(`${tempDir}/word`)
          .filter((file) => file.endsWith(".xml") && !file.startsWith("header") && !file.startsWith("footer"));

        bodyFiles.forEach((bodyFile) => {
          const bodyPath = `${tempDir}/word/${bodyFile}`;
          let bodyXML = fs.readFileSync(bodyPath, "utf-8");

          const xmlDoc = new DOMParser().parseFromString(bodyXML, "text/xml");
          const textNodes = xmlDoc.getElementsByTagName("w:t");

          Array.from(textNodes).forEach((node) => {
            if (node.textContent.includes("una")) {
              const parent = node.parentNode;

              while (parent.firstChild) parent.removeChild(parent.firstChild);

              const lines = replacementUna.split(/\r?\n/);
              lines.forEach((line, index) => {
                const textNode = xmlDoc.createElement("w:t");
                textNode.textContent = line;
                parent.appendChild(textNode);

                if (index < lines.length - 1) {
                  const lineBreak = xmlDoc.createElement("w:br");
                  parent.appendChild(lineBreak);
                }
              });
            }
          });

          const updatedXML = new XMLSerializer().serializeToString(xmlDoc);
          fs.writeFileSync(bodyPath, updatedXML, "utf-8");
          console.log(`Updated body content in ${bodyFile}`);
        });

        // Korak 3: Repacking
        const modifiedDocxPath = path.resolve("/tmp/una_modified.docx");
        const output = fs.createWriteStream(modifiedDocxPath);
        const archive = archiver("zip", { zlib: { level: 9 } });

        archive.pipe(output);
        archive.directory(tempDir, false);
        await archive.finalize();
        console.log("Modified .docx file saved.");

        // Korak 4: Konverzija u PDF
        checkAppRunPermissions(); // Validacija dozvola

        const pdfPath = path.resolve("/tmp/una_modified.pdf");
        const libreOfficeCommand = `libreoffice --headless --convert-to pdf --outdir "${path.dirname(pdfPath)}" "${modifiedDocxPath}"`;

        exec(libreOfficeCommand, (error, stdout, stderr) => {
          if (error) {
            console.error("Error during LibreOffice export:", error.message);
            console.error("STDOUT:", stdout);
            console.error("STDERR:", stderr);
            return res.status(500).send("Error during PDF conversion.");
          }

          console.log("PDF generated successfully:", stdout);

          // Brisanje privremenih fajlova
          fs.rmSync(tempDir, { recursive: true, force: true });

          // Slanje PDF-a kao download
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

