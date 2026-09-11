import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';

import {
  cleanRecognizedAddress,
  findAddressImagePlacements,
} from '../lib/registry/address-ocr.js';
import {
  aggregateOwners,
  calculateJointOwnershipShares,
  fillKnownOwnerAddresses,
} from '../lib/registry/aggregation.js';
import { formatOwnerForExcel } from '../lib/registry/excel.js';
import {
  normalizeParcelNo,
  normalizeRegistryText,
  parseShare,
} from '../lib/registry/normalize.js';
import {
  parseRegistryDocuments,
  rebuildPageText,
} from '../lib/registry/parser.js';
import { validateLandRegistry } from '../lib/registry/validation.js';

test('normalizes parcel numbers and Chinese shares', () => {
  assert.equal(normalizeParcelNo('0110-0000'), '110');
  assert.equal(normalizeParcelNo('０１１４－００５２'), '114-52');
  assert.deepEqual(parseShare('1000分之382'), {
    shareText: '1000分之382',
    shareNumerator: 382,
    shareDenominator: 1000,
    shareDecimal: 0.382,
  });
});

test('locates image-based address rows and cleans local OCR text', () => {
  const operatorList = {
    fnArray: [pdfjs.OPS.save, pdfjs.OPS.transform, pdfjs.OPS.paintImageXObject],
    argsArray: [null, [680, 0, 0, 14.4, 20, 469], ['address-image', 2837, 60]],
  };
  assert.deepEqual(findAddressImagePlacements(pdfjs, operatorList), [
    {
      objectId: 'address-image',
      width: 2837,
      height: 60,
      x: 20,
      y: 469,
    },
  ]);
  assert.equal(
    cleanRecognizedAddress(
      '住址 : 人 台 中 市 西 屯 區 何 兩 里 21 瘓 大 安西 街 61 巷 12 號',
    ),
    '台中市西屯區何南里21鄰大安西街61巷12號',
  );
});

test('calculates joint-ownership internal estimates without changing legal shares', () => {
  const whole = calculateJointOwnershipShares({
    landAreaSqm: 120,
    groupShareDecimal: 1,
    ownerCount: 4,
  });
  assert.equal(whole.length, 4);
  assert.ok(whole.every((owner) => owner.calculatedShareDecimal === 0.25));
  assert.ok(whole.every((owner) => owner.calculatedOwnershipAreaSqm === 30));

  const partial = calculateJointOwnershipShares({
    landAreaSqm: 120,
    groupShareDecimal: 0.5,
    ownerCount: 4,
  });
  assert.ok(partial.every((owner) => owner.calculatedShareDecimal === 0.125));
});

test('backfills an owner address from a later registry record', () => {
  const owners = [
    {
      id: 'owner-1',
      parcelId: 'land-1',
      parcelNo: '109-1',
      ownerName: '楊**',
      ownerId: 'H102*****5',
      address: '',
      ownershipType: 'SINGLE',
      ownershipAreaSqm: 100,
    },
    {
      id: 'owner-2',
      parcelId: 'land-2',
      parcelNo: '109-18',
      ownerName: '楊**',
      ownerId: 'H102*****5',
      address: '桃園市楊梅區金溪里17鄰三民路二段***',
      ownershipType: 'SINGLE',
      ownershipAreaSqm: 120,
    },
  ];
  const lands = [
    { id: 'land-1', hasMortgage: false, hasRestriction: false },
    { id: 'land-2', hasMortgage: false, hasRestriction: false },
  ];

  const aggregated = aggregateOwners(owners, lands);

  assert.equal(aggregated.length, 1);
  assert.equal(aggregated[0].address, '桃園市楊梅區金溪里17鄰三民路二段***');

  const filled = fillKnownOwnerAddresses(owners);
  assert.equal(filled[0].address, '桃園市楊梅區金溪里17鄰三民路二段***');
  assert.equal(filled[1].address, '桃園市楊梅區金溪里17鄰三民路二段***');
  assert.equal(owners[0].address, '');
});

