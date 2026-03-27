const path = require("path");

const rootDir = path.resolve(__dirname, "..");

module.exports = {
  port: Number(process.env.PORT || 3100),
  dataDir: process.env.DATA_DIR || path.join(rootDir, "server", "data"),
  dbHost: process.env.DB_HOST || "",
  dbPort: Number(process.env.DB_PORT || 3306),
  dbName: process.env.DB_NAME || "",
  dbUser: process.env.DB_USER || "",
  dbPassword: process.env.DB_PASSWORD || "",
  dbCharset: process.env.DB_CHARSET || "utf8mb4",
  dbConnectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 10),
  sessionSecret: process.env.SESSION_SECRET || "tongueobs_prod_2026_03_28_x8Kp2mQ7Ls9vN4cR5Ha1Zd6Wp3",
  healthApiHost: process.env.HEALTH_API_HOST || "https://open.lifeemergence.com",
  healthStartPath:
    process.env.HEALTH_START_PATH ||
    "/smyx-open-api/open/health-analysis/v1/start-face-analysis",
  healthQueryPath:
    process.env.HEALTH_QUERY_PATH ||
    "/smyx-open-api/open/health-analysis/v1/query-face-analysis-json",
  healthAccessKey: process.env.HEALTH_ACCESS_KEY || "Q0qlLN9c46bOrBe5k91m",
  healthAccessSecret: process.env.HEALTH_ACCESS_SECRET || "RZZ_0afgkNdOXyzeAGJVGGpZQo9Q4aBruSkyXz_muxk",
  healthSignatureAlgorithm: process.env.HEALTH_SIGNATURE_ALGORITHM || "sha256",
  healthPollIntervalMs: Number(process.env.HEALTH_POLL_INTERVAL_MS || 3000),
  wechatAppId: process.env.WECHAT_APPID || "",
  wechatAppSecret: process.env.WECHAT_APPSECRET || "",
  devOpenId: process.env.DEV_OPEN_ID || "dev_open_id_lulu"
};
