const { cloudEnvId } = require("./config");

App({
  globalData: {
    sessionToken: "",
    user: null,
    devMode: false,
    privacyAuthorized: false,
    privacyContractName: "《用户隐私保护指引》"
  },
  onLaunch() {
    if (!wx.cloud) {
      console.warn("wx.cloud is not available in current runtime");
    } else {
      wx.cloud.init({
        env: cloudEnvId,
        traceUser: true
      });
    }
    this.globalData.sessionToken = wx.getStorageSync("tongueObsSessionToken") || "";
    this.globalData.user = wx.getStorageSync("tongueObsUser") || null;
    this.globalData.devMode = Boolean(wx.getStorageSync("tongueObsDevMode"));
  }
});