test('formats Excel owner cells as surname plus personal ID', () => {
  assert.equal(formatOwnerForExcel('張**', 'L220*****4'), '張L220*****4');
  assert.equal(
    formatOwnerForExcel('歐陽＊＊', ' A123*****9 '),
    '歐陽A123*****9',
  );
  assert.equal(formatOwnerForExcel('張**', ''), '張**');
  assert.equal(formatOwnerForExcel('', 'L220*****4'), 'L220*****4');
  assert.equal(
    formatOwnerForExcel('張L220*****4', 'L220*****4'),
    '張L220*****4',
  );
  assert.equal(
    formatOwnerForExcel('某某股份有限公司', '12345678'),
    '某某股份有限公司12345678',
  );
});

test('parses the complete 18-page registry fixture', async () => {
  const fixture = fileURLToPath(
    new URL('../../何厝段(109-1~114-52)-土地謄本.pdf', import.meta.url),
  );
  const data = new Uint8Array(fs.readFileSync(fixture));
  const document = await pdfjs.getDocument({ data, disableWorker: true })
    .promise;
  const pages = [];

  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    const rawText = rebuildPageText(content.items);
    pages.push({
      sourceFileId: 'fixture',
      sourceFileName: 'fixture.pdf',
      pageNumber,
      rawText,
      normalizedText: normalizeRegistryText(rawText),
    });
  }

  const parsed = parseRegistryDocuments(pages);
  assert.equal(parsed.lands.length, 10);
  assert.equal(parsed.owners.length, 28);
  assert.equal(parsed.encumbrances.length, 4);
  assert.equal(parsed.owners.filter((owner) => owner.address).length, 1);
  assert.equal(
    parsed.owners.find((owner) => owner.parcelNo === '109-18').address,
    '桃園市楊梅區金溪里17鄰三民路二段***',
  );
  assert.equal(
    parsed.lands.reduce((sum, land) => sum + land.areaSqm, 0),
    2713,
  );

  const parcel10918 = parsed.lands.find((land) => land.parcelNo === '109-18');
  assert.equal(parcel10918.areaSqm, 120);
  assert.equal(parcel10918.announcedLandValuePerSqm, 348367);
  assert.deepEqual(parcel10918.buildingNos, ['00800-000']);
  assert.equal(parcel10918.hasMortgage, true);
  assert.equal(parcel10918.hasRestriction, true);
  assert.equal(parcel10918.owners.length, 1);
  assert.equal(parcel10918.encumbrances.length, 2);
  assert.deepEqual(
    parcel10918.encumbrances.map((record) => record.securedAmount),
    [37000000, 10000000],
  );

  const parcel110Owners = parsed.owners.filter(
    (owner) => owner.parcelNo === '110',
  );
  assert.equal(parcel110Owners.length, 3);
  assert.deepEqual(
    parcel110Owners.map((owner) => owner.shareDecimal),
    [0.382, 0.309, 0.309],
  );

  const parcel1147Owners = parsed.owners.filter(
    (owner) => owner.parcelNo === '114-7',
  );
  assert.deepEqual(
    parcel1147Owners.map((owner) => owner.shareDecimal),
    [29 / 40, 11 / 40],
  );

  const parcel11412Owners = parsed.owners.filter(
    (owner) => owner.parcelNo === '114-12',
  );
  assert.deepEqual(
    parcel11412Owners.map((owner) => owner.shareDecimal),
    [0.5, 0.5],
  );

  assert.deepEqual(
    parsed.lands
      .filter((land) => ['114-51', '114-52'].includes(land.parcelNo))
      .map((land) => land.buildingNos),
    [['04741-000'], ['04741-000']],
  );

  const unresolved = validateLandRegistry(parsed);
  assert.ok(unresolved.every((issue) => issue.dataType === '限制登記'));
  await document.destroy();
});
