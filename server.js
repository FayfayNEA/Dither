import dotenv from "dotenv";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, ".env") });
const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.static(__dirname));

app.listen(PORT, () => {
  console.log(`fither — http://localhost:${PORT}`);
});
