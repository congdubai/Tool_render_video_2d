import AdmZip from "adm-zip";
import path from "node:path";
import fs from "node:fs";

const sourceDir = path.resolve("./sample-projects/chibi-engine-demo-10s");
const zipPath = path.resolve("./sample-projects/chibi-engine-demo-10s.zip");

const zip = new AdmZip();
zip.addLocalFolder(sourceDir);
zip.writeZip(zipPath);

console.log("Successfully created demo zip at:", zipPath);
console.log("File size:", fs.statSync(zipPath).size, "bytes");

