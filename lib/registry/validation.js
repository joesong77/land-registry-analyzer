function createIssue({
  land,
  record,
  severity,
  dataType,
  field,
  message,
  rawText,
}) {
  const sourcePages = record?.sourcePages ?? land?.sourcePages ?? [];
  return {
    id: [
      land?.sourceFileId,
      land?.parcelNo,
      record?.id,
      dataType,
      field,
      message,
    ]
      .filter(Boolean)
      .join(':'),
    severity,
    district: land?.district ?? '',
    section: land?.section ?? '',
    parcelNo: land?.parcelNo ?? record?.parcelNo ?? '',
    dataType,
    field,
    message,
    rawText: rawText ?? record?.rawText ?? land?.rawText ?? '',
    sourceFileName: record?.sourceFileName ?? land?.sourceFileName ?? '',
    sourcePages,
    confirmed: false,
  };
}

export function validateLandRegistry({
  lands = [],
  owners = [],
  encumbrances = [],
}) {
  const issues = [];
  const landById = new Map(lands.map((land) => [land.id, land]));
  const encumbrancesByLand = new Map();

  for (const record of encumbrances) {
    const list = encumbrancesByLand.get(record.parcelId) ?? [];
    list.push(record);
    encumbrancesByLand.set(record.parcelId, list);
  }

  for (const land of lands) {
    if (!land.parcelNo) {
      issues.push(
        createIssue({
          land,
          severity: 'error',
          dataType: '土地',
          field: '地號',
          message: '無法辨識地號',
        }),
      );
    }
    if (!Number.isFinite(land.areaSqm) || land.areaSqm <= 0) {
      issues.push(
        createIssue({
          land,
          severity: 'error',
          dataType: '土地',
          field: '面積',
          message: '土地面積缺漏或不是有效數值',
        }),
      );
    }
    if (land.parseConfidence < 0.8) {
      issues.push(
        createIssue({
          land,
          severity: 'warning',
          dataType: '土地',
          field: '解析信心',
          message: '此筆資料需要人工確認',
        }),
      );
    }

    for (const flag of land.flags.filter(
      (candidate) => candidate.type === 'RESTRICTION',
    )) {
      issues.push(
        createIssue({
          land,
          severity: 'high',
          dataType: '限制登記',
          field: flag.subtype,
          message: `偵測到${flag.subtype}`,
          rawText: flag.rawText,
        }),
      );
    }

    const landOwners = owners.filter((owner) => owner.parcelId === land.id);
    const ordinaryShare = landOwners.reduce(
      (sum, owner) =>
        sum +
        (owner.ownershipType === 'JOINT_OWNERSHIP'
          ? (owner.calculatedShareDecimal ?? 0)
          : (owner.shareDecimal ?? 0)),
      0,
    );
    if (landOwners.length && Math.abs(ordinaryShare - 1) >= 0.0001) {
      issues.push(
        createIssue({
          land,
          severity: 'warning',
          dataType: '所有權',
          field: '權利範圍',
          message: `所有權持分加總為 ${(ordinaryShare * 100).toFixed(2)}%，不等於 100%`,
        }),
      );
    }
  }

  for (const owner of owners) {
    const land = landById.get(owner.parcelId);
    if (!owner.ownerName) {
      issues.push(
        createIssue({
          land,
          record: owner,
          severity: 'error',
          dataType: '所有權',
          field: '所有權人',
          message: '所有權人姓名缺漏',
        }),
      );
    }
    if (
      owner.ownershipType !== 'JOINT_OWNERSHIP' &&
      (!owner.shareDenominator || owner.shareDecimal === null)
    ) {
      issues.push(
        createIssue({
          land,
          record: owner,
          severity: 'warning',
          dataType: '所有權',
          field: '權利範圍',
          message: '持分無法解析',
        }),
      );
    }
    if (owner.ownershipType === 'JOINT_OWNERSHIP' && !owner.jointOwnerCount) {
      issues.push(
        createIssue({
          land,
          record: owner,
          severity: 'warning',
          dataType: '公同共有',
          field: '共有人數',
          message: '公同共有共有人數無法確認，請人工確認',
        }),
      );
    }

    const encumbranceSequences = new Set(
      (encumbrancesByLand.get(owner.parcelId) ?? []).map(
        (record) => record.registrationSequence,
      ),
    );
    for (const sequence of owner.relatedEncumbranceSequences) {
      if (!encumbranceSequences.has(sequence)) {
        issues.push(
          createIssue({
            land,
            record: owner,
            severity: 'warning',
            dataType: '所有權',
            field: '相關他項權利',
            message: `找不到他項權利登記次序 ${sequence}`,
          }),
        );
      }
    }
  }

  for (const record of encumbrances) {
    const land = landById.get(record.parcelId);
    if (/抵押權/.test(record.rightType) && !record.rightHolder) {
      issues.push(
        createIssue({
          land,
          record,
          severity: 'error',
          dataType: '他項權利',
          field: '權利人',
          message: '抵押權缺少權利人',
        }),
      );
    }
    if (/抵押權/.test(record.rightType) && record.securedAmount === null) {
      issues.push(
        createIssue({
          land,
          record,
          severity: 'warning',
          dataType: '他項權利',
          field: '擔保債權總金額',
          message: '擔保金額無法解析',
        }),
      );
    }
    if (record.parseConfidence < 0.8) {
      issues.push(
        createIssue({
          land,
          record,
          severity: 'warning',
          dataType: '他項權利',
          field: '解析信心',
          message: '此筆他項權利需要人工確認',
        }),
      );
    }
  }

  return issues;
}
