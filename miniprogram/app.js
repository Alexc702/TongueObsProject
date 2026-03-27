App({
  globalData: {
    sessionToken: "",
    user: null,
    devMode: false,
    privacyAuthorized: false,
    privacyContractName: "《用户隐私保护指引》"
  },
  onLaunch() {
    this.globalData.sessionToken = wx.getStorageSync("tongueObsSessionToken") || "";
    this.globalData.user = wx.getStorageSync("tongueObsUser") || null;
    this.globalData.devMode = Boolean(wx.getStorageSync("tongueObsDevMode"));
  }
});
