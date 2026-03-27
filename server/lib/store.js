const crypto = require("crypto");
const mysql = require("mysql2/promise");
const config = require("../config");

const TABLE_DEFINITIONS = [
  `CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(64) PRIMARY KEY,
    open_id VARCHAR(191) NOT NULL UNIQUE,
    created_at VARCHAR(32) NOT NULL,
    last_login_at VARCHAR(32) NOT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS analyses (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    upstream_analysis_id VARCHAR(128) NOT NULL,
    status VARCHAR(32) NOT NULL,
    source_type VARCHAR(32) NOT NULL,
    original_file_name VARCHAR(255) NULL,
    video_meta_json LONGTEXT NULL,
    report_id VARCHAR(64) NULL,
    error_code VARCHAR(64) NULL,
    error_message VARCHAR(255) NULL,
    created_at VARCHAR(32) NOT NULL,
    updated_at VARCHAR(32) NOT NULL,
    UNIQUE KEY uq_analyses_upstream_analysis_id (upstream_analysis_id),
    KEY idx_analyses_user_created_at (user_id, created_at),
    KEY idx_analyses_report_id (report_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS reports (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    analysis_id VARCHAR(64) NOT NULL,
    upstream_analysis_id VARCHAR(128) NOT NULL,
    report_no VARCHAR(128) NULL,
    generated_at VARCHAR(32) NULL,
    result_json LONGTEXT NOT NULL,
    created_at VARCHAR(32) NOT NULL,
    UNIQUE KEY uq_reports_analysis_id (analysis_id),
    KEY idx_reports_user_generated_at (user_id, generated_at),
    KEY idx_reports_report_no (report_no)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
];

const ANALYSIS_FIELD_MAP = {
  userId: "user_id",
  upstreamAnalysisId: "upstream_analysis_id",
  status: "status",
  sourceType: "source_type",
  originalFileName: "original_file_name",
  videoMeta: "video_meta_json",
  reportId: "report_id",
  errorCode: "error_code",
  errorMsg: "error_message"
};

let pool = null;
let initPromise = null;

function nowIso() {
  return new Date().toISOString();
}

function makeId(prefix) {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "")}`;
}

function requireDatabaseConfig() {
  const missing = ["dbHost", "dbName", "dbUser", "dbPassword"].filter((key) => !config[key]);
  if (missing.length) {
    throw new Error(`缺少数据库配置: ${missing.join(", ")}`);
  }
}

function getPool() {
  if (pool) {
    return pool;
  }
  requireDatabaseConfig();
  pool = mysql.createPool({
    host: config.dbHost,
    port: config.dbPort,
    database: config.dbName,
    user: config.dbUser,
    password: config.dbPassword,
    charset: config.dbCharset,
    waitForConnections: true,
    connectionLimit: config.dbConnectionLimit,
    queueLimit: 0
  });
  return pool;
}

async function initStore() {
  if (!initPromise) {
    initPromise = (async () => {
      const db = getPool();
      for (const statement of TABLE_DEFINITIONS) {
        await db.query(statement);
      }
    })();
  }
  return initPromise;
}

function stringifyJsonValue(value) {
  if (value === undefined || value === null) {
    return null;
  }
  return JSON.stringify(value);
}

function parseJsonValue(value, fallback = null) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }
  if (typeof value === "object") {
    return value;
  }
  try {
    return JSON.parse(value);
  } catch (error) {
    return fallback;
  }
}

function mapUserRow(row) {
  if (!row) {
    return null;
  }
  return {
    id: row.id,
    openId: row.open_id,
    createdAt: row.created_at,
    lastLoginAt: row.last_login_at
  };
}

