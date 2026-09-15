import { getOwnerUniqueKey } from './aggregation.js';

function placeholderForLand(land, buildingNo = '') {
  return {
    id: `empty-building-${land.id}-${buildingNo || 'none'}`,
    rowId: `land-${land.id}-${buildingNo || 'none'}`,
    sourceBuildingId: '',
    isPlaceholder: true,
    sourceFileId: land.sourceFileId,
    sourceFileName: land.sourceFileName,
    sourcePages: land.sourcePages ?? [],
    city: land.city,
    district: land.district,
    section: land.section,
    displayParcelNo: land.parcelNo,
    parcelNos: [],
    buildingNo,
    address: '',
    levels: '',
    floorCount: null,
    primaryMaterial: '',
    completionDateROC: '',
    mainBuildingAreaSqm: null,
    attachedBuildingAreaSqm: null,
    parkingAreaSqm: null,
    publicAreaSqm: null,
    totalAreaSqm: null,
    totalAreaPing: null,
    ownerIds: [],
    parseWarnings: [],
  };
}

function displayBuilding(building, land = null) {
  return {
    ...building,
    rowId: land
      ? `land-${land.id}-building-${building.id}`
      : `building-${building.id}`,
    sourceBuildingId: building.id,
    isPlaceholder: false,
    displayParcelNo: land?.parcelNo ?? building.parcelNos.join('、'),
  };
}

export function alignBuildingsToLandParcels(buildings = [], lands = []) {
  if (!lands.length)
    return buildings.map((building) => displayBuilding(building));

  const rows = [];
  const matchedBuildingIds = new Set();

  for (const land of lands) {
    let matches = buildings.filter((building) =>
      building.parcelNos.includes(land.parcelNo),
    );

    if (!matches.length && land.buildingNos?.length) {
      const listedBuildingNos = new Set(land.buildingNos);
      matches = buildings.filter((building) =>
        listedBuildingNos.has(building.buildingNo),
      );
    }

    if (matches.length) {
      for (const building of matches) {
        rows.push(displayBuilding(building, land));
        matchedBuildingIds.add(building.id);
      }
      continue;
    }

    const listedBuildingNos = land.buildingNos?.length
      ? land.buildingNos
      : [''];
    for (const buildingNo of listedBuildingNos) {
      rows.push(placeholderForLand(land, buildingNo));
    }
  }

  for (const building of buildings) {
    if (!matchedBuildingIds.has(building.id)) {
      rows.push(displayBuilding(building));
    }
  }

  return rows;
}

export function countUniqueBuildingOwners(owners = []) {
  return new Set(owners.map((owner) => getOwnerUniqueKey(owner).key)).size;
}
