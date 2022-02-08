import { Mesh, Vector3, PlaneGeometry, WebGLRenderTarget, DepthTexture, RawShaderMaterial, LessDepth, GLSL3, Vector2, Math as Math$1 } from 'three';

var raymarcherFragment = "precision highp float;\n\nstruct Entity {\n  vec3 color;\n  vec3 position;\n  vec3 scale;\n  int shape;\n};\n\nstruct SDF {\n  vec3 color;\n  float distance;\n};\n\nout vec4 fragColor;\nin vec3 ray;\nuniform vec3 camera;\nuniform vec3 cameraForward;\nuniform vec3 cameraPosition;\nuniform vec3 lightDirection;\nuniform Entity entities[MAX_ENTITIES];\n\nfloat sdBox(const in vec3 p, const in vec3 r) {\n  vec3 q = abs(p)-r;\n  return length(max(q,0.0))+min(max(q.x,max(q.y,q.z)),0.0);\n}\n\nfloat sdEllipsoid(const in vec3 p, const in vec3 r) {\n  float k0 = length(p/r);\n  float k1 = length(p/(r*r));\n  return k0*(k0-1.0)/k1;\n}\n\nSDF sdEntity(const in vec3 p, const in Entity e) {\n  switch (e.shape) {\n    default:\n    case 0:\n      return SDF(e.color, sdBox(p - e.position, e.scale * 0.5 - vec3(0.1)) - 0.1);\n    case 1:\n      return SDF(e.color, sdEllipsoid(p - e.position, e.scale * 0.5));\n  }\n}\n\nSDF opSmoothUnion(const in SDF a, const in SDF b, const in float k) {\n  float h = clamp(0.5 + 0.5 * (b.distance - a.distance) / k, 0.0, 1.0);\n  return SDF(\n    mix(b.color, a.color, h),\n    mix(b.distance, a.distance, h) - k*h*(1.0-h)\n  );\n}\n\nSDF map(const in vec3 p) {\n  SDF scene = sdEntity(p, entities[0]);\n  for (int i = 1; i < MAX_ENTITIES; i++) {\n    scene = opSmoothUnion(scene, sdEntity(p, entities[i]), 0.5);\n  }\n  return scene;\n}\n\nvec3 getNormal(const in vec3 p) {\n  const vec2 o = vec2(0.01, 0);\n  return normalize(\n    map(p).distance - vec3(\n      map(p - o.xyy).distance,\n      map(p - o.yxy).distance,\n      map(p - o.yyx).distance\n    )\n  );\n}\n\nfloat getDirectLight(const in vec3 position, const in vec3 normal) {\n  vec3 direction = normalize(-lightDirection);\n  vec3 halfway = normalize(direction + normalize(cameraPosition - position));\n  const float ambient = 0.1;\n  float diffuse = max(dot(direction, normal), 0.0) * 0.7;\n  float specular = pow(max(dot(normal, halfway), 0.0), 32.0) * 0.3;\n  return ambient + diffuse + specular;\n}\n\nvec4 LinearTosRGB(const in vec4 value) {\n  return vec4(mix(pow(value.rgb, vec3(0.41666)) * 1.055 - vec3(0.055), value.rgb * 12.92, vec3(lessThanEqual(value.rgb, vec3(0.0031308)))), value.a);\n}\n\nvoid main() {\n  float distance;\n  vec3 position = cameraPosition;\n  SDF step = SDF(vec3(0.0), MAX_DISTANCE);\n  for (\n    int iterations = 0;\n    step.distance > MIN_DISTANCE && distance < MAX_DISTANCE && iterations < MAX_ITERATIONS;\n    iterations++\n  ) {\n    step = map(position);\n    position += ray * step.distance;\n    distance += step.distance;\n  }\n  if (step.distance > MIN_DISTANCE) {\n    discard;\n  }\n  position -= ray * MIN_DISTANCE;\n  float light = getDirectLight(position, getNormal(position));\n  fragColor = clamp(LinearTosRGB(vec4(step.color * light, 1.0)), 0.0, 1.0);\n  float depth = camera.y + camera.z / (-distance * dot(cameraForward, ray));\n  gl_FragDepth = (gl_DepthRange.diff * depth + gl_DepthRange.near + gl_DepthRange.far) / 2.0;\n}\n";

