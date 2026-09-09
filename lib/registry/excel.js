const ownershipTypeLabels = {
  SINGLE: '單獨所有',
  SEPARATE_COOWNERSHIP: '分別共有',
  JOINT_OWNERSHIP: '公同共有',
  UNKNOWN: '待確認',
};

function yesNo(value) {
  return value ? '是' : '否';
}

function makeSheet(XLSX, headers, rows, widths = []) {
  const values = [
    headers,
    ...rows.map((row) => headers.map((header) => row[header] ?? '')),
  ];
  const sheet = XLSX.utils.aoa_to_sheet(values);
  sheet['!autofilter'] = {
    ref: XLSX.utils.encode_range({
      s: { r: 0, c: 0 },
      e: { r: rows.length, c: headers.length - 1 },
    }),
  };
  sheet['!freeze'] = {
    xSplit: 0,
    ySplit: 1,
    topLeftCell: 'A2',
    activePane: 'bottomLeft',
    state: 'frozen',
  };
  sheet['!cols'] = headers.map((header, index) => ({
    wch: widths[index] ?? Math.min(32, Math.max(10, header.length * 2 + 2)),
  }));

  for (let column = 0; column < headers.length; column += 1) {
    const cell = sheet[XLSX.utils.encode_cell({ r: 0, c: column })];
    if (cell) {
      cell.s = {
        font: { bold: true, color: { rgb: 'FFFFFF' } },
        fill: { fgColor: { rgb: '176278' } },
        alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
        border: {
          top: { style: 'thin', color: { rgb: 'B8C8CE' } },
          bottom: { style: 'thin', color: { rgb: 'B8C8CE' } },
          left: { style: 'thin', color: { rgb: 'B8C8CE' } },
          right: { style: 'thin', color: { rgb: 'B8C8CE' } },
        },
      };
    }
  }
  return sheet;
}

function styleTotalSheet(XLSX, sheet, groupRanges, columnCount) {
  const fills = ['FFF5E7', 'EBF7F3'];
  groupRanges.forEach(({ start, end }, groupIndex) => {
    for (let row = start; row <= end; row += 1) {
      for (let column = 0; column < columnCount; column += 1) {
        const cell = sheet[XLSX.utils.encode_cell({ r: row, c: column })];
        if (!cell) continue;
        cell.s = {
          ...cell.s,
          fill: { fgColor: { rgb: fills[groupIndex % fills.length] } },
          alignment: {
            vertical: 'center',
            horizontal: [0, 1, 2, 3, 6, 7, 8, 9, 10, 11, 12].includes(column)
              ? 'center'
              : 'left',
            wrapText: true,
          },
          border: {
            top: { style: 'thin', color: { rgb: 'CAD6DA' } },
            bottom: { style: 'thin', color: { rgb: 'CAD6DA' } },
            left: { style: 'thin', color: { rgb: 'CAD6DA' } },
            right: { style: 'thin', color: { rgb: 'CAD6DA' } },
          },
        };
      }
    }
  });
}

function totalSheetRows(lands, owners) {
  const rows = [];
  const groupRanges = [];

  lands.forEach((land) => {
    const landOwners = owners.filter((owner) => owner.parcelId === land.id);
    const displayOwners = landOwners.length ? landOwners : [null];
    const start = rows.length + 1;

    displayOwners.forEach((owner) => {
      const isJoint = owner?.ownershipType === 'JOINT_OWNERSHIP';
      const numerator = isJoint
        ? owner?.calculatedShareNumerator
        : owner?.shareNumerator;
      const denominator = isJoint
        ? owner?.calculatedShareDenominator
        : owner?.shareDenominator;
      const areaSqm = isJoint
        ? owner?.calculatedOwnershipAreaSqm
        : owner?.ownershipAreaSqm;
      const areaPing = isJoint
        ? owner?.calculatedOwnershipAreaPing
        : owner?.ownershipAreaPing;

      rows.push({
        地號: land.parcelNo,
        '面積（㎡）': land.areaSqm,
        '面積（坪）': land.areaPing,
        地上建物建號: land.buildingNos.join('\n'),
        所有權人: owner?.ownerName ?? '',
        地址: owner?.address ?? '',
        持分分子: numerator,
        '/': numerator !== null && numerator !== undefined ? '/' : '',
        持分分母: denominator,
        '持有面積（㎡）': areaSqm,
        '持有面積（坪）': areaPing,
        共有類型: ownershipTypeLabels[owner?.ownershipType] ?? '',
        持分來源: owner?.isManuallyEdited
          ? '人工修正'
          : isJoint
            ? '公同共有試算'
            : '謄本',
        備註: [
          ...(owner?.remarks ?? []),
          ...(isJoint ? ['依共有人數平均試算，非謄本法定應有部分'] : []),
          ...(land.hasRestriction ? ['有限制登記'] : []),
        ].join('\n'),
      });
    });

    groupRanges.push({ start, end: rows.length });
  });

  return { rows, groupRanges };
}

