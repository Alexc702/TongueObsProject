const {
  request,
  uploadToCloudStorage,
  getCloudTempUrl,
  deleteCloudFile
} = require("./request");

function getFileName(filePath) {
  if (!filePath) {
    return "";
  }
  const slashIndex = filePath.lastIndexOf("/");
  return slashIndex >= 0 ? filePath.slice(slashIndex + 1) : filePath;
}

async function startAnalysis(payload) {
  let fileId = "";
  try {
    fileId = await uploadToCloudStorage(payload.filePath);
    const tempUrl = await getCloudTempUrl(fileId);
    return await request({
      url: "/analysis/start-cloud",
      method: "POST",
      data: {
        fileId,
        tempUrl,
        durationSeconds: Number(payload.durationSeconds || 0),
        sourceType: payload.sourceType || "album",
        originalFileName: getFileName(payload.filePath),
        size: Number(payload.size || 0),
        mimeType: payload.mimeType || "video/quicktime"
      }
    });
  } finally {
    if (fileId) {
      deleteCloudFile(fileId).catch(() => {});
    }
  }
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
