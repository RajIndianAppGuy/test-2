import express from "express";
import { promises as fs } from "fs";
import path from "path";
import { exec } from "child_process";
import util from "util";
import cluster from "cluster";
import os from "os";
import PQueue from "p-queue";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const port = process.env.PORT || 3000;
const sourceDir = __dirname;

app.use(express.json());

// Create a queue with concurrency limit
const concurrency = os.cpus().length; // Use number of CPU cores as concurrency limit
const queue = new PQueue({ concurrency });
const execPromise = util.promisify(exec);
async function buildSlideshowSPA(filename, content) {
  const filePath = path.join(sourceDir, `${filename}.md`);
  const targetDir = path.join(sourceDir, filename);

  try {
    await fs.writeFile(filePath, content);
    console.log(`Markdown file ${filePath} created`);

    await fs.mkdir(targetDir, { recursive: true });

    const command = `npx slidev build ${filePath} --out ${targetDir} --base /slides/${filename}/`;
    console.log(`Running command: ${command}`);

    const { stdout, stderr } = await execPromise(command);
    console.log(`Successfully built SPA for ${filename}`);
    return `Successfully built SPA for ${filename}`;
  } catch (err) {
    console.error(`Error processing build for ${filename}:`, err);
    throw new Error(`Failed to build SPA for ${filename}`);
  } finally {
    // Clean up temporary files
    await fs.unlink(filePath).catch(console.error);
  }
}

// Route to handle new Markdown content
app.post("/build", async (req, res) => {
  const { filename, content } = req.body;
  if (!filename || !content) {
    return res.status(400).send("Filename and content are required");
  }

  try {
    const result = await queue.add(() => buildSlideshowSPA(filename, content));
    res.send(result);
  } catch (err) {
    res.status(500).send(err.message);
  }
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

if (cluster.isMaster) {
  console.log(`Master process is running on PID ${process.pid}`);

  for (let i = 0; i < concurrency; i++) {
    cluster.fork();
  }

  cluster.on("exit", (worker, code, signal) => {
    console.log(`Worker ${worker.process.pid} died. Restarting...`);
    cluster.fork();
  });
} else {
  app.listen(port, () => {
    console.log(`Worker ${process.pid} is running on port ${port}`);
  });
}
