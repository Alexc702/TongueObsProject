const { compareReports } = require("../../utils/api");

Page({
  data: {
    loading: true,
    compare: null
  },

  onLoad(options) {
    this.leftId = options.leftId || "";
    this.rightId = options.rightId || "";
  },

  onShow() {
    this.loadCompare();
  },

  async loadCompare() {
    try {
      const result = await compareReports(this.leftId, this.rightId);
      this.setData({
        loading: false,
        compare: result
      });
    } catch (error) {
      wx.redirectTo({
        url: `/pages/failure/index?message=${encodeURIComponent(error.message || "报告对比失败")}`
      });
    }
  },

  goHistory() {
    wx.switchTab({
      url: "/pages/history/index"
    });
  }
});
