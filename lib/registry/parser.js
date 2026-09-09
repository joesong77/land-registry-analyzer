import {
  encumbranceFieldNames,
  knownRightTypes,
  ownerFieldNames,
  registryPatterns,
  riskKeywords,
} from './patterns.js';
import {
  decimalToFraction,
  normalizeBlank,
  normalizeNumber,
  normalizeParcelNo,
  normalizeRegistryText,
  parseShare,
  sqmToPing,
} from './normalize.js';

const pageMarkerPattern = /\[\[PAGE=(\d+)\]\]/g;

function makeId(prefix) {
  const value =
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}-${value}`;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

export function rebuildPageText(items = []) {
  const rows = [];

  for (const item of items) {
    const text = item?.str?.trim();
    if (!text) continue;
    const x = Number(item.transform?.[4] ?? 0);
    const y = Number(item.transform?.[5] ?? 0);

    // The vertical codes at both page edges are verification marks, not content.
    if (x < 35 || x > 560) continue;

    let row = rows.find((candidate) => Math.abs(candidate.y - y) <= 1.2);
    if (!row) {
      row = { y, items: [] };
      rows.push(row);
    }
    row.items.push({ x, text });
  }

  return rows
    .sort((a, b) => b.y - a.y)
    .map((row) =>
      row.items
        .sort((a, b) => a.x - b.x)
        .map((item) => item.text)
        .join(''),
    )
    .join('\n');
}

export function parseParcelHeader(text = '') {
  const normalized = normalizeRegistryText(text);
  const match = normalized.match(registryPatterns.parcelHeader);
  if (!match) return null;

  return {
    district: match[1],
    section: match[2],
    parcelNoRaw: match[3],
    parcelNo: normalizeParcelNo(match[3]),
  };
}

function cutNotices(text) {
  const index = text.search(/[（(]本謄本列印完畢[）)]|※注意/);
  return index >= 0 ? text.slice(0, index) : text;
}

function cleanFieldValue(value = '') {
  return normalizeBlank(
    cutNotices(value)
      .replace(pageMarkerPattern, '')
      .split('\n')
      .filter((line) => {
        const trimmed = line.trim();
        if (!trimmed) return false;
        return !(
          /土地登記第二類謄本/.test(trimmed) ||
          registryPatterns.parcelHeader.test(trimmed) ||
          trimmed.startsWith('列印時間:') ||
          trimmed.startsWith('本謄本係網路申領') ||
          trimmed.startsWith('謄本種類碼:') ||
          /地政事務所主任/.test(trimmed) ||
          /電謄字第/.test(trimmed) ||
          trimmed.startsWith('資料管轄機關:') ||
          /^臺中市中興地政事務所$/.test(trimmed) ||
          /^[（(]續次頁[）)]$/.test(trimmed)
        );
      })
      .join('\n')
      .trim(),
  );
}

function fieldValue(text, fieldName, fieldNames) {
  const alternatives = fieldNames
    .filter((candidate) => candidate !== fieldName)
    .sort((a, b) => b.length - a.length)
    .map(escapeRegExp)
    .join('|');
  const end = alternatives ? `(?=(?:${alternatives})\\s*:|$)` : '$';
  const pattern = new RegExp(
    `${escapeRegExp(fieldName)}\\s*:\\s*([\\s\\S]*?)${end}`,
  );
  const match = normalizeRegistryText(text).match(pattern);
  return cleanFieldValue(match?.[1] ?? '');
}

function splitBlocks(text, pattern) {
  const regex = new RegExp(pattern.source, pattern.flags);
  const matches = [...text.matchAll(regex)];
  return matches.map((match, index) => ({
    sequenceDisplay: match[1],
    registrationSequence: match[2],
    text: text.slice(match.index, matches[index + 1]?.index ?? text.length),
  }));
}

function sourcePagesForBlock(blockText, fallbackPages) {
  const pages = [...blockText.matchAll(pageMarkerPattern)].map((match) =>
    Number(match[1]),
  );
  return unique(pages.length ? pages : fallbackPages.slice(0, 1));
}

function sectionSlice(text, startPattern, endPattern) {
  const start = text.search(startPattern);
  if (start < 0) return '';
  const endMatch = text.slice(start + 1).search(endPattern);
  const end = endMatch >= 0 ? start + 1 + endMatch : text.length;
  const markerMatches = [...text.slice(0, start).matchAll(pageMarkerPattern)];
  const marker = markerMatches.at(-1)?.[0] ?? '';
  return `${marker}\n${text.slice(start, end)}`;
}

export function splitRegistrySections(text = '') {
  return {
    landDescriptionText: sectionSlice(
      text,
      registryPatterns.sectionLand,
      registryPatterns.sectionOwner,
    ),
    ownershipText: sectionSlice(
      text,
      registryPatterns.sectionOwner,
      registryPatterns.sectionEncumbrance,
    ),
    encumbranceText: sectionSlice(
      text,
      registryPatterns.sectionEncumbrance,
      /$^/,
    ),
  };
}

function inferCity(text) {
  const match = text.match(
    /(臺北市|新北市|桃園市|臺中市|臺南市|高雄市|基隆市|新竹市|嘉義市|新竹縣|苗栗縣|彰化縣|南投縣|雲林縣|嘉義縣|屏東縣|宜蘭縣|花蓮縣|臺東縣|澎湖縣|金門縣|連江縣)/,
  );
  return match?.[1] ?? '';
}

function parseLandDescription(sectionText) {
  const normalized = normalizeRegistryText(sectionText);
  const areaMatch = normalized.match(registryPatterns.area);
  const announced = normalized.match(registryPatterns.announcedLandValue);
  const dateMatch = normalized.match(
    /登記日期\s*:\s*(民國\d{2,3}年\d{1,2}月\d{1,2}日)/,
  );
  const reasonMatch = normalized.match(
    /登記原因\s*:\s*([^\n]+?)(?=面積|使用分區|$)/,
  );
  const zoningMatch = normalized.match(
    /使用分區\s*:\s*([^\n]*?)(?=使用地類別\s*:|$)/,
  );
  const categoryMatch = normalized.match(
    /使用地類別\s*:\s*([^\n]*?)(?=民國\d{2,3}年|$)/,
  );
  const buildingLine = normalized.match(/地上建物建號\s*:\s*([^\n]*)/);
  const buildingNos = unique(
    [...(buildingLine?.[1] ?? '').matchAll(/\d{4,5}-\d{3}/g)].map(
      (match) => match[0],
    ),
  );
  const remarksMatch = normalized.match(/其他登記事項\s*:\s*([\s\S]*)/);
  const areaSqm = normalizeNumber(areaMatch?.[1]);

  return {
    registrationDateROC: dateMatch?.[1] ?? '',
    registrationReason: cleanFieldValue(reasonMatch?.[1] ?? ''),
    areaSqm,
    areaPing: sqmToPing(areaSqm),
    zoning: normalizeBlank(zoningMatch?.[1] ?? ''),
    landCategory: normalizeBlank(categoryMatch?.[1] ?? ''),
    announcedLandValueROC: announced
      ? `${announced[1]}年${announced[2]}月`
      : '',
    announcedLandValuePerSqm: normalizeNumber(announced?.[3]),
    buildingNos,
    remarks: cleanFieldValue(remarksMatch?.[1] ?? '')
      ? [cleanFieldValue(remarksMatch?.[1] ?? '')]
      : [],
  };
}

function parseOwnerBlock(block, land, fallbackPages) {
  const text = normalizeRegistryText(block.text);
  const shareRaw = fieldValue(text, '權利範圍', ownerFieldNames);
  const share = parseShare(shareRaw);
  const ownerName = fieldValue(text, '所有權人', ownerFieldNames);
  const ownerId = fieldValue(text, '統一編號', ownerFieldNames);
  const address = fieldValue(text, '住址', ownerFieldNames);
  const declaredText = fieldValue(text, '當期申報地價', ownerFieldNames);
  const relatedText = fieldValue(text, '相關他項權利登記次序', ownerFieldNames);
  const remarks = fieldValue(text, '其他登記事項', ownerFieldNames);
  const sourcePages = sourcePagesForBlock(text, fallbackPages);
  const isJoint = /公同共有/.test(shareRaw) || /公同共有/.test(text);
  const ownershipAreaSqm =
    Number.isFinite(land.areaSqm) && Number.isFinite(share.shareDecimal)
      ? land.areaSqm * share.shareDecimal
      : null;
  const missingMainFields = [ownerName, shareRaw].filter(
    (value) => !value,
  ).length;

  return {
    id: makeId('owner'),
    parcelId: land.id,
    parcelNo: land.parcelNo,
    sourceFileId: land.sourceFileId,
    sourceFileName: land.sourceFileName,
    sequenceDisplay: block.sequenceDisplay,
    registrationSequence: block.registrationSequence,
    registrationDateROC: fieldValue(text, '登記日期', ownerFieldNames),
    registrationReason: fieldValue(text, '登記原因', ownerFieldNames),
    causeDateROC: fieldValue(text, '原因發生日期', ownerFieldNames),
    ownerName,
    ownerId,
    address,
    ...share,
    legalShareText: shareRaw,
    ownershipType: isJoint ? 'JOINT_OWNERSHIP' : 'UNKNOWN',
    jointOwnershipGroupId: isJoint ? `${land.id}-joint-1` : null,
    jointOwnerCount: null,
    calculatedShareNumerator: null,
    calculatedShareDenominator: null,
    calculatedShareDecimal: null,
    isCalculatedShare: false,
    ownershipAreaSqm,
    ownershipAreaPing: sqmToPing(ownershipAreaSqm),
    calculatedOwnershipAreaSqm: null,
    calculatedOwnershipAreaPing: null,
    deedNo: fieldValue(text, '權狀字號', ownerFieldNames),
    declaredLandValueROC: declaredText.match(/(\d{2,3}年\d{1,2}月)/)?.[1] ?? '',
    declaredLandValuePerSqm: normalizeNumber(
      declaredText.match(/([\d,.]+)元/)?.[1],
    ),
    previousTransferValueText: fieldValue(
      text,
      '前次移轉現值或原規定地價',
      ownerFieldNames,
    ),
    acquisitionHistoryText: fieldValue(
      text,
      '歷次取得權利範圍',
      ownerFieldNames,
    ),
    relatedEncumbranceSequences: unique(
      [...relatedText.matchAll(/\d{4}-\d{3}/g)].map((match) => match[0]),
    ),
    remarks: remarks ? [remarks] : [],
    sourcePages,
    sourcePage: sourcePages[0] ?? null,
    rawText: cleanFieldValue(text),
    parseWarnings: [],
    parseConfidence:
      missingMainFields === 0 && (share.shareDecimal !== null || isJoint)
        ? 1
        : share.shareDecimal === null && !isJoint
          ? 0.6
          : 0.9,
    isManuallyEdited: false,
    originalValue: {},
  };
}

function applyOwnershipTypesAndJointShares(owners, land) {
  const ordinaryOwners = owners.filter(
    (owner) => owner.ownershipType !== 'JOINT_OWNERSHIP',
  );
  const jointOwners = owners.filter(
    (owner) => owner.ownershipType === 'JOINT_OWNERSHIP',
  );

  for (const owner of ordinaryOwners) {
    owner.ownershipType =
      owners.length === 1 && owner.shareDecimal === 1
        ? 'SINGLE'
        : 'SEPARATE_COOWNERSHIP';
  }

  if (!jointOwners.length) return;
  const count = jointOwners.length;
  const ordinaryTotal = ordinaryOwners.reduce(
    (sum, owner) => sum + (owner.shareDecimal ?? 0),
    0,
  );
  const groupShareDecimal = Math.max(0, 1 - ordinaryTotal);
  const calculatedShareDecimal = count ? groupShareDecimal / count : null;
  const fraction = decimalToFraction(calculatedShareDecimal);

  for (const owner of jointOwners) {
    owner.jointOwnerCount = count;
    owner.calculatedShareDecimal = calculatedShareDecimal;
    owner.calculatedShareNumerator = fraction?.numerator ?? null;
    owner.calculatedShareDenominator = fraction?.denominator ?? null;
    owner.isCalculatedShare = Number.isFinite(calculatedShareDecimal);
    owner.calculatedOwnershipAreaSqm =
      Number.isFinite(land.areaSqm) && Number.isFinite(calculatedShareDecimal)
        ? land.areaSqm * calculatedShareDecimal
        : null;
    owner.calculatedOwnershipAreaPing = sqmToPing(
      owner.calculatedOwnershipAreaSqm,
    );
  }
}

function parseEncumbranceBlock(block, land, fallbackPages) {
  const text = normalizeRegistryText(block.text);
  const rightType = fieldValue(text, '權利種類', encumbranceFieldNames);
  const receiptYear = fieldValue(text, '收件年期', encumbranceFieldNames);
  const amountText = fieldValue(text, '擔保債權總金額', encumbranceFieldNames);
  const jointParcelText = fieldValue(
    text,
    '共同擔保地號',
    encumbranceFieldNames,
  );
  const jointBuildingText = fieldValue(
    text,
    '共同擔保建號',
    encumbranceFieldNames,
  );
  const remarks = fieldValue(text, '其他登記事項', encumbranceFieldNames);
  const sourcePages = sourcePagesForBlock(text, fallbackPages);
  const securedAmount = normalizeNumber(amountText.match(/([\d,]+)元/)?.[1]);
  const isMortgage = /抵押權/.test(rightType);
  const parseWarnings = [];

  if (rightType && !knownRightTypes.includes(rightType)) {
    parseWarnings.push(`未識別的權利種類：${rightType}`);
  }

  return {
    id: makeId('encumbrance'),
    parcelId: land.id,
    parcelNo: land.parcelNo,
    sourceFileId: land.sourceFileId,
    sourceFileName: land.sourceFileName,
    sequenceDisplay: block.sequenceDisplay,
    registrationSequence: block.registrationSequence,
    rightType,
    receiptYearROC: receiptYear.match(/民國(\d{2,3})年/)?.[1] ?? '',
    receiptNo: fieldValue(text, '字號', encumbranceFieldNames),
    registrationDateROC: fieldValue(text, '登記日期', encumbranceFieldNames),
    registrationReason: fieldValue(text, '登記原因', encumbranceFieldNames),
    rightHolder: fieldValue(text, '權利人', encumbranceFieldNames),
    rightHolderId: fieldValue(text, '統一編號', encumbranceFieldNames),
    rightHolderAddress: fieldValue(text, '住址', encumbranceFieldNames),
    debtRatioText: fieldValue(text, '債權額比例', encumbranceFieldNames),
    securedAmount,
    securedAmountText: amountText,
    debtTypeAndScope: fieldValue(
      text,
      '擔保債權種類及範圍',
      encumbranceFieldNames,
    ),
    determinationDateROC: fieldValue(
      text,
      '擔保債權確定期日',
      encumbranceFieldNames,
    ),
    repaymentDate: fieldValue(text, '清償日期', encumbranceFieldNames),
    interest: fieldValue(text, '利息(率)', encumbranceFieldNames),
    delayedInterest: fieldValue(text, '遲延利息(率)', encumbranceFieldNames),
    penalty: fieldValue(text, '違約金', encumbranceFieldNames),
    otherSecuredScope: fieldValue(
      text,
      '其他擔保範圍約定',
      encumbranceFieldNames,
    ),
    rightObject: fieldValue(text, '權利標的', encumbranceFieldNames),
    targetRegistrationSequences: unique(
      [
        ...fieldValue(text, '標的登記次序', encumbranceFieldNames).matchAll(
          /\d{4}/g,
        ),
      ].map((match) => match[0]),
    ),
    rightShareText: fieldValue(text, '設定權利範圍', encumbranceFieldNames),
    certificateNo: fieldValue(text, '證明書字號', encumbranceFieldNames),
    jointCollateralParcelNos: unique(
      [...jointParcelText.matchAll(/\d{4}-\d{4}/g)].map((match) =>
        normalizeParcelNo(match[0]),
      ),
    ),
    jointCollateralBuildingNos: unique(
      [...jointBuildingText.matchAll(/\d{4,5}-\d{3}/g)].map(
        (match) => match[0],
      ),
    ),
    remarks: remarks ? [remarks] : [],
    sourcePages,
    rawText: cleanFieldValue(text),
    parseWarnings,
    parseConfidence:
      rightType && (!isMortgage || securedAmount !== null)
        ? 1
        : isMortgage
          ? 0.7
          : 0.9,
    isManuallyEdited: false,
    originalValue: {},
  };
}

function extractRisks(text) {
  return riskKeywords
    .filter(([keyword]) => text.includes(keyword))
    .map(([keyword, label, severity]) => ({
      type: 'RESTRICTION',
      subtype: label,
      severity,
      message: label,
      rawText:
        text.match(new RegExp(`.{0,30}${escapeRegExp(keyword)}.{0,80}`))?.[0] ??
        keyword,
    }));
}

function parseParcelGroup(group) {
  const header = group.header;
  const sourcePages = group.pages.map((page) => page.pageNumber);
  const combined = cutNotices(
    group.pages
      .map((page) => `[[PAGE=${page.pageNumber}]]\n${page.normalizedText}`)
      .join('\n'),
  );
  const sections = splitRegistrySections(combined);
  const description = parseLandDescription(sections.landDescriptionText);
  const land = {
    id: makeId('land'),
    sourceFileId: group.sourceFileId,
    sourceFileName: group.sourceFileName,
    sourcePages,
    city: inferCity(combined),
    district: header.district,
    section: header.section,
    parcelNoRaw: header.parcelNoRaw,
    parcelNo: header.parcelNo,
    ...description,
    owners: [],
    encumbrances: [],
    flags: [],
    parseWarnings: [],
    parseConfidence: description.areaSqm ? 1 : 0.7,
    rawText: combined.replace(pageMarkerPattern, '').trim(),
    isManuallyEdited: false,
    originalValue: {},
  };

  const owners = splitBlocks(
    sections.ownershipText,
    registryPatterns.ownerBlock,
  ).map((block) => parseOwnerBlock(block, land, sourcePages));
  applyOwnershipTypesAndJointShares(owners, land);

  const encumbrances = splitBlocks(
    sections.encumbranceText,
    registryPatterns.encumbranceBlock,
  ).map((block) => parseEncumbranceBlock(block, land, sourcePages));

  const risks = extractRisks(combined);
  if (encumbrances.some((record) => /抵押權/.test(record.rightType))) {
    land.flags.push({
      type: 'MORTGAGE',
      subtype: '抵押權',
      severity: 'warning',
      message: '有抵押權',
    });
  }
  land.flags.push(...risks);
  land.owners = owners;
  land.encumbrances = encumbrances;
  land.hasMortgage = land.flags.some((flag) => flag.type === 'MORTGAGE');
  land.hasRestriction = land.flags.some((flag) => flag.type === 'RESTRICTION');

  if (!owners.length) {
    land.parseWarnings.push('未辨識到所有權人紀錄');
    land.parseConfidence = Math.min(land.parseConfidence, 0.7);
  }

  return { land, owners, encumbrances };
}

export function parseRegistryDocuments(pages = []) {
  const groups = new Map();
  const currentByFile = new Map();

  for (const page of pages) {
    const header = parseParcelHeader(page.normalizedText || page.rawText);
    let key;
    if (header) {
      key = `${page.sourceFileId}:${header.district}:${header.section}:${header.parcelNoRaw}`;
      currentByFile.set(page.sourceFileId, key);
    } else {
      key = currentByFile.get(page.sourceFileId);
    }

    if (!key || (!header && !groups.has(key))) continue;
    if (!groups.has(key)) {
      groups.set(key, {
        sourceFileId: page.sourceFileId,
        sourceFileName: page.sourceFileName,
        header,
        pages: [],
      });
    }
    groups.get(key).pages.push(page);
  }

  const lands = [];
  const owners = [];
  const encumbrances = [];

  for (const group of groups.values()) {
    const parsed = parseParcelGroup(group);
    lands.push(parsed.land);
    owners.push(...parsed.owners);
    encumbrances.push(...parsed.encumbrances);
  }

  return { lands, owners, encumbrances };
}
