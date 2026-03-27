function mapList(items, mapper) {
  return Array.isArray(items) ? items.map(mapper).filter(Boolean) : [];
}

function firstDescription(items) {
  return Array.isArray(items) && items[0] ? items[0].description || "" : "";
}

function firstManifestations(items) {
  return Array.isArray(items) && items[0] && Array.isArray(items[0].manifestations)
    ? items[0].manifestations
    : [];
}

function buildConstitutionBreakdown(healthAssessment) {
  const results = [];
  for (let index = 1; index <= 9; index += 1) {
    const subject = healthAssessment[`subject${index}`];
    const score = healthAssessment[`score${index}`];
    if (subject && typeof score === "number") {
      results.push({ name: subject, score });
    }
  }
  return results.sort((left, right) => right.score - left.score);
}

function mapFaceItems(faceAnalysis) {
  return [
    { key: "complexion", title: "额头", description: firstDescription(faceAnalysis.complexion), abnormal: false },
    { key: "nose", title: "鼻部", description: firstDescription(faceAnalysis.nose), abnormal: false },
    { key: "shape", title: "面颊", description: firstDescription(faceAnalysis.shape), abnormal: false },
    { key: "yinTang", title: "印堂", description: firstDescription(faceAnalysis.yinTang), abnormal: false },
    { key: "lipColor", title: "口唇四周", description: firstDescription(faceAnalysis.lipColor), abnormal: false },
    { key: "eyeState", title: "眼周", description: firstDescription(faceAnalysis.eyeState), abnormal: false }
  ].filter((item) => item.description);
}

function mapTongueItems(tongueAnalysis) {
  const manifestations = firstManifestations(tongueAnalysis.tongueShape);
  return {
    items: [
      {
        key: "tongueColor",
        title: "舌色",
        description: firstDescription(tongueAnalysis.tongueColor),
        abnormal: false
      },
      {
        key: "tongueShape",
        title: "舌形",
        description: firstDescription(tongueAnalysis.tongueShape),
        abnormal: manifestations.length > 0
      },
      {
        key: "coatingTexture",
        title: "苔质",
        description: firstDescription(tongueAnalysis.coatingTexture),
        abnormal: false
      },
      {
        key: "coatingColor",
        title: "苔色",
        description: firstDescription(tongueAnalysis.coatingColor),
        abnormal: false
      }
    ].filter((item) => item.description),
    manifestations
  };
}

function mapReportPayload(upstreamPayload) {
  const root = upstreamPayload.data || {};
  const faceAnalysisResponse = root.faceAnalysisResponse || {};
  const healthAssessment = faceAnalysisResponse.healthAssessment || {};
  const healthSuggestions = faceAnalysisResponse.healthSuggestions || {};
  const healthAnalysis = faceAnalysisResponse.healthAnalysis || {};
  const faceAnalysis = faceAnalysisResponse.faceAnalysis || {};
  const tongueAnalysis = faceAnalysisResponse.tongueAnalysis || {};

  const faceItems = mapFaceItems(faceAnalysis);
  const tongueMapped = mapTongueItems(tongueAnalysis);

  return {
    generatedAt: root.createTimeString || new Date().toISOString(),
    reportNo: root.id || "",
    disclaimer: "本产品非医疗器械，提供信息仅供参考",
    profile: {
      sex: healthAssessment.sex || "",
      age: healthAssessment.age || ""
    },
    summary: healthAssessment.summary || "",
    subject: {
      primary: healthAssessment.subject || "",
      score: healthAssessment.score || 0,
      breakdown: buildConstitutionBreakdown(healthAssessment)
    },
    overview: {
      summary: healthAssessment.summary || "",
      riskWarnings: Array.isArray(healthAssessment.riskWarnings) ? healthAssessment.riskWarnings : [],
      constitution: {
        name: healthAnalysis.subjectName || healthAssessment.subject || "",
        feature: healthAnalysis.subjectFeature || "",
        outline: healthAnalysis.subjectOutline || ""
      }
    },
    face: {
      summary: faceAnalysis.summary || "",
      abnormalCount: faceItems.filter((item) => item.abnormal).length,
      items: faceItems
    },
    tongue: {
      summary: tongueAnalysis.summary || "",
      abnormalCount: tongueMapped.manifestations.length,
      manifestations: tongueMapped.manifestations,
      items: tongueMapped.items
    },
    suggestions: {
      diet: {
        accept: healthAnalysis.dietAccept || "",
        reject: healthAnalysis.dietReject || "",
        recipes: mapList(healthSuggestions.diet, (item) => ({
          name: item.name || "",
          effect: item.effect || ""
        }))
      },
      exercise: {
        accept: healthAnalysis.exerciseAccept || "",
        reject: healthAnalysis.exerciseReject || "",
        suggestion: healthSuggestions.exercise || ""
      },
      therapy: {
        suggestion: healthSuggestions.physicalTherapy || "",
        positions: healthAnalysis.physicalPosition || "",
        figures: healthAnalysis.physicalFigures || "",
        search: healthAnalysis.physicalSearch || "",
        operation: healthAnalysis.physicalOperation || ""
      }
    },
    raw: upstreamPayload
  };
}

module.exports = {
  mapReportPayload
};
