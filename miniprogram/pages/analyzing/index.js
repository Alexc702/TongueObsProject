const { queryAnalysis } = require("../../utils/api");

let pollTimer = null;

Page({
  data: {
    analysisId: "",
    statusText: "正在分析舌象、面容与体质信息",
    progress: 12
  },

  onLoad(options) {
    this.setData({
      analysisId: options.analysisId || ""
    });
  },

  onShow() {
    this.startPolling();
  },

  onUnload() {
    this.stopPolling();
  },

  stopPolling() {
    if (pollTimer) {
      clearTimeout(pollTimer);
      pollTimer = null;
    }
  },

  async startPolling() {
    this.stopPolling();
    await this.pollOnce();
  },

  async pollOnce() {
    try {
      const result = await queryAnalysis(this.data.analysisId);
      if (result.status === "completed") {
        wx.redirectTo({
          url: `/pages/report/index?reportId=${encodeURIComponent(result.reportId)}`
        });
        return;
      }
      if (result.status === "failed") {
        wx.redirectTo({
          url: `/pages/failure/index?message=${encodeURIComponent(result.errorMsg || "检测失败")}`
        });
        return;
      }
      const nextProgress = Math.min(92, this.data.progress + 11);
      this.setData({
        progress: nextProgress,
        statusText: nextProgress > 55 ? "正在整理中医体质与调理建议" : "正在分析舌象、面容与体质信息"
      });
      pollTimer = setTimeout(() => this.pollOnce(), 3000);
    } catch (error) {
      wx.redirectTo({
        url: `/pages/failure/index?message=${encodeURIComponent(error.message || "检测失败")}`
      });
    }
  },

  cancelAndBack() {
    this.stopPolling();
    wx.switchTab({
      url: "/pages/capture/index"
    });
  }
});
