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
copyFileSync(join(root, 'farmworker-research.html'), join(dist, 'farmworker-research.html'));
copyFileSync(join(root, 'employer-payer-rebuttal.html'), join(dist, 'employer-payer-rebuttal.html'));
copyFileSync(join(root, 'progressive-eastern-wa-employers.html'), join(dist, 'progressive-eastern-wa-employers.html'));
mkdirSync(join(dist, 'content'), { recursive: true });
copyFileSync(
  join(root, 'docs/progressive-eastern-wa-employers.md'),
  join(dist, 'content/progressive-eastern-wa-employers.md')
);
copyFileSync(join(root, 'employer-payer-pilot.html'), join(dist, 'employer-payer-pilot.html'));
copyFileSync(
  join(root, 'docs/employer-payer-pilot.md'),
  join(dist, 'content/employer-payer-pilot.md')
);
copyFileSync(join(root, 'wa-rural-telehealth-operator.html'), join(dist, 'wa-rural-telehealth-operator.html'));
copyFileSync(
  join(root, 'docs/wa-rural-telehealth-operator.md'),
  join(dist, 'content/wa-rural-telehealth-operator.md')
);
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
