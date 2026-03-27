const DEFAULT_CONTRACT_NAME = "《用户隐私保护指引》";

function getAppGlobalData() {
  try {
    const app = getApp();
    return app && app.globalData ? app.globalData : null;
  } catch (error) {
    return null;
  }
}

function getPrivacySetting() {
  return new Promise((resolve) => {
    if (typeof wx.getPrivacySetting !== "function") {
      resolve({
        needAuthorization: false,
        privacyContractName: DEFAULT_CONTRACT_NAME,
        supported: false
      });
      return;
    }

    wx.getPrivacySetting({
      success(result) {
        resolve({
          needAuthorization: Boolean(result.needAuthorization),
          privacyContractName: result.privacyContractName || DEFAULT_CONTRACT_NAME,
          supported: true
        });
      },
      fail() {
        resolve({
          needAuthorization: false,
          privacyContractName: DEFAULT_CONTRACT_NAME,
          supported: false
        });
      }
    });
  });
}

async function syncPrivacyState(page) {
  const state = await getPrivacySetting();
  const globalData = getAppGlobalData();
  if (globalData) {
    globalData.privacyAuthorized = !state.needAuthorization;
    globalData.privacyContractName = state.privacyContractName;
  }

  if (page && typeof page.setData === "function") {
    page.setData({
      privacyNeedAuthorization: state.needAuthorization,
      privacyContractName: state.privacyContractName
    });
  }

  return state;
}

function markPrivacyAuthorized(page) {
  const globalData = getAppGlobalData();
  if (globalData) {
    globalData.privacyAuthorized = true;
  }
  if (page && typeof page.setData === "function") {
    page.setData({
      privacyNeedAuthorization: false
    });
  }
}

function openPrivacyContract() {
  return new Promise((resolve, reject) => {
    if (typeof wx.openPrivacyContract !== "function") {
      reject(new Error("当前微信版本不支持打开隐私指引"));
      return;
    }

    wx.openPrivacyContract({
      success: resolve,
      fail: reject
    });
  });
}

async function ensurePrivacyAuthorized(page) {
  const state = await syncPrivacyState(page);
  return !state.needAuthorization;
}

module.exports = {
  getPrivacySetting,
  syncPrivacyState,
  markPrivacyAuthorized,
  openPrivacyContract,
  ensurePrivacyAuthorized,
  DEFAULT_CONTRACT_NAME
};
