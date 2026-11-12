/**
 * LAN server for NeuroBridge Asha.
 *
 * Serves the production Next.js build on two sockets:
 *   - HTTP  on 0.0.0.0:3000  (loopback-friendly, same origin as the dev flow)
 *   - HTTPS on 0.0.0.0:8443  (LAN access from phones/tablets)
 *
 * Why HTTPS: browsers only expose camera/microphone and service workers in a
 * secure context. A phone opening http://192.168.x.x:3000 is NOT a secure
 * context, so getUserMedia and the push service worker are blocked. HTTPS with
 * a locally trusted CA (mkcert) makes the phone treat the origin as secure.
 *
 * The certificate is issued by a local CA; install that CA on the phone
 * (see `npm run serve:lan -- --print-ca`).
 */
import { createServer as createHttpServer } from "node:http";
import { createServer as createHttpsServer } from "node:https";
import { readFileSync, existsSync } from "node:fs";
import { networkInterfaces, hostname } from "node:os";
import { join } from "node:path";
import next from "next";

const ROOT = process.cwd();
const CERT_DIR = process.env.ASHA_CERT_DIR || join(ROOT, ".certs");
const CERT_FILE = join(CERT_DIR, "asha-lan.pem");
const KEY_FILE = join(CERT_DIR, "asha-lan-key.pem");
const HTTP_PORT = Number(process.env.PORT || 3000);
const HTTPS_PORT = Number(process.env.HTTPS_PORT || 8443);
const HOST = process.env.HOST || "0.0.0.0";

if (process.argv.includes("--print-ca")) {
  console.log(join(CERT_DIR, "rootCA.pem"));
  process.exit(0);
}

function lanAddresses() {
  const out = [];
  for (const [name, addrs] of Object.entries(networkInterfaces())) {
    for (const addr of addrs || []) {
      if (addr.family !== "IPv4" || addr.internal) continue;
      out.push({ name, address: addr.address });
    }
  }
  return out;
}

const app = next({ dev: false, dir: ROOT, hostname: HOST, port: HTTP_PORT });
const handle = app.getRequestHandler();

const CA_FILE = join(CERT_DIR, "rootCA.pem");

/** Serves the local CA so a phone can fetch and install it over the LAN. */
function serveCa(req, res) {
  if (!existsSync(CA_FILE)) {
    res.statusCode = 404;
    res.end("CA not found");
    return;
  }
  res.setHeader("Content-Type", "application/x-x509-ca-cert");
  res.setHeader(
    "Content-Disposition",
    'attachment; filename="asha-lan-ca.pem"',
  );
  res.end(readFileSync(CA_FILE));
}

app.prepare().then(() => {
  const route = (req, res) => {
    if (req.url === "/asha-ca.pem") {
      serveCa(req, res);
      return;
    }
    handle(req, res);
  };

  createHttpServer(route).listen(HTTP_PORT, HOST, () => {
    console.log(`> HTTP  http://${HOST}:${HTTP_PORT}`);
  });

  if (!existsSync(CERT_FILE) || !existsSync(KEY_FILE)) {
    console.warn(
      `> HTTPS disabled: no certificate at ${CERT_FILE}. Run:\n` +
        `    mkcert -cert-file ${CERT_FILE} -key-file ${KEY_FILE} <lan-ip> localhost 127.0.0.1`,
    );
    return;
  }

  const tls = {
    cert: readFileSync(CERT_FILE),
    key: readFileSync(KEY_FILE),
  };

  createHttpsServer(tls, route).listen(HTTPS_PORT, HOST, () => {
    console.log(`> HTTPS https://${HOST}:${HTTPS_PORT}`);
    for (const { name, address } of lanAddresses()) {
      console.log(`  http://${address}:${HTTP_PORT}  (${name})`);
      console.log(`  https://${address}:${HTTPS_PORT}  (${name})`);
    }
    console.log(`> hostname: ${hostname()}`);
  });
});
