const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const config = require("./config");
const { resolveOpenId } = require("./lib/wechat");
const { createSessionToken, parseSessionToken } = require("./lib/session");
const { startFaceAnalysis, queryFaceAnalysis } = require("./lib/health-api");
const { mapReportPayload } = require("./lib/report-mapper");
const { buildComparePayload } = require("./lib/compare");
const { downloadTempUrlToFile } = require("./lib/cloud-file");
const {
  initStore,
  upsertUserByOpenId,
  createAnalysis,
  getAnalysisById,
  updateAnalysis,
  createReport,
  getReportById,
  listReportsByUser
} = require("./lib/store");

fs.mkdirSync(config.dataDir, { recursive: true });
const upload = multer({ dest: path.join(config.dataDir, "uploads") });

const app = express();
app.use(express.json({ limit: "2mb" }));

async function removeTempFile(filePath) {
  if (!filePath) {
    return;
  }
  try {
    await fs.promises.unlink(filePath);
  } catch (error) {
    // Ignore cleanup errors for temp uploads.
  }
}

function authMiddleware(req, res, next) {
  const raw = req.headers.authorization || req.headers["x-session-token"] || "";
  const token = raw.startsWith("Bearer ") ? raw.slice(7) : raw;
  const session = parseSessionToken(token);
  if (!session) {
    res.status(401).json({ success: false, errorCode: "UNAUTHORIZED", errorMsg: "登录态无效" });
    return;
  }
  req.session = session;
  next();
}

function trimReportCard(report) {
  return {
    id: report.id,
    analysisId: report.analysisId,
    generatedAt: report.result.generatedAt,
    reportNo: report.result.reportNo,
    subject: report.result.subject.primary,
    score: report.result.subject.score,
    summary: report.result.summary
  };
}

async function startAnalysisFromFile({
  userId,
  file,
  durationSeconds,
  sourceType,
  cloudMeta = {}
}) {
  const upstreamPayload = await startFaceAnalysis(file);
  if (!upstreamPayload.success || !upstreamPayload.data || !upstreamPayload.data.analysisId) {
    const error = new Error(upstreamPayload.errorMsg || "启动检测失败");
    error.statusCode = 502;
    error.errorCode = upstreamPayload.errorCode || "UPSTREAM_START_FAILED";
    error.upstreamPayload = upstreamPayload;
    throw error;
  }

  const analysis = await createAnalysis({
    userId,
    upstreamAnalysisId: String(upstreamPayload.data.analysisId),
    status: "processing",
    sourceType: sourceType || "upload",
    originalFileName: file.originalname,
    videoMeta: {
      size: file.size,
      mimetype: file.mimetype,
      durationSeconds,
      ...cloudMeta
    }
  });

  return analysis;
}

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    data: {
      status: "ok",
      signatureAlgorithm: config.healthSignatureAlgorithm,
      hasHealthCredentials: Boolean(config.healthAccessKey && config.healthAccessSecret),
      hasWechatCredentials: Boolean(config.wechatAppId && config.wechatAppSecret)
    }
  });
});

app.post("/api/auth/wechat-login", async (req, res) => {
  try {
    const { code = "" } = req.body || {};
    const result = await resolveOpenId(code);
    const user = await upsertUserByOpenId(result.openId);
    const token = createSessionToken(user);
    res.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          openId: user.openId
        },
        devMode: result.devMode
      }
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      errorCode: "WECHAT_LOGIN_FAILED",
      errorMsg: error.message
    });
  }
});

app.post("/api/analysis/start", authMiddleware, upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ success: false, errorCode: "MISSING_FILE", errorMsg: "请上传视频文件" });
      return;
    }
    const durationSeconds = Number(req.body.durationSeconds || 0);
    if (durationSeconds && (durationSeconds <= 10 || durationSeconds > 20)) {
      res.status(400).json({
        success: false,
        errorCode: "INVALID_DURATION",
        errorMsg: "视频时长需大于10秒且不超过20秒"
      });
      return;
    }

    const analysis = await startAnalysisFromFile({
      userId: req.session.userId,
      file: req.file,
      durationSeconds,
      sourceType: req.body.sourceType || "upload"
    });

    res.json({
      success: true,
      data: {
        analysisId: analysis.id,
        upstreamAnalysisId: analysis.upstreamAnalysisId,
        status: analysis.status
      }
    });
  } catch (error) {
    console.error("start analysis failed", {
      message: error.message,
      stack: error.stack,
      file: req.file
        ? {
            path: req.file.path,
            size: req.file.size,
            mimetype: req.file.mimetype,
            originalname: req.file.originalname
          }
        : null
    });
    if (error.statusCode === 502) {
      res.status(502).json({
        success: false,
        errorCode: error.errorCode,
        errorMsg: error.message,
        upstreamPayload: error.upstreamPayload
      });
      return;
    }
    res.status(500).json({
      success: false,
      errorCode: "START_ANALYSIS_FAILED",
      errorMsg: error.message
    });
  } finally {
    await removeTempFile(req.file && req.file.path);
  }
});

