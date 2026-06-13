import { copyFileSync, cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const dist = join(root, 'dist');
const source = join(root, 'rural-health-clinics-wa-map.html');
const target = join(dist, 'rural-health-clinics-wa-map.html');
const token = process.env.MAPBOX_ACCESS_TOKEN?.trim();

mkdirSync(dist, { recursive: true });
cpSync(join(root, 'styles'), join(dist, 'styles'), { recursive: true });
cpSync(join(root, 'js'), join(dist, 'js'), { recursive: true });
copyFileSync(join(root, 'index.html'), join(dist, 'index.html'));
copyFileSync(join(root, 'about.html'), join(dist, 'about.html'));
copyFileSync(join(root, 'login.html'), join(dist, 'login.html'));
copyFileSync(join(root, 'wa-rural-health-clinics-mapbox.png'), join(dist, 'wa-rural-health-clinics-mapbox.png'));

let html = readFileSync(source, 'utf8');
if (token) {
  html = html.replace(
    "const token = new URLSearchParams(location.search).get('access_token') || new URLSearchParams(location.hash.slice(1)).get('access_token');",
    `const token = new URLSearchParams(location.search).get('access_token') || new URLSearchParams(location.hash.slice(1)).get('access_token') || ${JSON.stringify(token)};`
  );
}
writeFileSync(target, html);
