import {
  normalizeNumber,
  normalizeParcelNo,
  normalizeRegistryText,
  parseShare,
  sqmToPing,
} from './normalize.js';

const pageMarkerPattern = /\[\[PAGE=(\d+)\]\]/g;
const buildingHeaderPattern =
  /([\u3400-\u9fff]{1,8}區)([\u3400-\u9fff]{1,12}段)\s*(\d{5}-\d{3})建號/;
const ownerBlockPattern = /[（(](\d{4})[）)]\s*登記次序\s*:\s*(\d{4})(?!-)/g;
const ownerFieldNames = [
  '登記日期',
  '登記原因',
  '原因發生日期',
  '所有權人',
  '統一編號',
  '住址',
  '權利範圍',
  '權狀字號',
  '相關他項權利登記次序',
  '其他登記事項',
];

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

function cleanFieldValue(value = '') {
  return String(value)
    .replace(pageMarkerPattern, ' ')
    .split('\n')
    .map((line) => line.trim())
    .filter(
      (line) =>
        line &&
        !/^(?:臺中市)?[^\s]{1,8}地政事務所$/.test(line) &&
        !buildingHeaderPattern.test(line) &&
        !/^[（(]續次頁[）)]$/.test(line) &&
        !/^(?:建物登記|列印時間|本謄本係|謄本種類碼|資料管轄機關)/.test(line),
    )
    .join(' ')
    .replace(/\s+/g, ' ')
    .replace(/[（(]空白[）)]/g, '')
    .trim();
}

function fieldValue(text, fieldName, fieldNames = ownerFieldNames) {
  const alternatives = fieldNames
    .filter((name) => name !== fieldName)
    .map(escapeRegExp)
    .join('|');
  const match = normalizeRegistryText(text).match(
    new RegExp(
      `${escapeRegExp(fieldName)}\\s*:\\s*([\\s\\S]*?)(?=(?:${alternatives})\\s*:|$)`,
    ),
  );
  return cleanFieldValue(match?.[1]);
}

function splitBlocks(text, pattern) {
  const matches = [...text.matchAll(new RegExp(pattern.source, pattern.flags))];
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
  return unique(pages.length ? pages : fallbackPages);
}

function inferCity(text) {
  return (
    text.match(/資料管轄機關\s*:\s*([\u3400-\u9fff]{2,8}[縣市])/)?.[1] ?? ''
  );
}

export function normalizeBuildingNo(value = '') {
  const match = String(value)
    .normalize('NFKC')
    .match(/(\d{1,5})-(\d{1,3})/);
  if (!match) return '';
  return `${match[1].padStart(5, '0')}-${match[2].padStart(3, '0')}`;
}

export function parseBuildingHeader(text = '') {
  const normalized = normalizeRegistryText(text);
  const match = normalized.match(buildingHeaderPattern);
  if (!match) return null;
  return {
    district: match[1],
    section: match[2],
    buildingNoRaw: match[3],
    buildingNo: normalizeBuildingNo(match[3]),
  };
}

function sectionSlice(text, startPattern, endPattern) {
  const start = text.search(startPattern);
  if (start < 0) return '';
  const trailing = text.slice(start + 1);
  const offset = trailing.search(endPattern);
  return text.slice(start, offset >= 0 ? start + 1 + offset : text.length);
}

export function splitBuildingRegistrySections(text = '') {
  const normalized = normalizeRegistryText(text);
  return {
    descriptionText: sectionSlice(
      normalized,
      /建物標示部/,
      /建物所有權部|建物他項權利部/,
    ),
    ownershipText: sectionSlice(
      normalized,
      /建物所有權部/,
      /建物他項權利部|[〈<]\s*本謄本列印完畢/,
    ),
    encumbranceText: sectionSlice(
      normalized,
      /建物他項權利部/,
      /[〈<]\s*本謄本列印完畢|※注意/,
    ),
  };
}

function sumAreaMatches(text = '') {
  const matches = [...text.matchAll(/\**([\d,.]+)\s*平方公尺/g)];
  return matches.reduce(
    (sum, match) => sum + (normalizeNumber(match[1]) ?? 0),
    0,
  );
}

