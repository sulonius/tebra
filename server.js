const express = require("express");
const path = require("path");
const { exec } = require("child_process");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 8080;

// Automatski kreira izlazni folder ako ne postoji
const createOutputDir = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
  }
};

// Konvertovanje `una.docx` u PDF
app.get("/convert", (req, res) => {
  const inputFile = path.resolve("una.docx"); // Putanja do `una.docx`
  const outputDir = path.resolve("output");  // Automatski kreiran folder za izlaz
  createOutputDir(outputDir);
  const outputFile = path.join(outputDir, "una.pdf");

  // Pokretanje LibreOffice konverzije
  exec(
    `libreoffice --headless --convert-to pdf ${inputFile} --outdir ${outputDir}`,
    (err) => {
      if (err) {
        console.error("Greška pri konverziji:", err);
        return res.status(500).send("Konverzija nije uspela.");
      }
      // Šaljemo izlazni PDF nazad korisniku
      res.download(outputFile, "una.pdf", () => {
        // Brisanje generisanih fajlova nakon preuzimanja
        fs.rmSync(outputFile, { force: true });
        console.log("Izlazni fajl je obrisan nakon preuzimanja.");
      });
    }
  );
});

// Početna stranica za prikaz obaveštenja
app.get("/", (req, res) => {
  res.send(`
    <h1>DOCX to PDF Converter</h1>
    <p>Postavi <strong>una.docx</strong> u isti folder kao aplikacija i pristupi <a href="/convert">/convert</a> da preuzmeš PDF.</p>
  `);
});

app.listen(PORT, () => console.log(`Server radi na http://localhost:${PORT}`));