function timestamp() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, '0');
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`;
}

export async function exportRegistryWorkbook({
  lands,
  owners,
  encumbrances,
  aggregatedOwners,
  validations,
}) {
  const XLSX = await import('xlsx');
  const workbook = XLSX.utils.book_new();

  const totalHeaders = [
    '地號',
    '面積（㎡）',
    '面積（坪）',
    '地上建物建號',
    '所有權人',
    '地址',
    '持分分子',
    '/',
    '持分分母',
    '持有面積（㎡）',
    '持有面積（坪）',
    '共有類型',
    '持分來源',
    '備註',
  ];
  const total = totalSheetRows(lands, owners);
  const totalSheet = makeSheet(
    XLSX,
    totalHeaders,
    total.rows,
    [16, 12, 12, 20, 14, 36, 10, 4, 10, 14, 14, 12, 16, 42],
  );
  totalSheet['!merges'] = [];
  total.groupRanges.forEach(({ start, end }) => {
    if (end <= start) return;
    for (let column = 0; column <= 3; column += 1) {
      totalSheet['!merges'].push({
        s: { r: start, c: column },
        e: { r: end, c: column },
      });
    }
  });
  styleTotalSheet(XLSX, totalSheet, total.groupRanges, totalHeaders.length);
  XLSX.utils.book_append_sheet(workbook, totalSheet, '00_土地謄本總表');

  const landHeaders = [
    '縣市',
    '行政區',
    '段',
    '地號',
    '原始地號',
    '土地面積㎡',
    '土地面積坪',
    '使用分區',
    '使用地類別',
    '公告土地現值年度',
    '公告土地現值_元㎡',
    '地上建物建號',
    '所有權人數',
    '是否有抵押權',
    '是否有限制登記',
    '土地其他登記事項',
    '來源PDF',
    '來源頁碼',
  ];
  const landRows = lands.map((land) => ({
    縣市: land.city,
    行政區: land.district,
    段: land.section,
    地號: land.parcelNo,
    原始地號: land.parcelNoRaw,
    '土地面積㎡': land.areaSqm,
    土地面積坪: land.areaPing,
    使用分區: land.zoning,
    使用地類別: land.landCategory,
    公告土地現值年度: land.announcedLandValueROC,
    '公告土地現值_元㎡': land.announcedLandValuePerSqm,
    地上建物建號: land.buildingNos.join('\n'),
    所有權人數: owners.filter((owner) => owner.parcelId === land.id).length,
    是否有抵押權: yesNo(land.hasMortgage),
    是否有限制登記: yesNo(land.hasRestriction),
    土地其他登記事項: land.remarks.join('\n'),
    來源PDF: land.sourceFileName,
    來源頁碼: land.sourcePages.join(', '),
  }));
  XLSX.utils.book_append_sheet(
    workbook,
    makeSheet(XLSX, landHeaders, landRows),
    '01_土地清冊',
  );

  const ownerHeaders = [
    '縣市',
    '行政區',
    '段',
    '地號',
    '登記次序',
    '所有權人',
    '統一編號',
    '地址',
    '登記日期',
    '登記原因',
    '原因發生日期',
    '權利範圍',
    '持分分子',
    '持分分母',
    '持分比例',
    '持有面積㎡',
    '持有面積坪',
    '共有類型',
    '權狀字號',
    '當期申報地價_元㎡',
    '前次移轉現值',
    '相關他項權利登記次序',
    '其他登記事項',
    '來源PDF',
    '來源頁碼',
  ];
  const landById = new Map(lands.map((land) => [land.id, land]));
  const ownerRows = owners.map((owner) => {
    const land = landById.get(owner.parcelId) ?? {};
    const isJoint = owner.ownershipType === 'JOINT_OWNERSHIP';
    return {
      縣市: land.city,
      行政區: land.district,
      段: land.section,
      地號: owner.parcelNo,
      登記次序: owner.registrationSequence,
      所有權人: owner.ownerName,
      統一編號: owner.ownerId,
      地址: owner.address,
      登記日期: owner.registrationDateROC,
      登記原因: owner.registrationReason,
      原因發生日期: owner.causeDateROC,
      權利範圍: owner.legalShareText,
      持分分子: isJoint ? owner.calculatedShareNumerator : owner.shareNumerator,
      持分分母: isJoint
        ? owner.calculatedShareDenominator
        : owner.shareDenominator,
      持分比例: isJoint ? owner.calculatedShareDecimal : owner.shareDecimal,
      '持有面積㎡': isJoint
        ? owner.calculatedOwnershipAreaSqm
        : owner.ownershipAreaSqm,
      持有面積坪: isJoint
        ? owner.calculatedOwnershipAreaPing
        : owner.ownershipAreaPing,
      共有類型: ownershipTypeLabels[owner.ownershipType],
      權狀字號: owner.deedNo,
      '當期申報地價_元㎡': owner.declaredLandValuePerSqm,
      前次移轉現值: owner.previousTransferValueText,
      相關他項權利登記次序: owner.relatedEncumbranceSequences.join(', '),
      其他登記事項: owner.remarks.join('\n'),
      來源PDF: owner.sourceFileName,
      來源頁碼: owner.sourcePages.join(', '),
    };
  });
  XLSX.utils.book_append_sheet(
    workbook,
    makeSheet(XLSX, ownerHeaders, ownerRows),
    '02_所有權人清冊',
  );

  const aggregateHeaders = [
    '所有權人',
    '統一編號',
    '地址',
    '持有地號數',
    '持有地號',
    '總持有土地面積㎡',
    '總持有土地面積坪',
    '涉及抵押權',
    '有限制登記',
    '待人工確認',
  ];
  const aggregateRows = aggregatedOwners.map((owner) => ({
    所有權人: owner.ownerName,
    統一編號: owner.ownerId,
    地址: owner.address,
    持有地號數: owner.parcelCount,
    持有地號: owner.parcelNos.join(', '),
    '總持有土地面積㎡': owner.ownershipAreaSqmTotal,
    總持有土地面積坪: owner.ownershipAreaPingTotal,
    涉及抵押權: yesNo(owner.hasMortgageRelated),
    有限制登記: yesNo(owner.hasRestriction),
    待人工確認: yesNo(owner.possibleDuplicate),
  }));
  XLSX.utils.book_append_sheet(
    workbook,
    makeSheet(XLSX, aggregateHeaders, aggregateRows),
    '03_地主整合表',
  );

  const encumbranceHeaders = [
    '行政區',
    '段',
    '地號',
    '登記次序',
    '權利種類',
    '收件年期',
    '收件字號',
    '登記日期',
    '登記原因',
    '權利人',
    '權利人統一編號',
    '權利人地址',
    '債權額比例',
    '擔保債權總金額',
    '擔保債權種類及範圍',
    '擔保債權確定期日',
    '清償日期',
    '利息',
    '遲延利息',
    '違約金',
    '其他擔保範圍約定',
    '權利標的',
    '標的登記次序',
    '設定權利範圍',
    '證明書字號',
    '共同擔保地號',
    '共同擔保建號',
    '其他登記事項',
    '來源PDF',
    '來源頁碼',
  ];
  const encumbranceRows = encumbrances.map((record) => {
    const land = landById.get(record.parcelId) ?? {};
    return {
      行政區: land.district,
      段: land.section,
      地號: record.parcelNo,
      登記次序: record.registrationSequence,
      權利種類: record.rightType,
      收件年期: record.receiptYearROC,
      收件字號: record.receiptNo,
      登記日期: record.registrationDateROC,
      登記原因: record.registrationReason,
      權利人: record.rightHolder,
      權利人統一編號: record.rightHolderId,
      權利人地址: record.rightHolderAddress,
      債權額比例: record.debtRatioText,
      擔保債權總金額: record.securedAmount,
      擔保債權種類及範圍: record.debtTypeAndScope,
      擔保債權確定期日: record.determinationDateROC,
      清償日期: record.repaymentDate,
      利息: record.interest,
      遲延利息: record.delayedInterest,
      違約金: record.penalty,
      其他擔保範圍約定: record.otherSecuredScope,
      權利標的: record.rightObject,
      標的登記次序: record.targetRegistrationSequences.join(', '),
      設定權利範圍: record.rightShareText,
      證明書字號: record.certificateNo,
      共同擔保地號: record.jointCollateralParcelNos.join(', '),
      共同擔保建號: record.jointCollateralBuildingNos.join(', '),
      其他登記事項: record.remarks.join('\n'),
      來源PDF: record.sourceFileName,
      來源頁碼: record.sourcePages.join(', '),
    };
  });
  XLSX.utils.book_append_sheet(
    workbook,
    makeSheet(XLSX, encumbranceHeaders, encumbranceRows),
    '04_他項權利',
  );

  const validationHeaders = [
    '嚴重度',
    '行政區',
    '段',
    '地號',
    '資料類型',
    '欄位',
    '問題',
    '原始文字',
    '來源PDF',
    '來源頁碼',
    '是否已人工確認',
  ];
  const validationRows = validations.map((issue) => ({
    嚴重度: issue.severity,
    行政區: issue.district,
    段: issue.section,
    地號: issue.parcelNo,
    資料類型: issue.dataType,
    欄位: issue.field,
    問題: issue.message,
    原始文字: issue.rawText,
    來源PDF: issue.sourceFileName,
    來源頁碼: issue.sourcePages.join(', '),
    是否已人工確認: yesNo(issue.confirmed),
  }));
  XLSX.utils.book_append_sheet(
    workbook,
    makeSheet(XLSX, validationHeaders, validationRows),
    '05_解析檢核',
  );

  const fileName = `土地謄本清冊_${timestamp()}.xlsx`;
  XLSX.writeFile(workbook, fileName, { compression: true, cellStyles: true });
  return fileName;
}
