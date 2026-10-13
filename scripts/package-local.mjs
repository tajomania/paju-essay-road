import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
const value = (name) => process.argv[process.argv.indexOf(name) + 1];
const nodeFile = value("--node"),
  licenseFile = value("--license");
if (
  !nodeFile ||
  !licenseFile ||
  !fs.existsSync(nodeFile) ||
  !fs.existsSync(licenseFile)
)
  throw new Error(
    "Provide --node official-node.exe --license Node-LICENSE.txt",
  );
const out = path.resolve("artifacts", "release-" + Date.now()),
  app = path.join(out, "Paju-Essay-Road");
fs.mkdirSync(app, { recursive: true });
for (const folder of ["src", "public", "local", "migrations", "docs"])
  fs.cpSync(folder, path.join(app, folder), { recursive: true });
for(const file of ['start.ps1','stop.ps1'])fs.writeFileSync(path.join(app,'local',file),'\ufeff'+fs.readFileSync(path.join('local',file),'utf8').replace(/^\ufeff/,''));
for (const file of ["Start-Classroom.cmd", "Stop-Classroom.cmd"])
  fs.copyFileSync(file, path.join(app, file));
fs.writeFileSync(
  path.join(app, "package.json"),
  JSON.stringify(
    {
      name: "paju-essay-road-local",
      version: "1.1.2",
      private: true,
      type: "module",
    },
    null,
    2,
  ),
);
fs.writeFileSync(
  path.join(app, "사용안내.txt"),
  "\ufeff" + fs.readFileSync("docs/LOCAL_GOOGLE_GUIDE.md", "utf8"),
);
fs.mkdirSync(path.join(app, "runtime"));
fs.copyFileSync(nodeFile, path.join(app, "runtime", "node.exe"));
fs.copyFileSync(licenseFile, path.join(app, "runtime", "NODE-LICENSE.txt"));
const zip = path.join(path.dirname(out), "Paju-Essay-Road-Windows.zip");
if (!zip.startsWith(path.resolve("artifacts") + path.sep))
  throw new Error("Invalid output path");
if (fs.existsSync(zip)) fs.unlinkSync(zip);
const result = spawnSync(
  "powershell.exe",
  [
    "-NoProfile",
    "-Command",
    "Add-Type -AssemblyName System.IO.Compression.FileSystem; [IO.Compression.ZipFile]::CreateFromDirectory($env:PAJU_PACKAGE_DIR,$env:PAJU_PACKAGE_ZIP)",
  ],
  {
    env: { ...process.env, PAJU_PACKAGE_DIR: out, PAJU_PACKAGE_ZIP: zip },
    encoding: "utf8",
  },
);
if (result.status !== 0) throw new Error(result.stderr);
console.log(
  JSON.stringify({
    directory: app,
    archive: path.join(path.dirname(out), "Paju-Essay-Road-Windows.zip"),
  }),
);
