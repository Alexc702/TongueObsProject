const crypto = require("crypto");
const config = require("../config");

function sign(payload) {
  return crypto
    .createHmac("sha256", config.sessionSecret)
    .update(payload)
    .digest("hex");
}

function createSessionToken(user) {
  const payload = JSON.stringify({
    userId: user.id,
    openId: user.openId,
    issuedAt: Date.now()
  });
  const encoded = Buffer.from(payload).toString("base64url");
  return `${encoded}.${sign(encoded)}`;
}

function parseSessionToken(token) {
  if (!token || !token.includes(".")) {
    return null;
  }
  const [encoded, signature] = token.split(".");
  if (sign(encoded) !== signature) {
    return null;
  }
  try {
    return JSON.parse(Buffer.from(encoded, "base64url").toString("utf-8"));
  } catch (error) {
    return null;
  }
}

module.exports = {
  createSessionToken,
  parseSessionToken
};