function mapAnalysisRow(row) {
  if (!row) {
    return null;
  }
  return {
    id: row.id,
    userId: row.user_id,
    upstreamAnalysisId: row.upstream_analysis_id,
    status: row.status,
    sourceType: row.source_type,
    originalFileName: row.original_file_name,
    videoMeta: parseJsonValue(row.video_meta_json, null),
    reportId: row.report_id,
    errorCode: row.error_code,
    errorMsg: row.error_message,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapReportRow(row) {
  if (!row) {
    return null;
  }
  return {
    id: row.id,
    userId: row.user_id,
    analysisId: row.analysis_id,
    upstreamAnalysisId: row.upstream_analysis_id,
    createdAt: row.created_at,
    result: parseJsonValue(row.result_json, {})
  };
}

async function upsertUserByOpenId(openId) {
  await initStore();
  const db = getPool();
  const [rows] = await db.query("SELECT * FROM users WHERE open_id = ? LIMIT 1", [openId]);
  const now = nowIso();

  if (!rows.length) {
    const user = {
      id: makeId("user"),
      openId,
      createdAt: now,
      lastLoginAt: now
    };
    await db.query(
      "INSERT INTO users (id, open_id, created_at, last_login_at) VALUES (?, ?, ?, ?)",
      [user.id, user.openId, user.createdAt, user.lastLoginAt]
    );
    return user;
  }

  const user = mapUserRow(rows[0]);
  await db.query("UPDATE users SET last_login_at = ? WHERE id = ?", [now, user.id]);
  user.lastLoginAt = now;
  return user;
}

async function createAnalysis(record) {
  await initStore();
  const db = getPool();
  const analysis = {
    id: makeId("analysis"),
    createdAt: nowIso(),
    updatedAt: nowIso(),
    reportId: null,
    errorCode: null,
    errorMsg: null,
    ...record
  };

  await db.query(
    `INSERT INTO analyses (
      id, user_id, upstream_analysis_id, status, source_type, original_file_name,
      video_meta_json, report_id, error_code, error_message, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      analysis.id,
      analysis.userId,
      analysis.upstreamAnalysisId,
      analysis.status,
      analysis.sourceType,
      analysis.originalFileName || null,
      stringifyJsonValue(analysis.videoMeta),
      analysis.reportId,
      analysis.errorCode,
      analysis.errorMsg,
      analysis.createdAt,
      analysis.updatedAt
    ]
  );

  return analysis;
}

async function getAnalysisById(id) {
  await initStore();
  const db = getPool();
  const [rows] = await db.query("SELECT * FROM analyses WHERE id = ? LIMIT 1", [id]);
  return mapAnalysisRow(rows[0]);
}

async function updateAnalysis(id, patch) {
  await initStore();
  const db = getPool();
  const assignments = [];
  const values = [];

  for (const [key, column] of Object.entries(ANALYSIS_FIELD_MAP)) {
    if (!(key in patch)) {
      continue;
    }
    assignments.push(`${column} = ?`);
    if (key === "videoMeta") {
      values.push(stringifyJsonValue(patch[key]));
    } else {
      values.push(patch[key]);
    }
  }

  const updatedAt = nowIso();
  assignments.push("updated_at = ?");
  values.push(updatedAt);
  values.push(id);

  await db.query(`UPDATE analyses SET ${assignments.join(", ")} WHERE id = ?`, values);
  return getAnalysisById(id);
}

async function createReport(record) {
  await initStore();
  const db = getPool();
  const result = record.result || {};
  const report = {
    id: makeId("report"),
    createdAt: nowIso(),
    ...record
  };

  await db.query(
    `INSERT INTO reports (
      id, user_id, analysis_id, upstream_analysis_id, report_no, generated_at, result_json, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      report.id,
      report.userId,
      report.analysisId,
      report.upstreamAnalysisId,
      result.reportNo || null,
      result.generatedAt || null,
      stringifyJsonValue(result),
      report.createdAt
    ]
  );

  return report;
}

async function getReportById(id) {
  await initStore();
  const db = getPool();
  const [rows] = await db.query("SELECT * FROM reports WHERE id = ? LIMIT 1", [id]);
  return mapReportRow(rows[0]);
}

async function listReportsByUser(userId) {
  await initStore();
  const db = getPool();
  const [rows] = await db.query(
    `SELECT * FROM reports
     WHERE user_id = ?
     ORDER BY CASE
       WHEN generated_at IS NULL OR generated_at = '' THEN created_at
       ELSE generated_at
     END DESC`,
    [userId]
  );
  return rows.map(mapReportRow);
}

module.exports = {
  initStore,
  makeId,
  upsertUserByOpenId,
  createAnalysis,
  getAnalysisById,
  updateAnalysis,
  createReport,
  getReportById,
  listReportsByUser
};
