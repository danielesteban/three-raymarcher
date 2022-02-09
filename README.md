[three-raymarcher](https://github.com/danielesteban/three-raymarcher)
[![npm-version](https://img.shields.io/npm/v/three-raymarcher.svg)](https://www.npmjs.com/package/three-raymarcher)
==

### Examples

 * [glitch.com/~three-raymarcher](https://glitch.com/edit/#!/three-raymarcher)

### Installation

```bash
npm i three-raymarcher
```

### Basic usage

```js
import {
  Color, PerspectiveCamera, Quaternion, Scene, Vector3, WebGLRenderer
} from 'three';
import Raymarcher from 'three-raymarcher';

const aspect = window.innerWidth / window.innerHeight;
const camera = new PerspectiveCamera(70, aspect, 0.01, 1000);
const renderer = new WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const scene = new Scene();
const raymarcher = new Raymarcher({
  entities: [
    {
      color: new Color(0x0000FF),
      position: new Vector3(-1.5, 0, -4),
      rotation: new Quaternion(0, 0, 0, 1),
      scale: new Vector3(1, 1, 1),
      shape: Raymarcher.shapes.box,
    },
    {
      color: new Color(0x00FF00),
      position: new Vector3(0, 0, -4),
      rotation: new Quaternion(0, 0, 0, 1),
      scale: new Vector3(0.5, 1, 0.5),
      shape: Raymarcher.shapes.capsule,
    },
    {
      color: new Color(0xFF0000),
      position: new Vector3(1.5, 0, -4),
      rotation: new Quaternion(0, 0, 0, 1),
      scale: new Vector3(1, 1, 1),
      shape: Raymarcher.shapes.sphere,
    }
  ],
});
scene.add(raymarcher);

renderer.setAnimationLoop(() => (
  renderer.render(scene, camera)
));
```

### Module dev environment

```bash
# clone this repo
git clone https://github.com/danielesteban/three-raymarcher.git
cd three-raymarcher
# install dependencies
npm install
# start the environment:
npm start
# open http://localhost:8080/example in your browser
```
