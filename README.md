# TongueObsProject

原生微信小程序 + Node 代理服务，用于完成中医舌面检测、历史沉淀和报告对比。

## 目录

- `miniprogram/`: 原生微信小程序代码
- `server/`: 本地代理服务，负责微信登录、上游签名、报告存储、历史与对比
- `scripts/test_miniprogram_server.js`: 真实视频端到端回归脚本
- `docs/`: PRD、设计需求与 Pencil 设计稿

## 本地启动

1. 安装依赖

```bash
npm install
```

2. 启动代理服务

```bash
HEALTH_ACCESS_KEY=你的Key \
HEALTH_ACCESS_SECRET=你的Secret \
DEV_OPEN_ID=dev_open_id_lulu \
node server/index.js
```

3. 微信开发者工具打开项目根目录

- 使用根目录下的 `project.config.json`
- 小程序根目录已经配置为 `miniprogram/`
- 本地开发默认请求地址在 [miniprogram/config.js](/Users/lulu/Codex/TongueObsProject/miniprogram/config.js)

## 真机与开发说明

- 当前 `miniprogram/config.js` 默认走 `http://127.0.0.1:3100/api`
- 微信开发者工具本地调试可直接使用
- 真机调试时需要把 `127.0.0.1` 改为电脑局域网 IP，并在微信后台配置业务域名或通过开发者工具放开校验
- 若配置了 `WECHAT_APPID` 与 `WECHAT_APPSECRET`，服务端会真实执行 `code2session`
- 若未配置，小程序仍可在开发模式下通过 `DEV_OPEN_ID` 完成静默登录和历史沉淀

## 真实视频回归

脚本默认使用：

- `/Users/lulu/Codex/舌苔视频/IMG_3036_480.mov`

执行方式：

```bash
node scripts/test_miniprogram_server.js
```

输出结果默认写入：

- `artifacts/miniprogram-server-test/`

其中包含：

- `login_response.json`
- `start_response.json`
- `poll_records.json`
- `final_query_response.json`
- `history_response.json`
- `compare_response.json`
- `summary.json`

## 当前实现范围

- 静默微信登录
- 视频录制与相册选取
- 上传检测与轮询
- 模块化报告展示
- 历史报告列表
- 双报告对比
- 报告海报保存到相册
- 真实上游接口适配与本地持久化
