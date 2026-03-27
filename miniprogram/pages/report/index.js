const { getReport, listReports } = require("../../utils/api");
const { generateReportPoster } = require("../../utils/report-poster");
const {
  syncPrivacyState,
  ensurePrivacyAuthorized,
  markPrivacyAuthorized,
  openPrivacyContract,
  DEFAULT_CONTRACT_NAME
} = require("../../utils/privacy");

Page({
  data: {
    loading: true,
    reportId: "",
    report: null,
    activeTab: "overview",
    previousReportId: "",
    privacyNeedAuthorization: false,
    privacyContractName: DEFAULT_CONTRACT_NAME
  },

  onLoad(options) {
    this.setData({
      reportId: options.reportId || ""
    });
  },

  onShow() {
    this.refreshPrivacyState();
    this.loadData();
  },

  async refreshPrivacyState() {
    await syncPrivacyState(this);
  },

  async loadData() {
    this.setData({ loading: true });
    try {
      const result = await getReport(this.data.reportId);
      const history = await listReports();
      const previous = history.reports.find((item) => item.id !== this.data.reportId);
      this.setData({
        loading: false,
        report: result.report,
        previousReportId: previous ? previous.id : ""
      });
    } catch (error) {
      wx.redirectTo({
        url: `/pages/failure/index?message=${encodeURIComponent(error.message || "报告加载失败")}`
      });
    }
  },

  switchTab(event) {
    this.setData({
      activeTab: event.currentTarget.dataset.tab
    });
  },

  goHistory() {
    wx.switchTab({
      url: "/pages/history/index"
    });
  },

  goCompareWithPrevious() {
    if (!this.data.previousReportId) {
      wx.showToast({
        title: "暂无可对比的历史报告",
        icon: "none"
      });
      return;
    }
    wx.navigateTo({
      url: `/pages/compare/index?leftId=${encodeURIComponent(this.data.previousReportId)}&rightId=${encodeURIComponent(
        this.data.reportId
      )}`
    });
  },

  async savePoster() {
    const privacyAuthorized = await ensurePrivacyAuthorized(this);
    if (!privacyAuthorized) {
      wx.showToast({
        title: "请先同意隐私指引",
        icon: "none"
      });
      return;
    }
    try {
      wx.showLoading({
        title: "生成中",
        mask: true
      });
      await generateReportPoster(this, this.data.report);
      wx.hideLoading();
      wx.showToast({
        title: "已保存到相册",
        icon: "success"
      });
    } catch (error) {
      wx.hideLoading();
      wx.showToast({
        title: error.message || "保存失败",
        icon: "none"
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
    await this.refreshPrivacyState();
  }
});
