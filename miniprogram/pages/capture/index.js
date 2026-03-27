const { ensureLogin } = require("../../utils/auth");
const { startAnalysis } = require("../../utils/api");
const {
  syncPrivacyState,
  ensurePrivacyAuthorized,
  markPrivacyAuthorized,
  openPrivacyContract,
  DEFAULT_CONTRACT_NAME
} = require("../../utils/privacy");

let timer = null;

Page({
  data: {
    recording: false,
    elapsedSeconds: 0,
    privacyNeedAuthorization: false,
    privacyContractName: DEFAULT_CONTRACT_NAME
  },

  onReady() {
    this.cameraContext = wx.createCameraContext();
  },

  onShow() {
    this.refreshPrivacyState();
  },

  onUnload() {
    this.clearTimer();
  },

  async refreshPrivacyState() {
    await syncPrivacyState(this);
  },

  clearTimer() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  },

  async goHistory() {
    wx.switchTab({
      url: "/pages/history/index"
    });
  },

  async ensureAuthenticated() {
    try {
      await ensureLogin();
      return true;
    } catch (error) {
      wx.showToast({
        title: error.message || "登录失败",
        icon: "none"
      });
      return false;
    }
  },

  async ensurePrivacyBeforeAction() {
    const authorized = await ensurePrivacyAuthorized(this);
    if (!authorized) {
      wx.showToast({
        title: "请先同意隐私指引",
        icon: "none"
      });
      return false;
    }
    return true;
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
    await this.refreshPrivacyState();
  },

  openCameraPermissionSetting() {
    wx.showModal({
      title: "需要相机与麦克风权限",
      content: "录制舌面视频前，请在设置中允许相机和麦克风权限。",
      success: (result) => {
        if (!result.confirm) {
          return;
        }
        wx.openSetting({});
      }
    });
  },

  async startRecording() {
    const privacyAuthorized = await this.ensurePrivacyBeforeAction();
    if (!privacyAuthorized) {
      return;
    }
    if (!this.cameraContext) {
      wx.showToast({ title: "相机未就绪", icon: "none" });
      return;
    }
    this.cameraContext.startRecord({
      success: () => {
        this.setData({ recording: true, elapsedSeconds: 0 });
        this.clearTimer();
        timer = setInterval(() => {
          const nextValue = this.data.elapsedSeconds + 1;
          this.setData({ elapsedSeconds: nextValue });
          if (nextValue >= 20) {
            this.stopRecording();
          }
        }, 1000);
      },
      fail: (error) => {
        if (/auth deny|authorize no response|auth denied/i.test(error.errMsg || "")) {
          this.openCameraPermissionSetting();
          return;
        }
        wx.showToast({
          title: error.errMsg || "无法开始录制",
          icon: "none"
        });
      }
    });
  },

  stopRecording() {
    if (!this.data.recording || !this.cameraContext) {
      return;
    }
    this.cameraContext.stopRecord({
      success: async (result) => {
        this.clearTimer();
        this.setData({ recording: false });
        try {
          const info = await this.getVideoInfo(result.tempVideoPath);
          await this.submitVideo({
            filePath: result.tempVideoPath,
            durationSeconds: Math.round(info.duration || this.data.elapsedSeconds),
            size: info.size || 0,
            sourceType: "record"
          });
        } catch (error) {
          wx.showToast({ title: error.message || "读取视频失败", icon: "none" });
        }
      },
      fail: (error) => {
        this.clearTimer();
        this.setData({ recording: false });
        wx.showToast({
          title: error.errMsg || "结束录制失败",
          icon: "none"
        });
      }
    });
  },

  async chooseVideo() {
    const privacyAuthorized = await this.ensurePrivacyBeforeAction();
    if (!privacyAuthorized) {
      return;
    }
    wx.chooseMedia({
      count: 1,
      mediaType: ["video"],
      sourceType: ["album"],
      success: async (result) => {
        const tempFile = result.tempFiles && result.tempFiles[0];
        if (!tempFile) {
          return;
        }
        try {
          const info = await this.getVideoInfo(tempFile.tempFilePath);
          await this.submitVideo({
            filePath: tempFile.tempFilePath,
            durationSeconds: Math.round(info.duration || tempFile.duration || 0),
            size: info.size || tempFile.size || 0,
            sourceType: "album"
          });
        } catch (error) {
          wx.showToast({
            title: error.message || "无法读取视频",
            icon: "none"
          });
        }
      },
      fail: (error) => {
        if (!error || /cancel/i.test(error.errMsg || "")) {
          return;
        }
        wx.showToast({
          title: error.errMsg || "无法选择视频",
          icon: "none"
        });
      }
    });
  },

  getVideoInfo(filePath) {
    return new Promise((resolve, reject) => {
      wx.getVideoInfo({
        src: filePath,
        success: resolve,
        fail: reject
      });
    });
  },

  validateVideo(meta) {
    if (!meta.durationSeconds || meta.durationSeconds <= 10) {
      throw new Error("视频时长需大于10秒");
    }
    if (meta.durationSeconds > 20) {
      throw new Error("视频时长不能超过20秒");
    }
    if (meta.size && meta.size > 15 * 1024 * 1024) {
      throw new Error("视频文件过大，请重新拍摄");
    }
  },

  async submitVideo(meta) {
    this.validateVideo(meta);
    const authenticated = await this.ensureAuthenticated();
    if (!authenticated) {
      return;
    }
    wx.showLoading({
      title: "上传中",
      mask: true
    });
    try {
      const result = await startAnalysis(meta);
      wx.hideLoading();
      wx.navigateTo({
        url: `/pages/analyzing/index?analysisId=${encodeURIComponent(result.analysisId)}`
      });
    } catch (error) {
      wx.hideLoading();
      wx.navigateTo({
        url: `/pages/failure/index?message=${encodeURIComponent(error.message || "启动检测失败")}`
      });
    }
  }
});
