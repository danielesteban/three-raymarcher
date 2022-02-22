import {
  BoxGeometry,
  Color,
  CylinderGeometry,
  DepthTexture,
  Frustum,
  IcosahedronGeometry,
  GLSL3,
  Math as ThreeMath,
  Matrix4,
  Mesh,
  PlaneGeometry,
  RawShaderMaterial,
  Sphere,
  UnsignedShortType,
  Vector2,
  Vector3,
  WebGLRenderTarget,
} from 'three';
import raymarcherFragment from './shaders/raymarcher.frag';
import raymarcherVertex from './shaders/raymarcher.vert';
import screenFragment from './shaders/screen.frag';
import screenVertex from './shaders/screen.vert';

const _bounds = [];
const _colliders = [
  new BoxGeometry(1, 1, 1),
  new CylinderGeometry(0.5, 0.5, 1),
  new IcosahedronGeometry(0.5, 2),
].map((geometry) => {
  geometry.computeBoundingSphere();
  return new Mesh(geometry);
});
const _frustum = new Frustum();
const _position = new Vector3();
const _projection = new Matrix4();
const _size = new Vector2();
const _sphere = new Sphere();

class Raymarcher extends Mesh {
  constructor({
    blending = 0.5,
    conetracing = false,
    envMap = null,
    envMapIntensity = 1,
    layers = [],
    resolution = 1,
  } = {}) {
    const plane = new PlaneGeometry(2, 2, 1, 1);
    plane.deleteAttribute('normal');
    plane.deleteAttribute('uv');
    const target = new WebGLRenderTarget(1, 1, { depthTexture: new DepthTexture(1, 1, UnsignedShortType) });
    super(
      plane,
      new RawShaderMaterial({
        glslVersion: GLSL3,
        vertexShader: screenVertex,
        fragmentShader: screenFragment,
        uniforms: {
          colorTexture: { value: target.texture },
          depthTexture: { value: target.depthTexture },
        },
      })
    );
    const material = new RawShaderMaterial({
      transparent: !!conetracing,
      glslVersion: GLSL3,
      vertexShader: raymarcherVertex,
      fragmentShader: raymarcherFragment,
      defines: {
        CONETRACING: !!conetracing,
        ENVMAP_TYPE_CUBE_UV: !!envMap,
        MAX_ENTITIES: 0,
        MAX_DISTANCE: '1000.0',
        MAX_ITERATIONS: 200,
        MIN_COVERAGE: '0.02',
        MIN_DISTANCE: '0.05',
        NUM_LIGHTS: 0,
      },
      uniforms: {
        blending: { value: blending },
        bounds: { value: { center: new Vector3(), radius: 0 } },
        cameraDirection: { value: new Vector3() },
        cameraFar: { value: 0 },
        cameraFov: { value: 0 },
        cameraNear: { value: 0 },
        resolution: { value: new Vector2() },
        envMap: { value: envMap },
        envMapIntensity: { value: envMapIntensity },
        lights: {
          value: [],
          properties: {
            color: {},
            direction: {},
          },
        },
        numEntities: { value: 0 },
        entities: {
          value: [],
          properties: {
            color: {},
            operation: {},
            position: {},
            rotation: {},
            scale: {},
            shape: {},
          },
        },
      },
    });
    const { defines, uniforms } = material;
    this.userData = {
      get blending() {
        return uniforms.blending.value;
      },
      set blending(value) {
        uniforms.blending.value = value;
      },
      get conetracing() {
        return defines.CONETRACING;
      },
      set conetracing(value) {
        if (defines.CONETRACING !== !!value) {
          defines.CONETRACING = !!value;
          material.transparent = !!value;
          material.needsUpdate = true;
        }
      },
      get envMap() {
        return uniforms.envMap.value;
      },
      set envMap(value) {
        uniforms.envMap.value = value;
        if (defines.ENVMAP_TYPE_CUBE_UV !== !!value) {
          defines.ENVMAP_TYPE_CUBE_UV = !!value;
          material.needsUpdate = true;
        }
      },
      get envMapIntensity() {
        return uniforms.envMapIntensity.value;
      },
      set envMapIntensity(value) {
        uniforms.envMapIntensity.value = value;
      },
      layers,
      raymarcher: new Mesh(plane, material),
      resolution,
      target,
    };
    this.matrixAutoUpdate = this.userData.raymarcher.matrixAutoUpdate = false;
    this.frustumCulled = this.userData.raymarcher.frustumCulled = false;
  }

  copy(source) {
    const { userData } = this;
    const { userData: { blending, conetracing, envMap, envMapIntensity, layers, resolution } } = source;
    userData.blending = blending;
    userData.conetracing = conetracing;
    userData.envMap = envMap;
    userData.envMapIntensity = envMapIntensity;
    userData.layers = layers.map((layer) => layer.map(Raymarcher.cloneEntity));
    userData.resolution = resolution;
    return this;
  }

  dispose() {
    const { material, geometry, userData: { raymarcher, target } } = this;
    material.dispose();
    geometry.dispose();
    raymarcher.material.dispose();
    target.dispose();
    target.depthTexture.dispose();
    target.texture.dispose();
  }

