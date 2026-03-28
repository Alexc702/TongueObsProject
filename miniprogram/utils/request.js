const { cloudEnvId, containerService, uploadPrefix } = require("../config");

function getToken() {
  return wx.getStorageSync("tongueObsSessionToken") || "";
}

function normalizeResponse(res) {
  const payload = typeof res.data === "string" ? JSON.parse(res.data || "{}") : res.data;
  if (res.statusCode >= 200 && res.statusCode < 300 && payload.success !== false) {
    return payload.data;
  }
  throw new Error((payload && payload.errorMsg) || "请求失败");
}

function buildHeaders({ auth = true, header = {} } = {}) {
  const token = auth ? getToken() : "";
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}`, "X-Session-Token": token } : {}),
    "X-WX-SERVICE": containerService,
    ...header
  };
}

function request(options) {
  const { url, method = "GET", data = {}, header = {}, auth = true } = options;

  return new Promise((resolve, reject) => {
    wx.cloud.callContainer({
      config: {
        env: cloudEnvId
      },
      path: `/api${url}`,
      method,
      data,
      header: buildHeaders({ auth, header }),
      success(res) {
        try {
          resolve(normalizeResponse(res));
        } catch (error) {
          reject(error);
        }
      },
      fail(error) {
        reject(error);
      }
    });
  });
}

function makeCloudPath(filePath) {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
  const dotIndex = filePath.lastIndexOf(".");
  const extension = dotIndex >= 0 ? filePath.slice(dotIndex) : ".mov";
  return `${uploadPrefix}/${suffix}${extension}`;
}

function uploadToCloudStorage(filePath) {
  return new Promise((resolve, reject) => {
    wx.cloud.uploadFile({
      cloudPath: makeCloudPath(filePath),
      filePath,
      success(result) {
        resolve(result.fileID);
      },
      fail(error) {
        reject(error);
      }
    });
  });
}

function getCloudTempUrl(fileId) {
  return new Promise((resolve, reject) => {
    wx.cloud.getTempFileURL({
      fileList: [fileId],
      success(result) {
        const entry = result.fileList && result.fileList[0];
        if (!entry || !entry.tempFileURL) {
          reject(new Error("无法获取云文件临时链接"));
          return;
        }
        resolve(entry.tempFileURL);
      },
      fail(error) {
        reject(error);
      }
    });
  });
}

function deleteCloudFile(fileId) {
  return new Promise((resolve, reject) => {
    wx.cloud.deleteFile({
      fileList: [fileId],
      success: resolve,
      fail: reject
    });
  });
}

module.exports = {
  request,
  uploadToCloudStorage,
  getCloudTempUrl,
  deleteCloudFile
};
