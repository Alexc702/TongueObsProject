const { apiBaseUrl } = require("../config");

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

function request(options) {
  const {
    url,
    method = "GET",
    data = {},
    header = {},
    auth = true
  } = options;

  return new Promise((resolve, reject) => {
    wx.request({
      url: `${apiBaseUrl}${url}`,
      method,
      data,
      header: {
        "Content-Type": "application/json",
        ...(auth && getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
        ...header
      },
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

function upload(options) {
  const { url, filePath, name = "file", formData = {} } = options;
  return new Promise((resolve, reject) => {
    wx.uploadFile({
      url: `${apiBaseUrl}${url}`,
      filePath,
      name,
      formData,
      header: getToken() ? { Authorization: `Bearer ${getToken()}` } : {},
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

module.exports = {
  request,
  upload
};
