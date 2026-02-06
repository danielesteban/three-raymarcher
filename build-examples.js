import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const version = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'))).version;

fs.mkdirSync(path.join(__dirname, 'dist'));
fs.readdirSync(path.join(__dirname, 'examples'), { withFileTypes: true }).forEach((entry) => {
  if (entry.isDirectory()) {
    fs.cpSync(
      path.resolve(__dirname, 'examples', entry.name),
      path.join(__dirname, 'dist', entry.name),
      { recursive: true }
    );
  } else {
    fs.writeFileSync(
      path.join(__dirname, 'dist', entry.name),
      fs.readFileSync(path.resolve(__dirname, 'examples', entry.name), 'utf8')
        .replace(
          '"three-raymarcher": "../module.js"',
          `"three-raymarcher": "https://cdn.jsdelivr.net/npm/three-raymarcher@${version}/module.js"`,
        )
    );
  }
});
