const { request, upload } = require("./request");

function startAnalysis(payload) {
  return upload({
    url: "/analysis/start",
    filePath: payload.filePath,
    formData: {
      durationSeconds: String(payload.durationSeconds || ""),
      sourceType: payload.sourceType || "album"
    }
  });
}

function queryAnalysis(analysisId) {
  return request({
    url: `/analysis/${analysisId}`
  });
}

function getReport(reportId) {
  return request({
    url: `/reports/${reportId}`
  });
}

function listReports() {
  return request({
    url: "/reports/history"
  });
}

function compareReports(leftId, rightId) {
  return request({
    url: `/reports/compare?leftId=${encodeURIComponent(leftId)}&rightId=${encodeURIComponent(rightId)}`
  });
}

function getHealthStatus() {
  return request({
    url: "/health",
    auth: false
  });
}

module.exports = {
  startAnalysis,
  queryAnalysis,
  getReport,
  listReports,
  compareReports,
  getHealthStatus
};
