const { ensureLogin } = require("../../utils/auth");
const { listReports } = require("../../utils/api");

Page({
  data: {
    loading: true,
    reports: [],
    selectedIds: [],
    selectedIdsMap: {}
  },

  onShow() {
    this.loadReports();
  },

  async loadReports() {
    this.setData({ loading: true });
    try {
      await ensureLogin();
      const result = await listReports();
      this.setData({
        loading: false,
        reports: result.reports || []
      });
    } catch (error) {
      this.setData({ loading: false });
      wx.showToast({
        title: error.message || "加载失败",
        icon: "none"
      });
    }
  },

  goCapture() {
    wx.switchTab({
      url: "/pages/capture/index"
    });
  },

  viewReport(event) {
    const reportId = event.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/report/index?reportId=${encodeURIComponent(reportId)}`
    });
  },

  toggleCompareSelect(event) {
    const reportId = event.currentTarget.dataset.id;
    const selected = [...this.data.selectedIds];
    const index = selected.indexOf(reportId);
    if (index >= 0) {
      selected.splice(index, 1);
    } else {
      if (selected.length >= 2) {
        selected.shift();
      }
      selected.push(reportId);
    }
    const selectedIdsMap = {};
    selected.forEach((item) => {
      selectedIdsMap[item] = true;
    });
    this.setData({
      selectedIds: selected,
      selectedIdsMap
    });
  },

  startCompare() {
    if (this.data.selectedIds.length !== 2) {
      wx.showToast({
        title: "请选择两份报告",
        icon: "none"
      });
      return;
    }
    wx.navigateTo({
      url: `/pages/compare/index?leftId=${encodeURIComponent(this.data.selectedIds[0])}&rightId=${encodeURIComponent(
        this.data.selectedIds[1]
      )}`
    });
  }
});
