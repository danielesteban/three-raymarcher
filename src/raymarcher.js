import {
  BoxGeometry,
  Color,
  CylinderGeometry,
  DepthTexture,
  IcosahedronGeometry,
  LessDepth,
  GLSL3,
  Math as ThreeMath,
  Mesh,
  PlaneGeometry,
  RawShaderMaterial,
  Vector2,
  Vector3,
  Vector4,
  WebGLRenderTarget,
} from 'three';
import raymarcherFragment from './shaders/raymarcher.frag';
import raymarcherVertex from './shaders/raymarcher.vert';
import screenFragment from './shaders/screen.frag';
import screenVertex from './shaders/screen.vert';

const _colliders = [
  new Mesh(new BoxGeometry(1, 1, 1)),
  new Mesh(new CylinderGeometry(0.5, 0.5, 1)),
  new Mesh(new IcosahedronGeometry(0.5, 2)),
];
const _size = new Vector2();

class Raymarcher extends Mesh {
  constructor({
    blending = 0.5,
    entities = [{ color: new Color(), position: new Vector3(), rotation: new Vector4(), scale: new Vector3() }],
    envMap = null,
    envMapIntensity = 0.3,
    lightDirection = new Vector3(-1, -1, -1),
    lightIntensity = 0.7,
    resolution = 1,
  } = {}) {
    const plane = new PlaneGeometry(2, 2, 1, 1);
    plane.deleteAttribute('normal');
    plane.deleteAttribute('uv');
    const target = new WebGLRenderTarget(1, 1, { depthTexture: new DepthTexture() });
    super(
      plane,
      new RawShaderMaterial({
        depthFunc: LessDepth,
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
      glslVersion: GLSL3,
      vertexShader: raymarcherVertex,
      fragmentShader: raymarcherFragment,
      defines: {
        MIN_DISTANCE: '0.01',
        MAX_DISTANCE: '1000.0',
        MAX_ENTITIES: `${entities.length}`,
        MAX_ITERATIONS: '256',
        ENVMAP_TYPE_CUBE_UV: !!envMap,
      },
      uniforms: {
        aspect: { value: new Vector2() },
        blending: { value: blending },
        camera: { value: new Vector3() },
        cameraDirection: { value: new Vector3() },
        entities: {
          value: entities,
          properties: {
            color: {},
            position: {},
            rotation: {},
            scale: {},
            shape: {},
          },
        },
        envMap: { value: envMap },
        envMapIntensity: { value: envMapIntensity },
        lightDirection: { value: lightDirection },
        lightIntensity: { value: lightIntensity },
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
      get entities() {
        return uniforms.entities.value;
      },
      set entities(value) {
        uniforms.entities.value = value;
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
      get lightDirection() {
        return uniforms.lightDirection.value;
      },
      set lightDirection(value) {
        uniforms.lightDirection.value = value;
      },
      get lightIntensity() {
        return uniforms.lightIntensity.value;
      },
      set lightIntensity(value) {
        uniforms.lightIntensity.value = value;
      },
      raymarcher: new Mesh(plane, material),
      resolution,
      target,
    };
    this.matrixAutoUpdate = this.userData.raymarcher.matrixAutoUpdate = false;
    this.frustumCulled = this.userData.raymarcher.frustumCulled = false;
  }

  copy(source) {
    const { userData } = this;
    const { userData: { blending, entities, envMap, envMapIntensity, lightDirection, lightIntensity, resolution } } = source;
    userData.blending = blending;
    userData.entities = entities.map(({ color, position, rotation, scale, shape }) => ({
      color: color.clone(),
      position: position.clone(),
      rotation: rotation.clone(),
      scale: scale.clone(),
      shape: shape,
    }));
    userData.envMap = envMap;
    userData.envMapIntensity = envMapIntensity;
    userData.lightDirection = lightDirection.clone();
    userData.lightIntensity = lightIntensity;
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

  onBeforeRender(renderer, s, camera) {
    const { userData: { entities, resolution, raymarcher, target } } = this;
    const { material: { defines, uniforms } } = raymarcher;
    if (defines.MAX_ENTITIES !== `${entities.length}`) {
      defines.MAX_ENTITIES = `${entities.length}`;
      raymarcher.material.needsUpdate = true;
    }
    renderer.getDrawingBufferSize(_size).multiplyScalar(resolution).floor();
    if (target.width !== _size.x || target.height !== _size.y) {
      target.setSize(_size.x, _size.y);
      uniforms.aspect.value.set(
        _size.y / _size.x,
        _size.x / _size.y
      );
      const { near, far, fov } = camera;
      uniforms.camera.value.set(
        1.0 / Math.tan(ThreeMath.degToRad(fov) / 2.0),
        (far + near) / (far - near),
        (2 * far * near) / (far - near)
      );
    }
    camera.getWorldDirection(uniforms.cameraDirection.value);
    const currentRenderTarget = renderer.getRenderTarget();
    const currentXrEnabled = renderer.xr.enabled;
    const currentShadowAutoUpdate = renderer.shadowMap.autoUpdate;
    renderer.xr.enabled = false;
    renderer.shadowMap.autoUpdate = false;
    renderer.setRenderTarget(target);
    renderer.state.buffers.depth.setMask(true);
    if (!renderer.autoClear) renderer.clear();
    renderer.render(raymarcher, camera);
    renderer.xr.enabled = currentXrEnabled;
    renderer.shadowMap.autoUpdate = currentShadowAutoUpdate;
    renderer.setRenderTarget(currentRenderTarget);
    if (camera.viewport) renderer.state.viewport(camera.viewport);
  }

  raycast(raycaster, intersects) {
    const { userData: { entities } } = this;
    entities.forEach((entity, entityId) => {
      const { position, rotation, scale, shape } = entity;
      const collider = _colliders[shape];
      collider.position.copy(position);
      collider.quaternion.copy(rotation);
      collider.scale.copy(scale);
      if (shape === Raymarcher.shapes.capsule) {
        collider.scale.z = collider.scale.x;
      }
      collider.updateMatrixWorld();
      const entityIntersects = [];
      collider.raycast(raycaster, entityIntersects);
      entityIntersects.forEach((intersect) => {
        intersect.entityId = entityId;
        intersect.entity = entity;
        intersect.object = this;
        intersects.push(intersect);
      });
    });
  }
}

Raymarcher.shapes = {
  box: 0,
  capsule: 1,
  sphere: 2,
};

export default Raymarcher;
