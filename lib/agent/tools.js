import {
  clinicsByCounty,
  clinicsInBounds,
  getClinicById,
  listClinics,
} from '../data/clinics.js';
import {
  getNetworkNodes,
  getNetworkSummary,
  getResearchBrief,
  getSocialGraphSummary,
  searchDocs,
} from '../data/docs.js';

export const toolDefinitions = [
  {
    type: 'function',
    function: {
      name: 'listClinics',
      description: 'List Washington rural health clinics with optional county or text filter.',
      parameters: {
        type: 'object',
        properties: {
          county: { type: 'string', description: 'County name filter' },
          query: { type: 'string', description: 'Search facility, city, address, or county' },
          limit: { type: 'integer', minimum: 1, maximum: 100 },
          offset: { type: 'integer', minimum: 0 },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getClinicById',
      description: 'Get one clinic record by OBJECTID.',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
        },
        required: ['id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'clinicsByCounty',
      description: 'Aggregate clinics for a Washington county.',
      parameters: {
        type: 'object',
        properties: {
          county: { type: 'string' },
        },
        required: ['county'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'clinicsInBounds',
      description: 'List clinics within a lat/lng bounding box.',
      parameters: {
        type: 'object',
        properties: {
          west: { type: 'number' },
          south: { type: 'number' },
          east: { type: 'number' },
          north: { type: 'number' },
          limit: { type: 'integer', minimum: 1, maximum: 200 },
        },
        required: ['west', 'south', 'east', 'north'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getNetworkSummary',
      description: 'Get rural clinic network summary rows from project CSV research.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Optional network name or county filter' },
          limit: { type: 'integer', minimum: 1, maximum: 50 },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getNetworkNodes',
      description: 'Get clinic nodes for a network or county from network CSV research.',
      parameters: {
        type: 'object',
        properties: {
          networkName: { type: 'string' },
          county: { type: 'string' },
          limit: { type: 'integer', minimum: 1, maximum: 100 },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getResearchBrief',
      description: 'Read sections from the farmworker social graph research brief markdown.',
      parameters: {
        type: 'object',
        properties: {
          section: { type: 'string', description: 'Optional markdown heading to extract' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getSocialGraphSummary',
      description: 'Read the social graph research summary markdown.',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'searchDocs',
      description: 'Keyword search across server-side project markdown and CSV docs.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string' },
          limit: { type: 'integer', minimum: 1, maximum: 30 },
        },
        required: ['query'],
      },
    },
  },
];

export async function executeTool(name, args) {
  switch (name) {
    case 'listClinics':
      return listClinics(args);
    case 'getClinicById':
      return getClinicById(args.id);
    case 'clinicsByCounty':
      return clinicsByCounty(args.county);
    case 'clinicsInBounds':
      return clinicsInBounds(args);
    case 'getNetworkSummary':
      return getNetworkSummary(args);
    case 'getNetworkNodes':
      return getNetworkNodes(args);
    case 'getResearchBrief':
      return getResearchBrief(args);
    case 'getSocialGraphSummary':
      return getSocialGraphSummary();
    case 'searchDocs':
      return searchDocs(args);
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
