# 中医舌面检测微信小程序 PRD

## 1. 项目目标

基于现有录屏流程、报告截图和《中医面诊接口文档-v1.0.17.docx》，复刻一个微信小程序版“舌面检测/健康筛查”产品。用户可通过录制舌面视频完成检测，并查看结构化健康报告。

本 PRD 默认目标是先做 `P0 可上线版本`，优先保证：

- 录制/选择素材 -> 上传检测 -> 轮询结果 -> 展示完整报告
- 报告以模块化方式浏览，不做单页超长瀑布流
- 历史报告可沉淀，并支持前后两次结果对比
- 使用最简微信账号体系承载历史数据
- 功能链路与参考产品保持一致，但视觉设计不要求贴近参考截图
- 对接上游开放接口，但 `签名和密钥只放服务端`

## 2. 需求依据

- 录屏首屏已确认：`健康筛查视频录制`，含圆形取景框、光线提示、跟随提示、`相册选取`/`开始录制` 双 CTA
- 报告截图已确认模块顺序：免责声明、总评卡、总结、风险预警、体质分析、面容检测、舌象检测、食疗建议、运动建议、理疗建议、报告信息、下载报告
- Java 示例已确认上游为 `两阶段异步接口`
- 接口文档已确认：
  - 启动检测：`/smyx-open-api/open/health-analysis/v1/start-face-analysis`
  - 查询结果：`/smyx-open-api/open/health-analysis/v1/query-face-analysis-json`
  - 检测素材约束：`视频 <= 5MB`、`时长 >10s 且 <20s`、`帧率 >2fps`、`需同时包含人脸和舌头`

补充说明：

- 参考截图用于提取 `功能模块` 与 `信息结构`
- 视觉风格可重新定义，不要求沿用原产品的蓝白科技感
- 新版设计允许明显偏向 `中医养生`、`东方自然`、`温润可信`

## 3. 关键结论与开发前提

### 3.1 必须有服务端代理

不能在微信小程序里直接持有上游 `AccessKey/SecretKey`。必须提供一个自有服务端或云函数，负责：

- 微信登录态换取与用户绑定
- 生成签名
- 转发启动检测请求
- 轮询上游结果
- 持久化检测结果快照
- 统一错误码和页面展示文案
- 提供历史列表和对比数据
- 可选：生成“下载报告”长图/PDF

### 3.2 文档存在实现歧义，开发时按“可配置适配层”处理

- 文档文字写的是 `HMAC-SHA512`
- Java 示例实际用的是 `HmacSHA256`
- 查询接口 URL 示例末尾多了一个双引号
- 接口路径虽然叫 `face-analysis`，实际返回的是面容 + 舌象 + 体质结果

结论：后端适配层必须把以下内容做成可配置项，而不是写死：

- 签名算法
- 上游 host
- 接口 path
- 轮询频率和超时时间

### 3.3 “上传照片检测”当前不纳入 P0 硬承诺

用户口径提到“上传照片”，但提供的 v1.0.17 文档和 Java 示例仅明确支持 `视频文件 multipart 上传`。因此 P0 按如下处理：

- `相册选取` 默认支持选择 `视频`
- 是否支持选择 `静态图片`，列为 `待确认项`
- 若业务必须保留“上传照片”入口，需要供应商补充图片检测接口，或业务方自行定义图片转检测方案

### 3.4 “下载报告”需要自研

上游文档只返回 JSON 结果，没有直接返回报告 PDF/图片。P0 建议：

- 按报告页面 DOM 生成 `长图并保存到相册`
- 按产品文案仍显示 `下载报告`
- P1 再补服务端 `PDF 导出`

## 4. 版本范围

## 4.1 P0 范围

- 启动时静默微信登录
- 微信授权与摄像头/相册权限处理
- 首页录制页
- 10 到 20 秒视频录制，20 秒自动停止
- 从相册选择已有视频
- 上传检测
- 检测中页/进度态
- 轮询结果
- 报告页模块化展示
- 历史报告列表
- 双报告对比
- 报告长图下载
- 失败页和重试

## 4.2 P0 不做

- 完整个人中心
- 手机号绑定
- 医生咨询/付费
- 分享裂变
- 多语言
- 真正的图片检测，除非接口确认可用

## 4.3 P1 可扩展

