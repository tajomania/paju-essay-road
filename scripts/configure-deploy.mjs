import fs from "node:fs";
const id = process.env.D1_DATABASE_ID;
if (
  !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(
    id || "",
  ) ||
  id === "00000000-0000-0000-0000-000000000000"
)
  throw new Error(
    "Set repository variable D1_DATABASE_ID to the provisioned Cloudflare D1 ID.",
  );
const config = JSON.parse(
  fs.readFileSync("wrangler.jsonc", "utf8").replace(/,\s*([}\]])/g, "$1"),
);
config.d1_databases[0].database_id = id;
if (process.env.WORKER_NAME) {
  if (!/^[a-z][a-z0-9-]{2,62}$/.test(process.env.WORKER_NAME))
    throw new Error("Invalid WORKER_NAME");
  config.name = process.env.WORKER_NAME;
}
fs.writeFileSync("wrangler.jsonc", JSON.stringify(config, null, 2) + "\n");
