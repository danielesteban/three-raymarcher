[three-raymarcher](https://github.com/danielesteban/three-raymarcher)
[![npm-version](https://img.shields.io/npm/v/three-raymarcher.svg)](https://www.npmjs.com/package/three-raymarcher)
==

### Examples

 * Animation: [glitch.com/~three-raymarcher](https://glitch.com/edit/#!/three-raymarcher)
 * Interactive: [glitch.com/~three-raymarcher-interactive](https://glitch.com/edit/#!/three-raymarcher-interactive)
 * Transform: [glitch.com/~three-raymarcher-transform](https://glitch.com/edit/#!/three-raymarcher-transform)
 * react-three-fiber: [codesandbox.io/s/three-raymarcher-3xdor](https://codesandbox.io/s/three-raymarcher-3xdor)

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

### Lighting

three-raymarcher uses a DNPBR (definitely not phisically based rendering) lighting model:

##### Indirect Diffuse

 * Assign a CubeUVMap texture to `raymarcher.userData.envMap`
 * You can control the intensity with `raymarcher.userData.envMapIntensity`
 * If you don't set an environment it will use vec3(envMapIntensity) as the ambient light

##### Indirect Specular

Not yet implemented. Coming soon, maybe.

##### Direct Diffuse & Specular

three-raymarcher will automatically use any three.js [DirectionalLight](https://threejs.org/docs/api/en/lights/DirectionalLight) in the scene.

### Raycasting

three-raymarcher supports the three.js [Raycaster](https://threejs.org/docs/api/en/core/Raycaster) out of the box:

```js
const [hit] = raycaster.intersectObject(raymarcher);
if (hit) {
  console.log(hit.entityId); // The index of the intersected entity
  console.log(hit.entity); // A reference to the intersected entity
}
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
# open http://localhost:8080/examples/animation in your browser
```
