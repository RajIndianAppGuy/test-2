const express = require("express");
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");

const app = express();
const port = process.env.PORT || 3000;
const sourceDir = path.join(__dirname, "slidev-files");

app.use(express.json());

// Route to handle new Markdown content
app.post("/build", (req, res) => {
  const { filename, content } = req.body;

  if (!filename || !content) {
    return res.status(400).send("Filename and content are required");
  }

  const filePath = path.join(sourceDir, `${filename}.md`);
  const targetDir = path.join(sourceDir, filename);

  // Write the markdown content to a file
  fs.writeFile(filePath, content, (err) => {
    if (err) {
      console.error("Error writing markdown file:", err);
      return res.status(500).send("Failed to write markdown file");
    }

    console.log(`Markdown file ${filePath} created`);

    fs.mkdir(targetDir, { recursive: true }, (err) => {
      if (err) {
        console.error("Error creating target directory:", err);
        return res.status(500).send("Failed to create target directory");
      }

      // Build Slidev SPA with custom output directory and base path
      const command = `npx slidev build ${filePath} --out ${targetDir} --base /slides/${filename}/`;
      console.log(`Running command: ${command}`);

      exec(command, (err, stdout, stderr) => {
        if (err) {
          console.error(`Error building SPA for ${filename}:`, stderr);
          return res.status(500).send(`Failed to build SPA for ${filename}`);
        }

        console.log(`Successfully built SPA for ${filename}`);
        res.send(`Successfully built SPA for ${filename}`);
      });
    });
  });
});

// Dynamic route to serve each presentation's files
app.get("/slides/:filename/*", (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(
    sourceDir,
    filename,
    req.params[0] || "index.html"
  );

  console.log(`Serving file: ${filePath}`);
  res.sendFile(filePath, (err) => {
    if (err) {
      res.status(404).send("File not found");
    }
  });
});

// Default route for testing
app.get("/", (req, res) => {
  res.send("Slidev SPA Builder is running!");
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