- 报告 PDF 导出
- 分享卡片
- 图片检测
- 趋势图表与多时间点趋势分析

## 5. 用户与场景

### 5.1 目标用户

- 对中医体质、面诊、舌诊感兴趣的普通用户
- 有亚健康自查需求的人群

### 5.2 核心场景

1. 用户首次进入，查看免责声明并开始检测
2. 用户按提示录制一段舌面视频
3. 系统上传并分析，约 5 到 10 秒返回结果
4. 用户浏览完整报告并下载保存
5. 用户查看历史报告，并选取两份报告做前后变化对比

## 6. 页面与流程

## 6.1 主流程

1. 小程序启动后执行 `wx.login`
2. 后端 `code2session` 获取 `openid`，创建最简用户
3. 进入首页/录制页
4. 弹权限说明与免责声明
5. 用户选择 `开始录制` 或 `相册选取`
6. 客户端做基础校验
7. 调用自有后端 `startAnalysis`
8. 进入检测中页，轮询 `queryAnalysis`
9. 若成功，后端持久化报告快照并进入报告页
10. 用户浏览模块化报告，并执行 `下载报告`
11. 用户可进入历史列表，选择两份报告进行对比
12. 若失败，进入失败页并允许重试

## 6.2 页面清单

- `P0-00` 启动/静默登录态
- `P0-01` 首页/视频录制页
- `P0-02` 相册选择后校验态
- `P0-03` 上传中/检测中页
- `P0-04` 报告概览页
- `P0-05` 历史报告列表页
- `P0-06` 报告对比页
- `P0-07` 失败/异常页

## 7.0 账号体系

### 目标

以最低实现成本支持“历史报告沉淀”和“前后对比”，不做复杂账号中心。

### 方案

- 启动时调用 `wx.login`
- 后端通过 `code2session` 获取 `openid`
- 以 `openid` 作为最小用户主键
- 不强制用户授权头像昵称
- 若用户后续授权头像昵称，仅作为展示增强，不影响核心功能

### 交互要求

- 正常情况下不展示单独登录页，走静默登录
- 若静默登录失败，提示 `登录状态获取失败，请重试`
- 登录失败时：
  - 检测能力可按业务决定是否允许继续
  - `历史报告` 和 `报告对比` 必须禁用

### 验收标准

- 用户无感完成微信登录
- 单个微信用户的报告历史可稳定查询
- 同一用户跨设备登录后可看到自己的历史报告

## 7. 功能需求

## 7.1 首页/视频录制页

### 页面目标

引导用户完成合规录制，并降低因为姿势、光线、距离导致的检测失败率。

### 页面元素

- 顶部返回
- 页面标题：`健康筛查`
- 主标题：`健康筛查视频录制`
- 副文案：`视频生成报告后自动删除不保留`
- 居中圆形取景框，默认展示摄像头预览
- 实时提示项：
  - `光线充足`
  - `跟随提示`
- 底部双按钮：
  - `相册选取`
  - `开始录制`

### 交互要求

- 首次进入请求摄像头权限
- 默认后置摄像头；若产品更适合前置，可在技术评估后调整，但 UI 不变
- 点击 `开始录制` 后进入倒计时/录制态
- 录制时展示时长进度，20 秒自动停止
- 用户可在 10 秒后主动结束；小于等于 10 秒给出不可提交提示
- `相册选取` 仅允许选择视频文件
- 本地尽可能校验时长、大小；无法校验时交给服务端兜底

### 验收标准

- 用户 1 次点击可完成录制
- 无权限时有明确引导去系统设置
- 小于等于 10 秒、超过 20 秒、文件过大时均阻断提交

## 7.2 上传中/检测中页

### 页面目标

降低用户等待焦虑，明确当前状态不是卡死。

### 页面元素

- 上传中提示
- 检测中动画
- 状态文案示例：
  - `正在上传检测视频`
  - `正在分析舌象与面容信息`
  - `预计 5-10 秒生成报告`
- 取消返回按钮

### 交互要求

- 启动检测成功后，开始轮询
- 轮询间隔：默认 `5 秒`
- 轮询超时：默认 `60 秒`
- 若启动接口返回 `tips[]`，以非阻断 toast 或轻提示展示
- 若接口返回 `data = null`，保持检测中
- 若接口返回错误，跳失败页

