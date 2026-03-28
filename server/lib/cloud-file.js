const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const config = require("../config");

function inferExtension(originalFileName, contentType) {
  const source = originalFileName || "";
  const dotIndex = source.lastIndexOf(".");
  if (dotIndex >= 0) {
    return source.slice(dotIndex);
  }
  if ((contentType || "").includes("quicktime")) {
    return ".mov";
  }
  if ((contentType || "").includes("mp4")) {
    return ".mp4";
  }
  return ".bin";
}

async function downloadTempUrlToFile({ tempUrl, originalFileName = "", mimeType = "", size = 0 }) {
  if (!tempUrl) {
    throw new Error("缺少云文件临时链接");
  }

  const response = await fetch(tempUrl);
  if (!response.ok) {
    throw new Error(`下载云文件失败: ${response.status}`);
  }

  const contentType = mimeType || response.headers.get("content-type") || "application/octet-stream";
  const buffer = Buffer.from(await response.arrayBuffer());
  const extension = inferExtension(originalFileName, contentType);
  const tempName = `cloud_${crypto.randomUUID().replace(/-/g, "")}${extension}`;
  const filePath = path.join(config.dataDir, "uploads", tempName);
  await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
  await fs.promises.writeFile(filePath, buffer);

  return {
    path: filePath,
    originalname: originalFileName || tempName,
    mimetype: contentType,
    size: size || buffer.length
  };
}

module.exports = {
  downloadTempUrlToFile
};
