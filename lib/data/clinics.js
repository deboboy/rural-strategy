import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
let clinicCache = null;

function loadClinicsGeojson() {
  if (!clinicCache) {
    const path = join(root, 'data', 'wa-rural-health-clinics.geojson');
    clinicCache = JSON.parse(readFileSync(path, 'utf8'));
  }
  return clinicCache;
}

function normalizeCounty(value) {
  return String(value || '').trim().toLowerCase();
}

function formatClinic(feature) {
  const properties = feature.properties || {};
  return {
    id: feature.id ?? properties.OBJECTID ?? properties.LINK,
    facility: properties.Facility || 'Unnamed clinic',
    county: String(properties.County || '').trim(),
    city: properties.City || '',
    address: properties.Address || '',
    zip: properties.Zip ?? '',
    coordinates: feature.geometry?.coordinates || null,
    accuracy: properties.Accuracy || '',
    source: properties.Source || '',
    properties,
  };
}

function allClinics() {
  return loadClinicsGeojson().features.map(formatClinic);
}

export function listClinics({ county, query, limit = 25, offset = 0 } = {}) {
  let items = allClinics();

  if (county) {
    const target = normalizeCounty(county);
    items = items.filter((clinic) => normalizeCounty(clinic.county) === target);
  }

  if (query) {
    const needle = String(query).trim().toLowerCase();
    items = items.filter((clinic) => {
      const haystack = [
        clinic.facility,
        clinic.county,
        clinic.city,
        clinic.address,
      ].join(' ').toLowerCase();
      return haystack.includes(needle);
    });
  }

  items.sort((a, b) => a.facility.localeCompare(b.facility));

  return {
    total: items.length,
    offset,
    limit,
    items: items.slice(offset, offset + limit),
  };
}

export function getClinicById(id) {
  const target = Number(id);
  return allClinics().find((clinic) => Number(clinic.id) === target) || null;
}

export function clinicsByCounty(county) {
  const result = listClinics({ county, limit: 500, offset: 0 });
  const counties = new Set(result.items.map((clinic) => clinic.county));
  return {
    county: county || null,
    count: result.total,
    counties: [...counties],
    clinics: result.items.map((clinic) => ({
      id: clinic.id,
      facility: clinic.facility,
      city: clinic.city,
      county: clinic.county,
      coordinates: clinic.coordinates,
      accuracy: clinic.accuracy,
    })),
  };
}

export function clinicsInBounds({ west, south, east, north, limit = 100 } = {}) {
  const bounds = {
    west: Number(west),
    south: Number(south),
    east: Number(east),
    north: Number(north),
  };

  if (Object.values(bounds).some((value) => Number.isNaN(value))) {
    throw new Error('west, south, east, and north must be numbers');
  }

  const items = allClinics().filter((clinic) => {
    const [lng, lat] = clinic.coordinates || [];
    if (lng == null || lat == null) return false;
    return lng >= bounds.west && lng <= bounds.east && lat >= bounds.south && lat <= bounds.north;
  });

  return {
    bounds,
    total: items.length,
    clinics: items.slice(0, limit).map((clinic) => ({
      id: clinic.id,
      facility: clinic.facility,
      city: clinic.city,
      county: clinic.county,
      coordinates: clinic.coordinates,
      accuracy: clinic.accuracy,
    })),
  };
}
