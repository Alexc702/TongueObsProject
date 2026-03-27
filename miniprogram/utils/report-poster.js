function wrapText(ctx, text, x, y, maxWidth, lineHeight, maxLines) {
  if (!text) {
    return y;
  }

  let line = "";
  let lines = 0;
  for (let index = 0; index < text.length; index += 1) {
    const candidate = line + text[index];
    if (ctx.measureText(candidate).width > maxWidth && line) {
      ctx.fillText(line, x, y);
      y += lineHeight;
      lines += 1;
      line = text[index];
      if (maxLines && lines >= maxLines) {
        return y;
      }
    } else {
      line = candidate;
    }
  }

  if (!maxLines || lines < maxLines) {
    ctx.fillText(line, x, y);
    y += lineHeight;
  }
  return y;
}

function saveToAlbum(tempFilePath) {
  return new Promise((resolve, reject) => {
    wx.saveImageToPhotosAlbum({
      filePath: tempFilePath,
      success() {
        resolve();
      },
      fail(error) {
        reject(error);
      }
    });
  });
}

function openAlbumPermissionSetting() {
  return new Promise((resolve, reject) => {
    wx.showModal({
      title: "需要相册权限",
      content: "保存报告到系统相册前，请先允许小程序写入相册。",
      success(result) {
        if (!result.confirm) {
          reject(new Error("未开启相册权限"));
          return;
        }
        wx.openSetting({
          success(settingResult) {
            if (settingResult.authSetting && settingResult.authSetting["scope.writePhotosAlbum"]) {
              resolve();
              return;
            }
            reject(new Error("未开启相册权限"));
          },
          fail() {
            reject(new Error("打开设置失败"));
          }
        });
      },
      fail() {
        reject(new Error("打开设置失败"));
      }
    });
  });
}

async function saveToAlbumWithPermission(tempFilePath) {
  try {
    await saveToAlbum(tempFilePath);
  } catch (error) {
    const message = (error && error.errMsg) || error.message || "";
    if (!/auth deny|authorize no response|auth denied/i.test(message)) {
      throw error;
    }
    await openAlbumPermissionSetting();
    await saveToAlbum(tempFilePath);
  }
}

async function generateReportPoster(page, report) {
  const nodeResult = await new Promise((resolve) => {
    wx.createSelectorQuery()
      .in(page)
      .select("#reportPosterCanvas")
      .fields({ node: true, size: true })
      .exec((result) => resolve(result[0]));
  });

  if (!nodeResult || !nodeResult.node) {
    throw new Error("未找到用于生成报告的画布");
  }

  const { node: canvas } = nodeResult;
  const ctx = canvas.getContext("2d");
  const systemInfo = wx.getSystemInfoSync();
  const dpr = systemInfo.pixelRatio || 2;
  const width = 320;
  const height = 560;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  ctx.scale(dpr, dpr);

  ctx.fillStyle = "#FAF8F4";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "#FFFDF8";
  ctx.beginPath();
  ctx.roundRect(14, 14, width - 28, height - 28, 18);
  ctx.fill();

  ctx.fillStyle = "#A66A2C";
  ctx.font = "12px sans-serif";
  ctx.fillText("中医舌面健康报告", 28, 40);

  ctx.fillStyle = "#2F2A24";
  ctx.font = "bold 24px sans-serif";
  ctx.fillText(report.subject.primary || "--", 28, 82);
  ctx.fillStyle = "#6E8B3D";
  ctx.font = "bold 28px sans-serif";
  ctx.fillText(`${report.subject.score || 0}分`, width - 108, 82);

  ctx.fillStyle = "#7A6F62";
  ctx.font = "12px sans-serif";
  ctx.fillText(`生成时间 ${report.generatedAt}`, 28, 108);
  ctx.fillText(`报告编号 ${report.reportNo}`, 28, 128);

  ctx.fillStyle = "#F3EBDD";
  ctx.beginPath();
  ctx.roundRect(28, 150, width - 56, 92, 16);
  ctx.fill();

  ctx.fillStyle = "#2F2A24";
  ctx.font = "bold 14px sans-serif";
  ctx.fillText("总结", 42, 174);
  ctx.font = "12px sans-serif";
  let cursorY = wrapText(ctx, report.summary || "", 42, 196, width - 84, 18, 3);

  ctx.fillStyle = "#FFF7F4";
  ctx.beginPath();
  ctx.roundRect(28, 260, width - 56, 120, 16);
  ctx.fill();

  ctx.fillStyle = "#C75B4E";
  ctx.font = "bold 14px sans-serif";
  ctx.fillText("风险提示", 42, 284);
  ctx.fillStyle = "#7A6F62";
  ctx.font = "12px sans-serif";
  const warningText = (report.overview.riskWarnings || []).slice(0, 2).join(" ");
  cursorY = wrapText(ctx, warningText, 42, 306, width - 84, 18, 4);

  ctx.fillStyle = "#EEF3E3";
  ctx.beginPath();
  ctx.roundRect(28, 398, width - 56, 108, 16);
  ctx.fill();

  ctx.fillStyle = "#6E8B3D";
  ctx.font = "bold 14px sans-serif";
  ctx.fillText("调理重点", 42, 422);
  ctx.fillStyle = "#2F2A24";
  ctx.font = "12px sans-serif";
  wrapText(
    ctx,
    report.suggestions.exercise.suggestion || report.suggestions.exercise.accept || "",
    42,
    444,
    width - 84,
    18,
    3
  );

  return new Promise((resolve, reject) => {
    wx.canvasToTempFilePath(
      {
        canvas,
        x: 0,
        y: 0,
        width,
        height,
        destWidth: width * dpr,
        destHeight: height * dpr,
        success: async (result) => {
          try {
            await saveToAlbumWithPermission(result.tempFilePath);
            resolve(result.tempFilePath);
          } catch (error) {
            reject(error);
          }
        },
        fail: reject
      },
      page
    );
  });
}

module.exports = {
  generateReportPoster
};
