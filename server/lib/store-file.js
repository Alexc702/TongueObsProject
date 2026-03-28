const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const config = require("../config");

const EMPTY_DB = {
  users: [],
  sessions: [],
  analyses: [],
  reports: []
};

function ensureDb() {
  const dbFile = path.join(config.dataDir, "db.json");
  fs.mkdirSync(path.dirname(dbFile), { recursive: true });
  if (!fs.existsSync(dbFile)) {
    fs.writeFileSync(dbFile, JSON.stringify(EMPTY_DB, null, 2), "utf-8");
  }
  return dbFile;
}

function readDb() {
  const dbFile = ensureDb();
  return JSON.parse(fs.readFileSync(dbFile, "utf-8"));
}

function writeDb(db) {
  const dbFile = ensureDb();
  fs.writeFileSync(dbFile, JSON.stringify(db, null, 2), "utf-8");
}

function makeId(prefix) {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "")}`;
}

async function initStore() {}

async function upsertUserByOpenId(openId) {
  const db = readDb();
  let user = db.users.find((item) => item.openId === openId);
  if (!user) {
    user = {
      id: makeId("user"),
      openId,
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString()
    };
    db.users.push(user);
  } else {
    user.lastLoginAt = new Date().toISOString();
  }
  writeDb(db);
  return user;
}

async function createAnalysis(record) {
  const db = readDb();
  const analysis = {
    id: makeId("analysis"),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...record
  };
  db.analyses.push(analysis);
  writeDb(db);
  return analysis;
}

async function getAnalysisById(id) {
  const db = readDb();
  return db.analyses.find((item) => item.id === id) || null;
}

async function updateAnalysis(id, patch) {
  const db = readDb();
  const analysis = db.analyses.find((item) => item.id === id);
  if (!analysis) {
    return null;
  }
  Object.assign(analysis, patch, { updatedAt: new Date().toISOString() });
  writeDb(db);
  return analysis;
}

async function createReport(record) {
  const db = readDb();
  const report = {
    id: makeId("report"),
    createdAt: new Date().toISOString(),
    ...record
  };
  db.reports.push(report);
  writeDb(db);
  return report;
}

async function getReportById(id) {
  const db = readDb();
  return db.reports.find((item) => item.id === id) || null;
}

async function listReportsByUser(userId) {
  const db = readDb();
  return db.reports
    .filter((item) => item.userId === userId)
    .sort((left, right) => {
      const leftTime = new Date(left.result.generatedAt || left.createdAt).getTime();
      const rightTime = new Date(right.result.generatedAt || right.createdAt).getTime();
      return rightTime - leftTime;
    });
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
