#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const http = require("http");

async function parseJson(response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch (error) {
    return { nonJson: true, text };
  }
}

function startStaticFileServer({ filePath, port }) {
  const fileName = path.basename(filePath);
  const server = http.createServer((req, res) => {
    if (req.url !== `/${fileName}`) {
      res.statusCode = 404;
      res.end("not found");
      return;
    }
    res.setHeader("Content-Type", "video/quicktime");
    fs.createReadStream(filePath).pipe(res);
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => {
      resolve({
        server,
        url: `http://127.0.0.1:${port}/${fileName}`
      });
    });
  });
}

async function main() {
  const baseUrl = process.env.TEST_SERVER_BASE_URL || "http://127.0.0.1:3100";
  const videoPath =
    process.env.TEST_VIDEO_PATH ||
    "/Users/lulu/Codex/舌苔视频/IMG_3036_480.mov";
  const staticPort = Number(process.env.TEST_STATIC_PORT || 3930);
  const outputDir =
    process.env.TEST_OUTPUT_DIR ||
    path.join(process.cwd(), "artifacts", "callcontainer-mvp-test");
  fs.mkdirSync(outputDir, { recursive: true });

  const staticHost = await startStaticFileServer({ filePath: videoPath, port: staticPort });

  try {
    const loginResponse = await fetch(`${baseUrl}/api/auth/wechat-login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: "" })
    });
    const loginPayload = await parseJson(loginResponse);
    fs.writeFileSync(
      path.join(outputDir, "login_response.json"),
      JSON.stringify(loginPayload, null, 2),
      "utf-8"
    );
    if (!loginPayload.success) {
      throw new Error(`登录失败: ${JSON.stringify(loginPayload)}`);
    }
    const token = loginPayload.data.token;

    const startResponse = await fetch(`${baseUrl}/api/analysis/start-cloud`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        fileId: "cloud://mvp-test/IMG_3036_480.mov",
        tempUrl: staticHost.url,
        durationSeconds: 18,
        sourceType: "album",
        originalFileName: path.basename(videoPath),
        size: fs.statSync(videoPath).size,
        mimeType: "video/quicktime"
      })
    });
    const startPayload = await parseJson(startResponse);
    fs.writeFileSync(
      path.join(outputDir, "start_response.json"),
      JSON.stringify(startPayload, null, 2),
      "utf-8"
    );
    if (!startPayload.success) {
      throw new Error(`启动检测失败: ${JSON.stringify(startPayload)}`);
    }

    const analysisId = startPayload.data.analysisId;
    let finalQueryPayload = null;
    const pollRecords = [];
    for (let index = 0; index < 12; index += 1) {
      const queryResponse = await fetch(`${baseUrl}/api/analysis/${analysisId}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      const queryPayload = await parseJson(queryResponse);
      pollRecords.push(queryPayload);
      fs.writeFileSync(
        path.join(outputDir, "poll_records.json"),
        JSON.stringify(pollRecords, null, 2),
        "utf-8"
      );
      if (queryPayload.success && queryPayload.data && queryPayload.data.status === "completed") {
        finalQueryPayload = queryPayload;
        break;
      }
      if (queryPayload.success && queryPayload.data && queryPayload.data.status === "failed") {
        throw new Error(`检测失败: ${JSON.stringify(queryPayload)}`);
      }
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }

    if (!finalQueryPayload) {
      throw new Error("检测轮询超时，未得到完成结果");
    }

    fs.writeFileSync(
      path.join(outputDir, "final_query_response.json"),
      JSON.stringify(finalQueryPayload, null, 2),
      "utf-8"
    );

    const reportId = finalQueryPayload.data.reportId;
    const historyResponse = await fetch(`${baseUrl}/api/reports/history`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    const historyPayload = await parseJson(historyResponse);
    fs.writeFileSync(
      path.join(outputDir, "history_response.json"),
      JSON.stringify(historyPayload, null, 2),
      "utf-8"
    );
    if (!historyPayload.success) {
      throw new Error(`历史报告查询失败: ${JSON.stringify(historyPayload)}`);
    }

    const reports = historyPayload.data.reports;
    const summary = {
      mode: "start-cloud",
      analysisId,
      reportId,
      reportCount: reports.length,
      currentReport: reports.find((item) => item.id === reportId) || null
    };
    fs.writeFileSync(path.join(outputDir, "summary.json"), JSON.stringify(summary, null, 2), "utf-8");
    console.log(JSON.stringify(summary, null, 2));
  } finally {
    await new Promise((resolve) => staticHost.server.close(resolve));
  }
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
