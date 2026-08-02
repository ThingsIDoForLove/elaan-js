// End-to-end check of the Elaan MCP server: spawn it for real, speak JSON-RPC
// over stdio, and point it at a stub API so we can assert on the exact HTTP
// calls each tool makes.
import { spawn } from "node:child_process";
import http from "node:http";

const seen = [];
const stub = http.createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    seen.push({ method: req.method, url: req.url, body: body ? JSON.parse(body) : undefined,
                auth: req.headers.authorization });
    // One canned failure so the error path is exercised too.
    if (req.url.includes("nonexistent")) {
      res.writeHead(404, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ detail: "notification type 'nonexistent' does not exist" }));
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, echo: req.url }));
  });
});
await new Promise((r) => stub.listen(0, r));
const base = `http://127.0.0.1:${stub.address().port}/v1`;

const child = spawn("node", ["dist/index.js"], {
  cwd: new URL("..", import.meta.url).pathname,
  env: { ...process.env, ELAAN_API_KEY: "sk_test_do_not_log", ELAAN_API_BASE: base },
  stdio: ["pipe", "pipe", "pipe"],
});

let stderr = "";
child.stderr.on("data", (d) => (stderr += d));

const pending = new Map();
let buf = "";
child.stdout.on("data", (chunk) => {
  buf += chunk;
  let i;
  while ((i = buf.indexOf("\n")) >= 0) {
    const line = buf.slice(0, i).trim();
    buf = buf.slice(i + 1);
    if (!line) continue;
    const msg = JSON.parse(line);
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    }
  }
});

let nextId = 1;
function rpc(method, params) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, resolve);
    child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
    setTimeout(() => reject(new Error(`timeout on ${method}`)), 10000);
  });
}
function notify(method, params) {
  child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method, params }) + "\n");
}

const init = await rpc("initialize", {
  protocolVersion: "2024-11-05",
  capabilities: {},
  clientInfo: { name: "e2e", version: "1" },
});
console.log("initialize →", init.result.serverInfo, "proto", init.result.protocolVersion);
notify("notifications/initialized", {});

const list = await rpc("tools/list", {});
const tools = list.result.tools;
console.log(`\ntools/list → ${tools.length} tools`);
for (const t of tools) {
  const req = Object.keys(t.inputSchema?.properties ?? {}).filter((k) =>
    (t.inputSchema.required ?? []).includes(k));
  console.log(`  ${t.name.padEnd(30)} req:[${req.join(",")}]`);
}

async function call(name, args) {
  const r = await rpc("tools/call", { name, arguments: args });
  const text = r.result.content.map((c) => c.text).join("");
  return { isError: !!r.result.isError, text };
}

console.log("\n--- calls ---");
const checks = [];

let r = await call("create_notification_type", {
  key: "order_shipped", channel_defaults: { email: true, inbox: true }, variables: ["order_id"],
});
checks.push(["create_notification_type ok", !r.isError]);

r = await call("create_template", {
  channel: "email", notification_type_key: "order_shipped",
  subject: "Order {{ order_id }} shipped", body: "<p>Hi {{ first_name }}</p>",
});
checks.push(["create_template(email) ok", !r.isError]);

r = await call("create_template", { channel: "email", notification_type_key: "x", body: "no subject" });
checks.push(["create_template(email) rejects missing subject", r.isError && /subject/.test(r.text)]);

r = await call("create_template", { channel: "push", notification_type_key: "x", title: "Hi" });
checks.push(["create_template(push) accepts title only", !r.isError]);

r = await call("update_notification_type", { key: "order_shipped", allows_opt_out: false });
checks.push(["update_notification_type fans out", !r.isError]);

r = await call("update_notification_type", { key: "order_shipped" });
checks.push(["update_notification_type rejects empty edit", r.isError]);

r = await call("get_notification_type", { key: "nonexistent" });
checks.push(["404 surfaces the API detail string", r.isError && /does not exist/.test(r.text)]);

r = await call("trigger_notification", {
  notification_type_key: "order_shipped", external_ids: ["crm-1"], variables: { order_id: "A-1" },
});
checks.push(["trigger_notification ok", !r.isError]);

console.log();
let failed = 0;
for (const [label, pass] of checks) {
  console.log(`  ${pass ? "PASS" : "FAIL"}  ${label}`);
  if (!pass) failed++;
}

console.log("\n--- HTTP calls the stub actually received ---");
for (const s of seen) console.log(`  ${s.method.padEnd(6)} ${s.url}`);

const leaked = seen.some((s) => JSON.stringify(s.body ?? "").includes("sk_test_do_not_log"));
const authOk = seen.every((s) => s.auth === "Bearer sk_test_do_not_log");
console.log(`\n  auth header on every call: ${authOk}`);
console.log(`  key leaked into a body:    ${leaked}`);
if (!authOk || leaked) failed++;

// stdout must carry only protocol messages; anything else corrupts the session.
console.log(`  stderr (should be empty):  ${JSON.stringify(stderr.slice(0, 200))}`);


// Startup guards: an unset key and an unexpanded ${VAR} must both refuse to
// start, because Claude Code passes the literal placeholder through when the
// variable is missing and a truthy-but-bogus key would 401 on every call.
import { spawnSync } from "node:child_process";
for (const [label, key] of [["unset", undefined], ["unexpanded ${VAR}", "${ELAAN_API_KEY}"]]) {
  const env = { ...process.env };
  if (key === undefined) delete env.ELAAN_API_KEY; else env.ELAAN_API_KEY = key;
  const r = spawnSync("node", ["dist/index.js"], { cwd: new URL("..", import.meta.url).pathname, env, encoding: "utf8" });
  const good = r.status === 1 && /console\.elaan\.io/.test(r.stderr) && r.stdout === "";
  console.log(`  ${good ? "PASS" : "FAIL"}  refuses to start with ${label}`);
  if (!good) failed++;
}

child.kill();
stub.close();
console.log(failed === 0 ? "\nALL CHECKS PASSED" : `\n${failed} CHECK(S) FAILED`);
process.exit(failed === 0 ? 0 : 1);
