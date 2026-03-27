const { ensureLogin } = require("../../utils/auth");
const { getHealthStatus } = require("../../utils/api");
const {
  syncPrivacyState,
  markPrivacyAuthorized,
  openPrivacyContract,
  DEFAULT_CONTRACT_NAME
} = require("../../utils/privacy");

Page({
  data: {
    privacyNeedAuthorization: false,
    privacyContractName: DEFAULT_CONTRACT_NAME,
    initializing: true
  },

  async onShow() {
    await this.prepareLaunch();
  },

  async prepareLaunch() {
    const privacyState = await syncPrivacyState(this);
    if (privacyState.needAuthorization) {
      this.setData({
        initializing: false
      });
      return;
    }

    await this.initializeApp();
  },

  async initializeApp() {
    if (this.initializingRequest) {
      return;
    }
    this.initializingRequest = true;
    this.setData({
      initializing: true
    });
    try {
      await ensureLogin();
      await getHealthStatus();
      wx.switchTab({
        url: "/pages/capture/index"
      });
    } catch (error) {
      wx.showModal({
        title: "初始化失败",
        content: error.message || "登录状态获取失败，请重试",
        showCancel: false,
        success: () => {
          wx.switchTab({
            url: "/pages/capture/index"
          });
        }
      });
    } finally {
      this.initializingRequest = false;
      this.setData({
        initializing: false
      });
    }
  },

  async openPrivacyGuide() {
    try {
      await openPrivacyContract();
    } catch (error) {
      wx.showToast({
        title: error.message || "无法打开隐私指引",
        icon: "none"
      });
    }
  },

  async handleAgreePrivacyAuthorization() {
    markPrivacyAuthorized(this);
    await this.prepareLaunch();
  }
});