app.post("/api/analysis/start-cloud", authMiddleware, async (req, res) => {
  let tempFile = null;
  try {
    const {
      fileId = "",
      tempUrl = "",
      durationSeconds = 0,
      sourceType = "album",
      originalFileName = "tongue-video.mov",
      size = 0,
      mimeType = "video/quicktime"
    } = req.body || {};

    if (!fileId || !tempUrl) {
      res.status(400).json({
        success: false,
        errorCode: "MISSING_CLOUD_FILE",
        errorMsg: "缺少云文件信息"
      });
      return;
    }

    const durationValue = Number(durationSeconds || 0);
    if (durationValue && (durationValue <= 10 || durationValue > 20)) {
      res.status(400).json({
        success: false,
        errorCode: "INVALID_DURATION",
        errorMsg: "视频时长需大于10秒且不超过20秒"
      });
      return;
    }

    tempFile = await downloadTempUrlToFile({
      tempUrl,
      originalFileName,
      mimeType,
      size: Number(size || 0)
    });

    const analysis = await startAnalysisFromFile({
      userId: req.session.userId,
      file: tempFile,
      durationSeconds: durationValue,
      sourceType,
      cloudMeta: {
        fileId,
        tempUrl
      }
    });

    res.json({
      success: true,
      data: {
        analysisId: analysis.id,
        upstreamAnalysisId: analysis.upstreamAnalysisId,
        status: analysis.status
      }
    });
  } catch (error) {
    console.error("start cloud analysis failed", {
      message: error.message,
      stack: error.stack,
      body: req.body || null
    });
    if (error.statusCode === 502) {
      res.status(502).json({
        success: false,
        errorCode: error.errorCode,
        errorMsg: error.message,
        upstreamPayload: error.upstreamPayload
      });
      return;
    }
    res.status(500).json({
      success: false,
      errorCode: "START_CLOUD_ANALYSIS_FAILED",
      errorMsg: error.message
    });
  } finally {
    await removeTempFile(tempFile && tempFile.path);
  }
});

app.get("/api/analysis/:analysisId", authMiddleware, async (req, res) => {
  try {
    const analysis = await getAnalysisById(req.params.analysisId);
    if (!analysis || analysis.userId !== req.session.userId) {
      res.status(404).json({ success: false, errorCode: "ANALYSIS_NOT_FOUND", errorMsg: "检测记录不存在" });
      return;
    }

    if (analysis.status === "completed" && analysis.reportId) {
      const report = await getReportById(analysis.reportId);
      res.json({
        success: true,
        data: {
          status: "completed",
          analysisId: analysis.id,
          reportId: report.id,
          report: report.result
        }
      });
      return;
    }

    if (analysis.status === "failed") {
      res.json({
        success: true,
        data: {
          status: "failed",
          analysisId: analysis.id,
          errorCode: analysis.errorCode || "HEALTH_ANALYSIS_FAILED",
          errorMsg: analysis.errorMsg || "舌面检测失败"
        }
      });
      return;
    }

    const upstreamPayload = await queryFaceAnalysis(analysis.upstreamAnalysisId);
    if (!upstreamPayload.success) {
      await updateAnalysis(analysis.id, {
        status: "failed",
        errorCode: upstreamPayload.errorCode || "UPSTREAM_QUERY_FAILED",
        errorMsg: upstreamPayload.errorMsg || "检测失败"
      });
      res.json({
        success: true,
        data: {
          status: "failed",
          analysisId: analysis.id,
          errorCode: upstreamPayload.errorCode || "UPSTREAM_QUERY_FAILED",
          errorMsg: upstreamPayload.errorMsg || "检测失败"
        }
      });
      return;
    }

    if (!upstreamPayload.data) {
      res.json({
        success: true,
        data: {
          status: "processing",
          analysisId: analysis.id,
          upstreamAnalysisId: analysis.upstreamAnalysisId
        }
      });
      return;
    }

    const mappedReport = mapReportPayload(upstreamPayload);
    const report = await createReport({
      userId: analysis.userId,
      analysisId: analysis.id,
      upstreamAnalysisId: analysis.upstreamAnalysisId,
      result: mappedReport
    });
    await updateAnalysis(analysis.id, {
      status: "completed",
      reportId: report.id
    });

    res.json({
      success: true,
      data: {
        status: "completed",
        analysisId: analysis.id,
        reportId: report.id,
        report: report.result
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      errorCode: "QUERY_ANALYSIS_FAILED",
      errorMsg: error.message
    });
  }
});

app.get("/api/reports/history", authMiddleware, async (req, res) => {
  try {
    const reports = (await listReportsByUser(req.session.userId)).map(trimReportCard);
    res.json({
      success: true,
      data: {
        reports
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      errorCode: "REPORT_HISTORY_FAILED",
      errorMsg: error.message
    });
  }
});

app.get("/api/reports/compare", authMiddleware, async (req, res) => {
  try {
    const left = await getReportById(req.query.leftId);
    const right = await getReportById(req.query.rightId);
    if (!left || !right || left.userId !== req.session.userId || right.userId !== req.session.userId) {
      res.status(404).json({
        success: false,
        errorCode: "REPORT_COMPARE_NOT_FOUND",
        errorMsg: "待对比报告不存在"
      });
      return;
    }
    res.json({
      success: true,
      data: buildComparePayload(left, right)
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      errorCode: "REPORT_COMPARE_FAILED",
      errorMsg: error.message
    });
  }
});

app.get("/api/reports/:reportId", authMiddleware, async (req, res) => {
  try {
    const report = await getReportById(req.params.reportId);
    if (!report || report.userId !== req.session.userId) {
      res.status(404).json({ success: false, errorCode: "REPORT_NOT_FOUND", errorMsg: "报告不存在" });
      return;
    }
    res.json({
      success: true,
      data: {
        reportId: report.id,
        report: report.result
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      errorCode: "REPORT_FETCH_FAILED",
      errorMsg: error.message
    });
  }
});

app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    res.status(400).json({ success: false, errorCode: "UPLOAD_FAILED", errorMsg: error.message });
    return;
  }
  next(error);
});

async function bootstrap() {
  await initStore();
  app.listen(config.port, () => {
    console.log(`TongueObs server listening on http://127.0.0.1:${config.port}`);
  });
}

bootstrap().catch((error) => {
  console.error("Failed to start TongueObs server", error);
  process.exit(1);
});