function normalizeRocDate(value = '') {
  return cleanFieldValue(value)
    .replace(/^民國/, '')
    .replace(/^(\d{2,3})年/, (_, year) => `${Number(year)}年`);
}

const chineseFloorValues = {
  一: 1,
  二: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9,
  十: 10,
};

function formatLevels(descriptionText, floorCount) {
  const layerText = descriptionText.match(
    /層次\s*:\s*([\s\S]*?)(?=建築完成日期|附屬建物用途|其他登記事項|$)/,
  )?.[1];
  const hasBasement = /地下(?:[一二三四五六七八九十\d]+)?層/.test(
    layerText ?? '',
  );
  const floorValues = [
    ...(layerText ?? '').matchAll(/([一二三四五六七八九十])層/g),
  ]
    .map((match) => chineseFloorValues[match[1]])
    .filter(Number.isFinite);
  const highest = Math.max(floorCount ?? 0, ...floorValues, 0);
  if (hasBasement && highest) return `B1~${highest}`;
  if (highest > 1) return `1~${highest}`;
  return highest ? String(highest) : '';
}

function parseDescription(sectionText) {
  const text = normalizeRegistryText(sectionText);
  const situatedLine = text.match(/建物坐落地號\s*:\s*([^\n]*)/)?.[1] ?? '';
  const parcelNos = unique(
    [...situatedLine.matchAll(/\d{4}-\d{4}/g)].map((match) =>
      normalizeParcelNo(match[0]),
    ),
  );
  const totalAreaSqm = normalizeNumber(
    text.match(/總面積\s*:\s*\**([\d,.]+)\s*平方公尺/)?.[1],
  );
  const attachedBlock = text.match(
    /附屬建物用途\s*:\s*([\s\S]*?)(?=其他登記事項|$)/,
  )?.[1];
  const attachedAreaSqm = attachedBlock ? sumAreaMatches(attachedBlock) : 0;
  const parkingAreaSqm =
    normalizeNumber(
      text.match(/(?:停車場|停車位)[^\n]*?面積\s*:\s*\**([\d,.]+)/)?.[1],
    ) ?? 0;
  const publicAreaSqm =
    normalizeNumber(
      text.match(
        /(?:共有部分|公設)[^\n]*?(?:面積|總面積)\s*:\s*\**([\d,.]+)/,
      )?.[1],
    ) ?? 0;
  const mainBuildingAreaSqm = totalAreaSqm;
  const overallAreaSqm = Number.isFinite(mainBuildingAreaSqm)
    ? mainBuildingAreaSqm + attachedAreaSqm + parkingAreaSqm + publicAreaSqm
    : null;
  const floorCount = normalizeNumber(text.match(/層數\s*:\s*(\d+)層/)?.[1]);
  const remarks = cleanFieldValue(
    text.match(/其他登記事項\s*:\s*([\s\S]*)/)?.[1],
  );

  return {
    registrationDateROC: cleanFieldValue(
      text.match(/登記日期\s*:\s*([^\n]*?)(?=登記原因\s*:|$)/)?.[1],
    ),
    registrationReason: cleanFieldValue(
      text.match(/登記原因\s*:\s*([^\n]*)/)?.[1],
    ),
    address: cleanFieldValue(text.match(/建物門牌\s*:\s*([^\n]*)/)?.[1]),
    parcelNos,
    primaryUse: cleanFieldValue(text.match(/主要用途\s*:\s*([^\n]*)/)?.[1]),
    primaryMaterial: cleanFieldValue(
      text.match(/主要建材\s*:\s*([^\n]*)/)?.[1],
    ),
    floorCount,
    levels: formatLevels(text, floorCount),
    completionDateROC: normalizeRocDate(
      text.match(/建築完成日期\s*:\s*([^\n]*)/)?.[1],
    ),
    mainBuildingAreaSqm,
    attachedBuildingAreaSqm: attachedAreaSqm,
    parkingAreaSqm,
    publicAreaSqm,
    totalAreaSqm: overallAreaSqm,
    totalAreaPing: sqmToPing(overallAreaSqm),
    remarks: remarks ? [remarks] : [],
  };
}

