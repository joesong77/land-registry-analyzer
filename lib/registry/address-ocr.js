const addressImageMinWidth = 1000;
const addressImageMaxHeight = 120;

const commonOcrCorrections = [
  [/中靂區/g, '中壢區'],
  [/何[兩責]里/g, '何南里'],
  [/金溪時(?=\d)/g, '金溪里'],
  [/和平時(?=\d)/g, '和平里'],
  [/目人?信里/g, '自信里'],
  [/亡子里/g, '廍子里'],
  [/說中街/g, '興中街'],
  [/[臺台]灣大這/g, '臺灣大道'],
];

function previousTransform(operatorList, imageIndex) {
  for (let index = imageIndex - 1; index >= 0; index -= 1) {
    const operation = operatorList.fnArray[index];
    if (operation === operatorList.ops.restore) break;
    if (operation === operatorList.ops.transform) {
      return operatorList.argsArray[index];
    }
  }
  return null;
}

export function findAddressImagePlacements(pdfjs, operatorList) {
  const list = { ...operatorList, ops: pdfjs.OPS };
  const placements = [];

  for (let index = 0; index < list.fnArray.length; index += 1) {
    if (list.fnArray[index] !== pdfjs.OPS.paintImageXObject) continue;
    const [objectId, width, height] = list.argsArray[index] ?? [];
    if (width < addressImageMinWidth || height > addressImageMaxHeight) {
      continue;
    }

    const transform = previousTransform(list, index);
    if (!transform) continue;
    placements.push({
      objectId,
      width,
      height,
      x: transform[4] ?? 44,
      y: transform[5] ?? 0,
    });
  }

  return placements;
}

export function cleanRecognizedAddress(value = '') {
  let address = String(value)
    .normalize('NFKC')
    .replace(/[\r\n\s]+/g, '')
    .replace(/^[“”"'「『]*住[址祉][：:]?/, '')
    .replace(/^址[：:]?/, '')
    .replace(/^[：:]+/, '');

  const locationStart = address.search(
    /(?:臺北市|台北市|新北市|桃園市|臺中市|台中市|臺南市|台南市|高雄市|基隆市|新竹市|嘉義市|新竹縣|苗栗縣|彰化縣|南投縣|雲林縣|嘉義縣|屏東縣|宜蘭縣|花蓮縣|臺東縣|台東縣|澎湖縣|金門縣|連江縣)/,
  );
  if (locationStart >= 0) address = address.slice(locationStart);

  for (const [pattern, replacement] of commonOcrCorrections) {
    address = address.replace(pattern, replacement);
  }

  return address
    .replace(/(\d+)[瘓導獲交關郊紙](?=[\p{Script=Han}])/gu, '$1鄰')
    .replace(/\/(?=\d)/g, '7')
    .replace(/\](?=\d)/g, '')
    .trim();
}

function resolvePageObject(page, objectId) {
  return new Promise((resolve) => page.objs.get(objectId, resolve));
}

function imageToCanvas(pdfjs, image) {
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const context = canvas.getContext('2d', { alpha: false });

  if (image.bitmap) {
    context.drawImage(image.bitmap, 0, 0);
    return canvas;
  }

  const output = context.createImageData(image.width, image.height);
  const pixelCount = image.width * image.height;

  if (image.kind === pdfjs.ImageKind.RGB_24BPP) {
    for (let pixel = 0; pixel < pixelCount; pixel += 1) {
      const source = pixel * 3;
      const target = pixel * 4;
      output.data[target] = image.data[source];
      output.data[target + 1] = image.data[source + 1];
      output.data[target + 2] = image.data[source + 2];
      output.data[target + 3] = 255;
    }
  } else if (image.kind === pdfjs.ImageKind.RGBA_32BPP) {
    output.data.set(image.data);
  } else {
    for (let pixel = 0; pixel < pixelCount; pixel += 1) {
      const byte = image.data[pixel >> 3] ?? 0;
      const value = byte & (128 >> (pixel & 7)) ? 0 : 255;
      const target = pixel * 4;
      output.data[target] = value;
      output.data[target + 1] = value;
      output.data[target + 2] = value;
      output.data[target + 3] = 255;
    }
  }

  context.putImageData(output, 0, 0);
  return canvas;
}

export async function recognizeAddressImageItems({
  pdfjs,
  page,
  worker,
  placements,
}) {
  const addressPlacements =
    placements ??
    findAddressImagePlacements(pdfjs, await page.getOperatorList());
  const items = [];

  for (const placement of addressPlacements) {
    const image = await resolvePageObject(page, placement.objectId);
    const canvas = imageToCanvas(pdfjs, image);
    const result = await worker.recognize(canvas);
    const address = cleanRecognizedAddress(result.data.text);
    if (!address) continue;

    items.push({
      str: `住址：${address}`,
      transform: [1, 0, 0, 1, Math.max(44, placement.x), placement.y],
      ocrConfidence: result.data.confidence,
    });
  }

  return items;
}