## 7.3 报告概览页

### 页面结构

1. 顶部免责声明 banner
2. 顶部总评区
3. 历史与对比入口
4. 模块导航区
5. 当前模块内容区
6. 下载报告按钮

### 模块导航定义

- `总览`
- `面容`
- `舌象`
- `调理`

默认进入 `总览`，其余模块通过分段 tab、横向胶囊导航或二级卡片入口切换。禁止把所有内容默认一次性摊平在同一长页里。

### 具体要求

#### 免责声明 banner

- 固定文案：`本产品非医疗器械，提供信息仅供参考`

#### 顶部总评区

- 左侧展示主体质名称
- 右侧展示综合评分
- 展示时间、报告编号的轻量摘要
- 样式接近参考图：主体质胶囊标签 + 大号分数

#### 历史与对比入口

- 提供 `历史报告` 入口
- 提供 `与上一份对比` 快捷入口
- 若当前用户仅有 1 份报告，`与上一份对比` 置灰

#### 总览模块

- 展示整体总结文案
- 展示风险预警信号
- 展示体质分析摘要
- 展示关键变化提示，例如：
  - `本次较上次综合评分 +6`
  - `舌象异常项减少 1 项`

#### 总览模块字段

- 总结：`healthAssessment.summary`
- 风险预警：`healthAssessment.riskWarnings[]`
- 体质分析：
  - `主体质` = `healthAnalysis.subjectName`
  - `总体特征` = `healthAnalysis.subjectFeature`
  - `常见表现` = `healthAnalysis.subjectOutline`

#### 面容模块

- 显示摘要
- 分项展示：
  - 额头 = `faceAnalysis.complexion`
  - 鼻部 = `faceAnalysis.nose`
  - 面颊 = `faceAnalysis.shape`
  - 印堂 = `faceAnalysis.yinTang`
  - 口唇四周 = `faceAnalysis.lipColor`
  - 眼周 = `faceAnalysis.eyeState`
- 模块内支持展开/收起
- 顶部展示 `X 项异常表征`

#### 舌象模块

- 显示摘要
- 分项展示：
  - 舌色 = `tongueAnalysis.tongueColor`
  - 舌形 = `tongueAnalysis.tongueShape`
  - 苔质 = `tongueAnalysis.coatingTexture`
  - 苔色 = `tongueAnalysis.coatingColor`
- 每个分项展示：
  - 主描述
  - 关联表征 tag
- 模块内支持展开/收起
- 顶部展示 `X 项异常表征`

#### 调理模块

- 食疗建议：
  - 正向建议：`healthAnalysis.dietAccept`
  - 避免建议：`healthAnalysis.dietReject`
- 运动建议：
  - 正向建议：`healthAnalysis.exerciseAccept`
  - 避免建议：`healthAnalysis.exerciseReject`
- 理疗建议：
  - 选穴：`healthAnalysis.physicalPosition`
  - 穴位图：`healthAnalysis.physicalFigures`
  - 定位说明：`healthAnalysis.physicalSearch`
  - 操作方法：`healthAnalysis.physicalOperation`
- 报告信息：
  - 生成时间：优先用 `data.createTime`
  - 生成时间格式：`YYYY-MM-DD HH:mm:ss`
  - 报告编号：优先使用启动接口返回的 `analysisId`

#### 下载报告

- 点击后生成长图并保存到相册
- 保存成功后 toast 提示
- 保存失败需提示权限或重试

## 7.4 历史报告列表页

### 页面目标

让用户能够快速查看过往检测记录，并选择两份报告做前后对比。

### 页面元素

- 顶部标题：`历史报告`
- 时间倒序列表
- 每条记录卡片展示：
  - 检测日期时间
  - 主体质
  - 综合评分
  - 面容异常项数
  - 舌象异常项数
- 操作：
  - `查看报告`
  - `选择对比`

### 交互要求

- 默认按时间倒序
- 支持一次选择 `2` 份报告
- 选满两份后底部按钮变为 `开始对比`
- 若只有 1 份报告，显示空状态说明无法对比

## 7.5 报告对比页

### 页面目标

把用户最关心的“前后是否变好/变差”做成清晰、可快速理解的对比视图。

### 页面结构

