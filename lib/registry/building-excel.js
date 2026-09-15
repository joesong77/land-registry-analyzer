import { formatOwnerForExcel } from './excel.js';

function timestamp() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, '0');
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`;
}

function roundArea(value) {
  return Number.isFinite(value) ? Math.round(value * 100) / 100 : value;
}

export const buildingExcelHeaders = [
  '地號',
  '建號',
  '門牌',
  '層次',
  '層數',
  '主要建材',
  '坐落地號',
  '建築完成日',
  '主建物(㎡)',
  '附屬建物(㎡)',
  '停車場(㎡)',
  '公設(㎡)',
  '建物總面積(㎡)',
  '建物總面積(坪)',
  '所有權人',
  '建物持分分子',
  '/',
  '建物持分分母',
  '持有面積(㎡)',
  '持有面積(坪)',
];

export function buildingWorkbookRows(buildings, owners) {
  const rows = [];
  const groupRanges = [];

  for (const building of buildings) {
    const buildingOwners = owners.filter(
      (owner) => owner.buildingId === building.id,
    );
    const displayOwners = buildingOwners.length ? buildingOwners : [null];
    const start = rows.length + 1;
    for (const owner of displayOwners) {
      rows.push({
        地號: building.displayParcelNo ?? building.parcelNos.join('、'),
        建號: building.buildingNo,
        門牌: building.address,
        層次: building.levels,
        層數: building.floorCount ? `${building.floorCount}層` : '',
        主要建材: building.primaryMaterial,
        坐落地號: building.parcelNos.join('、'),
        建築完成日: building.completionDateROC,
        '主建物(㎡)': roundArea(building.mainBuildingAreaSqm),
        '附屬建物(㎡)': roundArea(building.attachedBuildingAreaSqm),
        '停車場(㎡)': roundArea(building.parkingAreaSqm),
        '公設(㎡)': roundArea(building.publicAreaSqm),
        '建物總面積(㎡)': roundArea(building.totalAreaSqm),
        '建物總面積(坪)': roundArea(building.totalAreaPing),
        所有權人: formatOwnerForExcel(owner?.ownerName, owner?.ownerId),
        建物持分分子: owner?.shareNumerator,
        '/': Number.isFinite(owner?.shareNumerator) ? '/' : '',
        建物持分分母: owner?.shareDenominator,
        '持有面積(㎡)': roundArea(owner?.heldAreaSqm),
        '持有面積(坪)': roundArea(owner?.heldAreaPing),
      });
    }
    groupRanges.push({ start, end: rows.length });
  }
  return { rows, groupRanges };
}

function styleSheet(XLSX, sheet, groupRanges) {
  sheet['!autofilter'] = {
    ref: XLSX.utils.encode_range({
      s: { r: 0, c: 0 },
      e: {
        r: sheet['!ref'] ? XLSX.utils.decode_range(sheet['!ref']).e.r : 0,
        c: buildingExcelHeaders.length - 1,
      },
    }),
  };
  sheet['!freeze'] = {
    xSplit: 0,
    ySplit: 1,
    topLeftCell: 'A2',
    activePane: 'bottomLeft',
    state: 'frozen',
  };
  sheet['!cols'] = [
    20, 15, 28, 10, 8, 20, 22, 14, 14, 14, 12, 12, 16, 16, 17, 14, 4, 14, 15,
    15,
  ].map((wch) => ({ wch }));
  sheet['!merges'] = [];

  for (let column = 0; column < buildingExcelHeaders.length; column += 1) {
    const cell = sheet[XLSX.utils.encode_cell({ r: 0, c: column })];
    if (!cell) continue;
    cell.s = {
      font: { bold: true, color: { rgb: '22313A' } },
      fill: { fgColor: { rgb: 'FFFEC8' } },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      border: {
        top: { style: 'thin', color: { rgb: 'B7B997' } },
        bottom: { style: 'thin', color: { rgb: 'B7B997' } },
        left: { style: 'thin', color: { rgb: 'B7B997' } },
        right: { style: 'thin', color: { rgb: 'B7B997' } },
      },
    };
  }

  const fills = ['FDE9D9', 'E4FCE8'];
  groupRanges.forEach(({ start, end }, groupIndex) => {
    if (end > start) {
      for (let column = 0; column <= 13; column += 1) {
        sheet['!merges'].push({
          s: { r: start, c: column },
          e: { r: end, c: column },
        });
      }
    }
    for (let row = start; row <= end; row += 1) {
      for (let column = 0; column < buildingExcelHeaders.length; column += 1) {
        const cell = sheet[XLSX.utils.encode_cell({ r: row, c: column })];
        if (!cell) continue;
        cell.s = {
          ...cell.s,
          fill: { fgColor: { rgb: fills[groupIndex % fills.length] } },
          alignment: {
            horizontal: 'center',
            vertical: 'center',
            wrapText: true,
          },
          border: {
            top: { style: 'thin', color: { rgb: 'C7CDC5' } },
            bottom: { style: 'thin', color: { rgb: 'C7CDC5' } },
            left: { style: 'thin', color: { rgb: 'C7CDC5' } },
            right: { style: 'thin', color: { rgb: 'C7CDC5' } },
          },
        };
        if ([8, 9, 10, 11, 12, 13, 18, 19].includes(column)) {
          cell.z = '0.00';
        }
      }
    }
  });
}

export async function exportBuildingRegistryWorkbook({ buildings, owners }) {
  const XLSX = await import('xlsx');
  const workbook = XLSX.utils.book_new();
  const result = buildingWorkbookRows(buildings, owners);
  const values = [
    buildingExcelHeaders,
    ...result.rows.map((row) =>
      buildingExcelHeaders.map((header) => row[header] ?? ''),
    ),
  ];
  const sheet = XLSX.utils.aoa_to_sheet(values);
  styleSheet(XLSX, sheet, result.groupRanges);
  XLSX.utils.book_append_sheet(workbook, sheet, '建物謄本總表');
  const fileName = `建物謄本清冊_${timestamp()}.xlsx`;
  XLSX.writeFile(workbook, fileName, { compression: true, cellStyles: true });
  return fileName;
}