var raymarcherVertex = "out vec3 ray;\nin vec3 position;\nuniform vec2 aspect;\nuniform vec3 camera;\nuniform mat4 viewMatrix;\n\nvoid main() {\n  gl_Position = vec4(position.xy, 0, 1);\n  vec2 uv = position.xy / vec2(1.0, aspect.y);\n  float cameraDistance = camera.x * aspect.x;\n  ray = normalize(vec3(uv, -cameraDistance) * mat3(viewMatrix));\n}\n";

var screenFragment = "precision highp float;\n\nout vec4 fragColor;\nin vec2 fragUV;\nuniform sampler2D colorTexture;\nuniform sampler2D depthTexture;\n\nvoid main() {\n  fragColor = texture(colorTexture, fragUV);\n  gl_FragDepth = texture(depthTexture, fragUV).r;\n}\n";

var screenVertex = "out vec2 fragUV;\nin vec3 position;\n\nvoid main() {\n  fragUV = position.xy * 0.5 + 0.5;\n  gl_Position = vec4(position.xy, 0, 1);\n}\n";

class Raymarcher extends Mesh {
  constructor({
    entities,
    lightDirection = new Vector3(-1.0, -1.0, -1.0),
    resolution = 1,
  }) {
    const geometry = new PlaneGeometry(2, 2, 1, 1);
    geometry.deleteAttribute('normal');
    geometry.deleteAttribute('uv');
    const target = new WebGLRenderTarget(
      1, 1, { depthTexture: new DepthTexture() }
    );
    super(
      geometry,
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
      },
      uniforms: {
        aspect: { value: new Vector2() },
        camera: { value: new Vector3() },
        cameraForward: { value: new Vector3() },
        lightDirection: { value: lightDirection },
        entities: {
          value: entities,
          properties: {
            color: {},
            position: {},
            scale: {},
            shape: {},
          },
        },
      },
    });
    this.userData = {
      entities,
      material,
      mesh: new Mesh(geometry, material),
      resolution,
      size: new Vector2(),
      target,
    };
    this.matrixAutoUpdate = this.userData.mesh.matrixAutoUpdate = false;
    this.frustumCulled = this.userData.mesh.frustumCulled = false;
  }

  dispose() {
    const { material, geometry, userData } = this;
    material.dispose();
    geometry.dispose();
    userData.material.dispose();
    userData.target.dispose();
    userData.target.depthTexture.dispose();
    userData.target.texture.dispose();
  }

  onBeforeRender(renderer, s, camera) {
    const { userData: { entities, material: { defines, uniforms }, mesh, resolution, size, target } } = this;
    defines.MAX_ENTITIES = `${entities.length}`;
    renderer.getDrawingBufferSize(size).multiplyScalar(resolution);
    if (size.x !== target.width || size.y !== target.height) {
      const { near: zNear, far: zFar, fov } = camera;
      target.setSize(size.x, size.y);
      uniforms.aspect.value.set(
        size.y / size.x,
        size.x / size.y
      );
      uniforms.camera.value.set(
        1.0 / Math.tan(Math$1.degToRad(fov) / 2.0),
        (zFar + zNear) / (zFar - zNear),
        (2 * zFar * zNear) / (zFar - zNear)
      );
    }
    camera.getWorldDirection(uniforms.cameraForward.value);
    const currentRenderTarget = renderer.getRenderTarget();
    const currentXrEnabled = renderer.xr.enabled;
    const currentShadowAutoUpdate = renderer.shadowMap.autoUpdate;
    renderer.xr.enabled = false;
    renderer.shadowMap.autoUpdate = false;
    renderer.setRenderTarget(target);
    renderer.state.buffers.depth.setMask(true);
    if (!renderer.autoClear) renderer.clear();
    renderer.render(mesh, camera);
    renderer.xr.enabled = currentXrEnabled;
    renderer.shadowMap.autoUpdate = currentShadowAutoUpdate;
    renderer.setRenderTarget(currentRenderTarget);
    if (camera.viewport) renderer.state.viewport(camera.viewport);
  }
}

Raymarcher.shapes = {
  box: 0,
  sphere: 1, 
};

export { Raymarcher as default };