1. 顶部双报告时间摘要
2. 核心指标对比卡
3. 模块化对比区域
4. 下载当前报告/查看原报告入口

### 核心指标

- 综合评分对比
- 主体质对比
- 风险预警数量对比
- 面容异常项数对比
- 舌象异常项数对比

### 模块化对比区域

- `总览变化`
- `面容变化`
- `舌象变化`
- `调理建议变化`

### 交互要求

- 默认左侧为较早报告，右侧为较新报告
- 数值变化需要明显显示 `+/-`
- 文案变化不做字符级 diff，按模块卡片并排展示

## 7.6 失败页

### 场景

- 视频质量不满足要求
- 上游分析失败
- 网络失败
- 轮询超时

### 页面元素

- 错误说明
- 建议操作
- `重新检测` 按钮
- `返回首页` 按钮

### 文案映射

- `VIDEO_POOR_QUALITY` -> `视频质量不满足要求，请确保视频时长 10-20 秒、画面清晰且同时包含人脸和舌头`
- `HEALTH_ANALYSIS_ERROR` -> `检测失败，请稍后重试`
- 其它 -> `网络异常，请稍后重试`

## 8. API 与技术方案

## 8.1 推荐系统结构

- 小程序前端：静默登录、页面、录制、展示、长图导出、历史与对比
- 自有后端/云函数：
  - `code2session` 换取 `openid`
  - 生成签名
  - 调上游启动接口
  - 调上游查询接口
  - 持久化报告快照
  - 查询历史列表
  - 生成对比数据
  - 统一数据结构
  - 记录日志
  - 可选生成 PDF

## 8.2 自有后端建议接口

### `POST /api/auth/wechat-login`

请求：

- `code`

响应：

- `userId`
- `openid`
- `sessionToken`

### `POST /api/health-analysis/start`

请求：

- `file`
- `sourceType`: `record` | `album`
- `userId`

响应：

- `analysisId`
- `tips[]`

### `POST /api/health-analysis/query`

请求：

- `analysisId`

响应：

- `status`: `processing` | `success` | `failed`
- `errorCode`
- `errorMessage`
- `report`

### `GET /api/reports`

响应：

- 历史报告列表

### `GET /api/reports/:reportId`

响应：

- 单份报告详情

### `POST /api/reports/compare`

请求：

- `leftReportId`
- `rightReportId`

响应：

- 核心对比指标
- 各模块原始数据
- 变化摘要

## 8.3 上游接口映射

| 自有后端字段 | 上游字段 | 说明 |
|---|---|---|
| `analysisId` | start.data.analysisId | 检测任务 ID |
| `status=processing` | query.success=true 且 data=null | 继续轮询 |
| `status=failed` | query.success=false | 失败 |
| `report` | query.data.faceAnalysisResponse | 报告原始数据主体 |

## 8.4 报告持久化模型

每次成功检测后，后端必须保存一份不可变报告快照，最少字段如下：

- `reportId`
- `userId`
- `analysisId`
- `createdAt`
- `subject`
- `score`
- `riskWarningCount`
- `faceAbnormalCount`
- `tongueAbnormalCount`
- `rawReportJson`

## 8.5 报告字段映射

