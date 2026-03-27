Page({
  data: {
    message: "舌面检测失败，请稍后再试"
  },

  onLoad(options) {
    if (options.message) {
      this.setData({
        message: decodeURIComponent(options.message)
      });
    }
  },

  retry() {
    wx.switchTab({
      url: "/pages/capture/index"
    });
  },

  goHistory() {
    wx.switchTab({
      url: "/pages/history/index"
    });
  }
});
