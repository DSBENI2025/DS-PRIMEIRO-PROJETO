import { execFileSync } from "node:child_process";

const tracked = execFileSync("git", ["ls-files"], {
  encoding: "utf8",
})
  .split("\n")
  .map((value) => value.trim())
  .filter(Boolean);

const forbidden = tracked.filter((file) => {
  if (file === ".env.example") return false;

  if (/^\.env(?:\..+)?$/.test(file)) return true;
  if (/(^|\/)\.env(?:\..+)?$/.test(file)) return true;
  if (/(^|\/)\.vercel\//.test(file)) return true;
  if (/(^|\/)supabase\/\.temp\//.test(file)) return true;
  if (/(^|\/)\.supabase\//.test(file)) return true;
  if (/(^|\/)id_(rsa|dsa|ecdsa|ed25519)(\.pub)?$/.test(file)) return true;
  if (/\.(p12|pfx|pem)$/i.test(file)) return true;

  return false;
});

if (forbidden.length > 0) {
  console.error("Sensitive/local-only files are tracked by Git:");
  for (const file of forbidden) {
    console.error("- " + file);
  }
  process.exit(1);
}

console.log("Sensitive file check passed.");