  onBeforeRender(renderer, scene, camera) {
    const { userData: { layers, resolution, raymarcher, target } } = this;
    const { material: { defines, uniforms } } = raymarcher;

    camera.getWorldDirection(uniforms.cameraDirection.value);
    uniforms.cameraFar.value = camera.far;
    uniforms.cameraFov.value = ThreeMath.degToRad(camera.fov);
    uniforms.cameraNear.value = camera.near;
    
    _frustum.setFromProjectionMatrix(
      _projection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
    );
    camera.getWorldPosition(_position);
    const sortedLayers = layers
      .reduce((layers, entities, layer) => {
        if (defines.MAX_ENTITIES < entities.length) {
          defines.MAX_ENTITIES = entities.length;
          uniforms.entities.value = entities.map(Raymarcher.cloneEntity);
          raymarcher.material.needsUpdate = true;
        }
        const bounds = Raymarcher.getLayerBounds(layer);
        entities.forEach((entity) => {
          const {
            geometry: { boundingSphere },
            matrixWorld,
          } = Raymarcher.getEntityCollider(entity);
          _sphere.copy(boundingSphere).applyMatrix4(matrixWorld);
          if (bounds.isEmpty()) {
            bounds.copy(_sphere);
          } else {
            bounds.union(_sphere);
          }
        });
        if (_frustum.intersectsSphere(bounds)) {
          layers.push({
            bounds,
            distance: bounds.center.distanceTo(_position),
            entities,
          });
        }
        return layers;
      }, [])
      .sort(({ distance: a }, { distance: b }) => defines.CONETRACING ? (b - a) : (a - b));

    const lights = [];
    scene.traverseVisible((light) => {
      if (light.isDirectionalLight && light.layers.test(camera.layers)) {
        lights.push(light);
      }
    });
    if (defines.NUM_LIGHTS !== lights.length) {
      defines.NUM_LIGHTS = lights.length;
      uniforms.lights.value = lights.map(() => ({ color: new Color(), direction: new Vector3() }));
      raymarcher.material.needsUpdate = true;
    }
    lights.forEach((light, i) => {
      const uniform = uniforms.lights.value[i];
      uniform.color.copy(light.color).multiplyScalar(light.intensity);
      light.target.getWorldPosition(uniform.direction)
        .sub(light.getWorldPosition(_position));
    });

    renderer.getDrawingBufferSize(_size).multiplyScalar(resolution).floor();
    if (target.width !== _size.x || target.height !== _size.y) {
      target.setSize(_size.x, _size.y);
      uniforms.resolution.value.copy(_size);
    }

    const currentAutoClear = renderer.autoClear;
    const currentRenderTarget = renderer.getRenderTarget();
    const currentXrEnabled = renderer.xr.enabled;
    const currentShadowAutoUpdate = renderer.shadowMap.autoUpdate;
    renderer.autoClear = false;
    renderer.xr.enabled = false;
    renderer.shadowMap.autoUpdate = false;
    renderer.setRenderTarget(target);
    renderer.state.buffers.depth.setMask(true);

    renderer.clear();
    sortedLayers.forEach(({ bounds, entities }) => {
      uniforms.bounds.value.center.copy(bounds.center);
      uniforms.bounds.value.radius = bounds.radius;
      uniforms.numEntities.value = entities.length;
      entities.forEach(({ color, operation, position, rotation, scale, shape }, i) => {
        const uniform = uniforms.entities.value[i];
        uniform.color.copy(color);
        uniform.operation = operation;
        uniform.position.copy(position);
        uniform.rotation.copy(rotation);
        uniform.scale.copy(scale);
        uniform.shape = shape;
      });
      renderer.render(raymarcher, camera);
    });

    renderer.autoClear = currentAutoClear;
    renderer.xr.enabled = currentXrEnabled;
    renderer.shadowMap.autoUpdate = currentShadowAutoUpdate;
    renderer.setRenderTarget(currentRenderTarget);
    if (camera.viewport) renderer.state.viewport(camera.viewport);
  }

  raycast(raycaster, intersects) {
    const { userData: { layers } } = this;
    layers.forEach((layer, layerId) => layer.forEach((entity, entityId) => {
      const entityIntersects = [];
      Raymarcher.getEntityCollider(entity).raycast(raycaster, entityIntersects);
      entityIntersects.forEach((intersect) => {
        intersect.entity = entity;
        intersect.entityId = entityId;
        intersect.layer = layer;
        intersect.layerId = layerId;
        intersect.object = this;
        intersects.push(intersect);
      });
    }));
  }

  static cloneEntity({ color, operation, position, rotation, scale, shape }) {
    return {
      color: color.clone(),
      operation,
      position: position.clone(),
      rotation: rotation.clone(),
      scale: scale.clone(),
      shape,
    };
  }

  static getEntityCollider({ position, rotation, scale, shape }) {
    const collider = _colliders[shape];
    collider.position.copy(position);
    collider.quaternion.copy(rotation);
    collider.scale.copy(scale);
    if (shape === Raymarcher.shapes.capsule) {
      collider.scale.z = collider.scale.x;
    }
    collider.updateMatrixWorld();
    return collider;
  }

  static getLayerBounds(layer) {
    if (!_bounds[layer]) {
      _bounds[layer] = new Sphere();
    }
    return _bounds[layer].makeEmpty();
  }
}

Raymarcher.operations = {
  union: 0,
  substraction: 1,
};

Raymarcher.shapes = {
  box: 0,
  capsule: 1,
  sphere: 2,
};

export default Raymarcher;
