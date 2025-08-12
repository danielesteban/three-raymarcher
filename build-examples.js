import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const version = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'))).version;

fs.mkdirSync(path.join(__dirname, 'dist'));
fs.readdirSync(path.join(__dirname, 'examples')).forEach((example) => (
  fs.writeFileSync(
    path.join(__dirname, 'dist', example),
    fs.readFileSync(path.resolve(__dirname, 'examples', example), 'utf8')
      .replace(
        '"three-raymarcher": "../module.js"',
        `"three-raymarcher": "https://cdn.jsdelivr.net/npm/three-raymarcher@${version}/module.js"`,
      )
  )
));