| 页面模块 | 字段路径 | 展示规则 |
|---|---|---|
| 主体质 | `healthAssessment.subject` | 展示在总评卡左侧 |
| 综合评分 | `healthAssessment.score` | 展示在总评卡右侧 |
| 总结 | `healthAssessment.summary` | 纯文本 |
| 风险预警 | `healthAssessment.riskWarnings[]` | 列表 |
| 体质分析-主体质 | `healthAnalysis.subjectName` | 结果标签 |
| 体质分析-总体特征 | `healthAnalysis.subjectFeature` | 纯文本 |
| 体质分析-常见表现 | `healthAnalysis.subjectOutline` | 纯文本 |
| 面容检测摘要 | `faceAnalysis.summary` | 纯文本 |
| 额头 | `faceAnalysis.complexion[]` | description + manifestations |
| 鼻部 | `faceAnalysis.nose[]` | description + manifestations |
| 面颊 | `faceAnalysis.shape[]` | description + manifestations |
| 印堂 | `faceAnalysis.yinTang[]` | description + manifestations |
| 口唇四周 | `faceAnalysis.lipColor[]` | description + manifestations |
| 眼周 | `faceAnalysis.eyeState[]` | description + manifestations |
| 舌象摘要 | `tongueAnalysis.summary` | 纯文本 |
| 舌色 | `tongueAnalysis.tongueColor[]` | description + manifestations |
| 舌形 | `tongueAnalysis.tongueShape[]` | description + manifestations |
| 苔质 | `tongueAnalysis.coatingTexture[]` | description + manifestations |
| 苔色 | `tongueAnalysis.coatingColor[]` | description + manifestations |
| 食疗建议-宜 | `healthAnalysis.dietAccept` | 纯文本 |
| 食疗建议-忌 | `healthAnalysis.dietReject` | 纯文本 |
| 运动建议-宜 | `healthAnalysis.exerciseAccept` | 纯文本 |
| 运动建议-忌 | `healthAnalysis.exerciseReject` | 纯文本 |
| 理疗建议-选穴 | `healthAnalysis.physicalPosition` | 纯文本 |
| 理疗建议-图示 | `healthAnalysis.physicalFigures` | 图片 |
| 理疗建议-定位 | `healthAnalysis.physicalSearch` | 纯文本 |
| 理疗建议-操作 | `healthAnalysis.physicalOperation` | 纯文本 |

## 8.6 对比字段规则

对比页使用以下字段生成“前后变化”：

- `scoreDelta = 当前综合评分 - 对比综合评分`
- `riskWarningDelta = 当前风险数 - 对比风险数`
- `faceAbnormalDelta = 当前面容异常数 - 对比面容异常数`
- `tongueAbnormalDelta = 当前舌象异常数 - 对比舌象异常数`
- `subjectChanged = 当前主体质 != 对比主体质`

## 8.7 异常项统计规则

截图中 `面容检测` 和 `舌象检测` 顶部显示 `X 项异常表征`，但上游未直接给计数。P0 采用前端/后端统一规则：

- 若 `description` 包含 `正常`、`无明显异常`、`未见异常`、`尚可`，记为正常
- 其它记为异常
- 统计各分项第一条描述的异常数量

该规则必须写在代码注释和适配层中，后续如供应商补显式字段，直接替换。

## 8.8 暂不使用字段

上游样例里还有一组 `healthSuggestions` 字段：

- `healthSuggestions.diet[]`
- `healthSuggestions.exercise`
- `healthSuggestions.physicalTherapy`

这组字段与截图中的“食疗建议/运动建议/理疗建议”展示结构并不一致。P0 先不直接上屏，保留在原始响应里备用；报告页统一使用 `healthAnalysis.*` 这一组字段渲染。

## 9. 非功能要求

## 9.1 性能

- 首屏进入时间 < 2 秒
- 报告页首屏可见内容 < 1 秒
- 检测轮询总等待默认不超过 60 秒

## 9.2 安全与隐私

- 上游密钥只存服务端环境变量
- 用户报告按 `openid` 绑定
- 不在前端存储人脸/舌头原始视频
- 报告快照持久化存储，用于历史与对比
- 页面需展示“仅供参考”免责声明

## 9.3 兼容性

- 覆盖 iPhone 和主流安卓微信容器
- 适配安全区
- 长文案不溢出，不截断关键信息

## 10. 埋点建议

- 进入录制页
- 静默登录成功/失败
- 点击开始录制
- 点击相册选取
- 录制成功
- 上传成功
- 检测成功
- 检测失败
- 查看历史报告
- 选择两份报告对比
- 查看对比页
- 点击下载报告
- 下载成功/失败

## 11. 验收标准

- 用户可从首页完成一次成功检测并看到完整报告
- 报告以模块化结构浏览，不需在单页长滚动中查看全部内容
- 报告字段与上游 JSON 可一一对应
- 历史列表可展示当前微信用户的多份报告
- 可选两份报告进入对比页
- 失败场景有明确提示和重试路径
- 密钥不出现在前端代码仓库和小程序包中
- 下载报告至少支持保存长图

## 12. 待确认项

- 上游签名算法到底以 `SHA256` 还是 `SHA512` 为准
- `相册选取` 是否必须支持静态图片
- `analysisId` 与 `data.id` 哪个才是最终报告编号
- `physicalFigures` 是否一定返回可访问图片 URL
- 风险预警、舌象/面容异常项是否有官方计数口径
