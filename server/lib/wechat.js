const crypto = require("crypto");
const config = require("../config");

async function resolveOpenId(code) {
  if (config.wechatAppId && config.wechatAppSecret && code) {
    const params = new URLSearchParams({
      appid: config.wechatAppId,
      secret: config.wechatAppSecret,
      js_code: code,
      grant_type: "authorization_code"
    });
    const response = await fetch(`https://api.weixin.qq.com/sns/jscode2session?${params.toString()}`);
    const payload = await response.json();
    if (!payload.openid) {
      throw new Error(payload.errmsg || "微信登录失败");
    }
    return {
      openId: payload.openid,
      sessionKey: payload.session_key || "",
      unionId: payload.unionid || "",
      devMode: false
    };
  }

  const stableSeed = code || config.devOpenId;
  const hash = crypto.createHash("sha256").update(stableSeed).digest("hex").slice(0, 16);
  return {
    openId: `${config.devOpenId}_${hash}`,
    sessionKey: "",
    unionId: "",
    devMode: true
  };
}

module.exports = {
  resolveOpenId
};
