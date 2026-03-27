const crypto = require("crypto");
const fs = require("fs/promises");
const path = require("path");
const config = require("../config");

function sha256HexOfJson(payload) {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(payload, Object.keys(payload).sort()))
    .digest("hex");
}

function buildSignature({ method, timestamp, nonce, body }) {
  const lines = [method.toUpperCase()];
  if (body) {
    lines.push(sha256HexOfJson(body));
  }
  const stringToSign = lines.join("\n");
  const authFactor = `${config.healthAccessKey}${timestamp}${nonce}${stringToSign}`;
  const algorithm = config.healthSignatureAlgorithm.toLowerCase() === "sha512" ? "sha512" : "sha256";
  return crypto
    .createHmac(algorithm, config.healthAccessSecret)
    .update(authFactor)
    .digest("hex")
    .toUpperCase();
}

function assertConfigured() {
  if (!config.healthAccessKey || !config.healthAccessSecret) {
    throw new Error("缺少 HEALTH_ACCESS_KEY 或 HEALTH_ACCESS_SECRET");
  }
}

async function startFaceAnalysis(file) {
  assertConfigured();
  const timestamp = String(Date.now());
  const nonce = crypto.randomUUID();
  const signature = buildSignature({
    method: "POST",
    timestamp,
    nonce
  });

  const buffer = await fs.readFile(file.path);
  const blob = new Blob([buffer], { type: file.mimetype || "application/octet-stream" });
  const form = new FormData();
  form.append("file", blob, path.basename(file.originalname || file.path));

  const response = await fetch(`${config.healthApiHost}${config.healthStartPath}`, {
    method: "POST",
    headers: {
      "X-Access-Key": config.healthAccessKey,
      "X-Timestamp": timestamp,
      "X-Nonce": nonce,
      "X-Signature": signature
    },
    body: form
  });
  return response.json();
}

async function queryFaceAnalysis(upstreamAnalysisId) {
  assertConfigured();
  const timestamp = String(Date.now());
  const nonce = crypto.randomUUID();
  const body = { analysisId: upstreamAnalysisId };
  const signature = buildSignature({
    method: "POST",
    timestamp,
    nonce,
    body
  });
  const response = await fetch(`${config.healthApiHost}${config.healthQueryPath}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Access-Key": config.healthAccessKey,
      "X-Timestamp": timestamp,
      "X-Nonce": nonce,
      "X-Signature": signature
    },
    body: JSON.stringify(body)
  });
  return response.json();
}

module.exports = {
  startFaceAnalysis,
  queryFaceAnalysis
};
