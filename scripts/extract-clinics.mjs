import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const source = join(root, 'rural-health-clinics-wa-map.html');
const target = join(root, 'data', 'wa-rural-health-clinics.geojson');

const html = readFileSync(source, 'utf8');
const marker = 'const geojson = ';
const start = html.indexOf(marker);
if (start === -1) {
  throw new Error('Could not find embedded geojson in map HTML');
}

let index = start + marker.length;
while (html[index] === ' ') index += 1;

if (html[index] !== '{') {
  throw new Error('Unexpected geojson format');
}

let depth = 0;
let end = index;
for (; end < html.length; end += 1) {
  const char = html[end];
  if (char === '{') depth += 1;
  if (char === '}') {
    depth -= 1;
    if (depth === 0) {
      end += 1;
      break;
    }
  }
}

const geojson = JSON.parse(html.slice(index, end));
mkdirSync(join(root, 'data'), { recursive: true });
writeFileSync(target, `${JSON.stringify(geojson, null, 2)}\n`);
console.log(`Wrote ${geojson.features.length} clinics to ${target}`);
