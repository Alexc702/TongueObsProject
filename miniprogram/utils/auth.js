const { request } = require("./request");
const { getPrivacySetting } = require("./privacy");

function loginCode() {
  return new Promise((resolve) => {
    wx.login({
      success(result) {
        resolve(result.code || "");
      },
      fail() {
        resolve("");
      }
    });
  });
}

async function ensureLogin(force = false) {
  const privacyState = await getPrivacySetting();
  if (privacyState.needAuthorization) {
    throw new Error("请先同意用户隐私保护指引");
  }

  const app = getApp();
  const cachedToken = wx.getStorageSync("tongueObsSessionToken") || "";
  if (!force && cachedToken) {
    app.globalData.sessionToken = cachedToken;
    app.globalData.user = wx.getStorageSync("tongueObsUser") || null;
    app.globalData.devMode = Boolean(wx.getStorageSync("tongueObsDevMode"));
    return {
      token: cachedToken,
      user: app.globalData.user,
      devMode: app.globalData.devMode
    };
  }

  const code = await loginCode();
  const result = await request({
    url: "/auth/wechat-login",
    method: "POST",
    data: { code },
    auth: false
  });
  wx.setStorageSync("tongueObsSessionToken", result.token);
  wx.setStorageSync("tongueObsUser", result.user);
  wx.setStorageSync("tongueObsDevMode", result.devMode);
  app.globalData.sessionToken = result.token;
  app.globalData.user = result.user;
  app.globalData.devMode = Boolean(result.devMode);
  return result;
}

module.exports = {
  ensureLogin
};
