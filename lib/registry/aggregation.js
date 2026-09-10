import { sqmToPing } from './normalize.js';

function normalizedKeyPart(value = '') {
  return String(value ?? '')
    .normalize('NFKC')
    .replace(/\s+/g, '')
    .toUpperCase();
}

export function fillKnownOwnerAddresses(owners = []) {
  const addressesByOwnerId = new Map();

  for (const owner of owners) {
    const ownerId = normalizedKeyPart(owner.ownerId);
    const address = String(owner.address ?? '').trim();
    if (!ownerId || !address) continue;

    if (!addressesByOwnerId.has(ownerId)) {
      addressesByOwnerId.set(ownerId, new Set());
    }
    addressesByOwnerId.get(ownerId).add(address);
  }

  return owners.map((owner) => {
    if (String(owner.address ?? '').trim()) return owner;

    const addressWasManuallyEdited = Object.prototype.hasOwnProperty.call(
      owner.originalValue ?? {},
      'address',
    );
    if (addressWasManuallyEdited) return owner;

    const ownerId = normalizedKeyPart(owner.ownerId);
    const knownAddresses = addressesByOwnerId.get(ownerId);
    if (!ownerId || knownAddresses?.size !== 1) return owner;

    return { ...owner, address: [...knownAddresses][0] };
  });
}

export function getOwnerUniqueKey(owner) {
  const ownerId = normalizedKeyPart(owner.ownerId);
  const ownerName = normalizedKeyPart(owner.ownerName);
  const address = normalizedKeyPart(owner.address);

  if (ownerId) return { key: `id:${ownerId}`, possibleDuplicate: false };
  if (ownerName && address) {
    return {
      key: `name-address:${ownerName}:${address}`,
      possibleDuplicate: false,
    };
  }
  return { key: `name:${ownerName || owner.id}`, possibleDuplicate: true };
}

export function aggregateOwners(owners = [], lands = []) {
  const landById = new Map(lands.map((land) => [land.id, land]));
  const groups = new Map();

  for (const owner of owners) {
    const identity = getOwnerUniqueKey(owner);
    const land = landById.get(owner.parcelId);
    const area =
      owner.ownershipType === 'JOINT_OWNERSHIP'
        ? owner.calculatedOwnershipAreaSqm
        : owner.ownershipAreaSqm;

    if (!groups.has(identity.key)) {
      groups.set(identity.key, {
        ownerKey: identity.key,
        ownerName: owner.ownerName,
        ownerId: owner.ownerId,
        address: owner.address,
        parcelCount: 0,
        parcelNos: [],
        ownershipAreaSqmTotal: 0,
        ownershipAreaPingTotal: 0,
        records: [],
        hasMortgageRelated: false,
        hasRestriction: false,
        possibleDuplicate: identity.possibleDuplicate,
        flags: [],
      });
    }

    const group = groups.get(identity.key);
    if (!group.address && owner.address) group.address = owner.address;
    group.records.push(owner);
    if (!group.parcelNos.includes(owner.parcelNo))
      group.parcelNos.push(owner.parcelNo);
    group.ownershipAreaSqmTotal += Number.isFinite(area) ? area : 0;
    group.hasMortgageRelated ||= Boolean(land?.hasMortgage);
    group.hasRestriction ||= Boolean(land?.hasRestriction);
  }

  return [...groups.values()]
    .map((group) => ({
      ...group,
      parcelCount: group.parcelNos.length,
      ownershipAreaPingTotal: sqmToPing(group.ownershipAreaSqmTotal) ?? 0,
      flags: group.possibleDuplicate ? ['僅依姓名推定，請人工確認'] : [],
    }))
    .sort((a, b) => b.ownershipAreaSqmTotal - a.ownershipAreaSqmTotal);
}

export function calculateJointOwnershipShares({
  landAreaSqm,
  groupShareDecimal = 1,
  ownerCount,
}) {
  if (!Number.isFinite(ownerCount) || ownerCount <= 0) return [];
  const share = groupShareDecimal / ownerCount;
  return Array.from({ length: ownerCount }, () => ({
    calculatedShareDecimal: share,
    calculatedOwnershipAreaSqm: Number.isFinite(landAreaSqm)
      ? landAreaSqm * share
      : null,
  }));
}