function parseOwner(block, building, fallbackPages) {
  const text = normalizeRegistryText(block.text);
  const shareRaw = fieldValue(text, '權利範圍');
  const share = parseShare(shareRaw);
  const heldAreaSqm =
    Number.isFinite(building.totalAreaSqm) &&
    Number.isFinite(share.shareDecimal)
      ? building.totalAreaSqm * share.shareDecimal
      : null;
  return {
    id: makeId('building-owner'),
    sourceFileId: building.sourceFileId,
    sourceFileName: building.sourceFileName,
    buildingId: building.id,
    buildingNo: building.buildingNo,
    parcelNos: building.parcelNos,
    sequenceDisplay: block.sequenceDisplay,
    registrationSequence: block.registrationSequence,
    registrationDateROC: fieldValue(text, '登記日期'),
    registrationReason: fieldValue(text, '登記原因'),
    causeDateROC: fieldValue(text, '原因發生日期'),
    ownerName: fieldValue(text, '所有權人'),
    ownerId: fieldValue(text, '統一編號'),
    address: fieldValue(text, '住址'),
    legalShareText: shareRaw,
    ...share,
    deedNo: fieldValue(text, '權狀字號'),
    relatedEncumbranceSequences: unique(
      fieldValue(text, '相關他項權利登記次序').match(/\d{4}-\d{3}/g) ?? [],
    ),
    remarks: [fieldValue(text, '其他登記事項')].filter(Boolean),
    heldAreaSqm,
    heldAreaPing: sqmToPing(heldAreaSqm),
    sourcePages: sourcePagesForBlock(text, fallbackPages),
    originalValue: {},
    isManuallyEdited: false,
  };
}

function parseBuildingGroup(group) {
  const combined = group.pages
    .map(
      (page) =>
        `[[PAGE=${page.pageNumber}]]\n${page.normalizedText || page.rawText}`,
    )
    .join('\n');
  const sections = splitBuildingRegistrySections(combined);
  const description = parseDescription(sections.descriptionText);
  const sourcePages = group.pages.map((page) => page.pageNumber);
  const building = {
    id: makeId('building'),
    sourceFileId: group.sourceFileId,
    sourceFileName: group.sourceFileName,
    sourcePages,
    city: inferCity(combined),
    district: group.header.district,
    section: group.header.section,
    buildingNoRaw: group.header.buildingNoRaw,
    buildingNo: group.header.buildingNo,
    ...description,
    hasMortgage: /抵押權/.test(sections.encumbranceText),
    hasRestriction: /限制登記事項|預告登記|查封|假扣押|假處分|禁止處分/.test(
      sections.ownershipText,
    ),
    parseWarnings: [],
    originalValue: {},
    isManuallyEdited: false,
  };
  const owners = splitBlocks(sections.ownershipText, ownerBlockPattern).map(
    (block) => parseOwner(block, building, sourcePages),
  );
  building.ownerIds = owners.map((owner) => owner.id);
  building.parseConfidence =
    building.buildingNo &&
    building.address &&
    building.totalAreaSqm &&
    owners.length
      ? 1
      : 0.7;
  if (!building.totalAreaSqm) building.parseWarnings.push('無法辨識建物面積');
  if (!owners.length) building.parseWarnings.push('無法辨識建物所有權人');
  return { building, owners };
}

export function parseBuildingRegistryDocuments(pages = []) {
  const groups = new Map();
  const currentByFile = new Map();

  for (const page of pages) {
    const header = parseBuildingHeader(page.normalizedText || page.rawText);
    if (header) {
      const key = `${page.sourceFileId}:${header.district}:${header.section}:${header.buildingNo}`;
      if (!groups.has(key)) {
        groups.set(key, {
          sourceFileId: page.sourceFileId,
          sourceFileName: page.sourceFileName,
          header,
          pages: [],
        });
      }
      currentByFile.set(page.sourceFileId, key);
    }
    const key = currentByFile.get(page.sourceFileId);
    if (key) groups.get(key).pages.push(page);
  }

  const buildings = [];
  const owners = [];
  for (const group of groups.values()) {
    const parsed = parseBuildingGroup(group);
    buildings.push(parsed.building);
    owners.push(...parsed.owners);
  }
  return { buildings, owners };
}
