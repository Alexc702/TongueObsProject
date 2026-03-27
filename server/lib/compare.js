function itemMap(items) {
  return new Map(items.map((item) => [item.key, item]));
}

function buildRows(leftItems, rightItems) {
  const leftMap = itemMap(leftItems);
  const rightMap = itemMap(rightItems);
  const keys = Array.from(new Set([...leftMap.keys(), ...rightMap.keys()]));
  return keys.map((key) => {
    const left = leftMap.get(key);
    const right = rightMap.get(key);
    return {
      key,
      label: (right || left).title,
      left: left ? left.description : "无",
      right: right ? right.description : "无",
      changed: (left ? left.description : "") !== (right ? right.description : "")
    };
  });
}

function buildComparePayload(leftReport, rightReport) {
  const left = leftReport.result;
  const right = rightReport.result;

  return {
    left: {
      id: leftReport.id,
      generatedAt: left.generatedAt,
      subject: left.subject.primary,
      score: left.subject.score
    },
    right: {
      id: rightReport.id,
      generatedAt: right.generatedAt,
      subject: right.subject.primary,
      score: right.subject.score
    },
    overview: {
      scoreDelta: right.subject.score - left.subject.score,
      subjectChanged: left.subject.primary !== right.subject.primary,
      summaryChanged: left.summary !== right.summary
    },
    sections: [
      {
        key: "overview",
        title: "总评对比",
        rows: [
          { key: "subject", label: "主体质", left: left.subject.primary, right: right.subject.primary, changed: left.subject.primary !== right.subject.primary },
          { key: "score", label: "综合评分", left: String(left.subject.score), right: String(right.subject.score), changed: left.subject.score !== right.subject.score },
          { key: "summary", label: "总结", left: left.summary, right: right.summary, changed: left.summary !== right.summary }
        ]
      },
      {
        key: "face",
        title: "面容对比",
        rows: buildRows(left.face.items, right.face.items)
      },
      {
        key: "tongue",
        title: "舌象对比",
        rows: buildRows(left.tongue.items, right.tongue.items)
      },
      {
        key: "therapy",
        title: "调理建议对比",
        rows: [
          {
            key: "diet",
            label: "食养建议",
            left: left.suggestions.diet.accept,
            right: right.suggestions.diet.accept,
            changed: left.suggestions.diet.accept !== right.suggestions.diet.accept
          },
          {
            key: "exercise",
            label: "运动建议",
            left: left.suggestions.exercise.suggestion || left.suggestions.exercise.accept,
            right: right.suggestions.exercise.suggestion || right.suggestions.exercise.accept,
            changed:
              (left.suggestions.exercise.suggestion || left.suggestions.exercise.accept) !==
              (right.suggestions.exercise.suggestion || right.suggestions.exercise.accept)
          },
          {
            key: "therapy",
            label: "理疗建议",
            left: left.suggestions.therapy.suggestion,
            right: right.suggestions.therapy.suggestion,
            changed: left.suggestions.therapy.suggestion !== right.suggestions.therapy.suggestion
          }
        ]
      }
    ]
  };
}

module.exports = {
  buildComparePayload
};
