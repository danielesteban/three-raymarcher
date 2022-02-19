precision highp float;
precision highp int;

struct Bounds {
  vec3 center;
  float radius;
};

struct Entity {
  vec3 color;
  int operation;
  vec3 position;
  vec4 rotation;
  vec3 scale;
  int shape;
};

struct Light {
  vec3 color;
  vec3 direction;
};

struct SDF {
  vec3 color;
  float distance;
};

out vec4 fragColor;
in vec3 ray;
uniform float blending;
uniform Bounds bounds;
uniform vec3 camera;
uniform vec3 cameraDirection;
uniform vec3 cameraPosition;
uniform sampler2D envMap;
uniform float envMapIntensity;
#if NUM_LIGHTS > 0
uniform Light lights[NUM_LIGHTS];
#endif
uniform int numEntities;
uniform Entity entities[MAX_ENTITIES];

#define texture2D texture
#include <cube_uv_reflection_fragment>
#include <encodings_pars_fragment>

vec3 applyQuaternion(const in vec3 p, const in vec4 q) {
  return p + 2.0 * cross(-q.xyz, cross(-q.xyz, p) + q.w * p);
}

float sdBox(const in vec3 p, const in vec3 r) {
  vec3 q = abs(p)-r;
  return length(max(q,0.0))+min(max(q.x,max(q.y,q.z)),0.0);
}

float sdCapsule(in vec3 p, const in vec3 r) {
  p.y -= clamp(p.y,-r.y+r.x,r.y-r.x);
  return length(p)-r.x;
}

float sdEllipsoid(const in vec3 p, const in vec3 r) {
  float k0 = length(p/r);
  float k1 = length(p/(r*r));
  return k0*(k0-1.0)/k1;
}

float sdSphere(const in vec3 p, const in float r) {
  return length(p)-r;
}

SDF sdEntity(in vec3 p, const in Entity e) {
  p = applyQuaternion(p - e.position, normalize(e.rotation));
  switch (e.shape) {
    default:
    case 0:
      return SDF(e.color, sdBox(p, e.scale * 0.5 - vec3(0.1)) - 0.1);
    case 1:
      return SDF(e.color, sdCapsule(p, e.scale * 0.5));
    case 2:
      return SDF(e.color, sdEllipsoid(p, e.scale * 0.5));
  }
}

SDF opSmoothUnion(const in SDF a, const in SDF b, const in float k) {
  float h = clamp(0.5 + 0.5 * (b.distance - a.distance) / k, 0.0, 1.0);
  return SDF(
    mix(b.color, a.color, h),
    mix(b.distance, a.distance, h) - k*h*(1.0-h)
  );
}

SDF opSmoothSubtraction(const in SDF a, const in SDF b, const in float k) {
  float h = clamp(0.5 - 0.5 * (a.distance + b.distance) / k, 0.0, 1.0);
  return SDF(
    mix(a.color, b.color, h),
    mix(a.distance, -b.distance, h) + k*h*(1.0-h)
  );
}

SDF map(const in vec3 p) {
  SDF scene = sdEntity(p, entities[0]);
  for (int i = 1, l = min(numEntities, MAX_ENTITIES); i < l; i++) {
    switch (entities[i].operation) {
      default:
      case 0:
        scene = opSmoothUnion(scene, sdEntity(p, entities[i]), blending);
        break;
      case 1:
        scene = opSmoothSubtraction(scene, sdEntity(p, entities[i]), blending);
        break;
    }
  }
  return scene;
}

vec3 getNormal(const in vec3 p) {
  const vec2 o = vec2(0.001, 0);
  return normalize(
    map(p).distance - vec3(
      map(p - o.xyy).distance,
      map(p - o.yxy).distance,
      map(p - o.yyx).distance
    )
  );
}

vec3 getLight(const in vec3 position, const in vec3 normal) {
  #ifdef ENVMAP_TYPE_CUBE_UV
    vec3 light = textureCubeUV(envMap, normal, 1.0).rgb * envMapIntensity;
  #else
    vec3 light = vec3(envMapIntensity);
  #endif
  #if NUM_LIGHTS > 0
    vec3 viewDirection = normalize(cameraPosition - position);
    for (int i = 0; i < NUM_LIGHTS; i++) {
      vec3 direction = normalize(-lights[i].direction);
      vec3 halfway = normalize(direction + viewDirection);
      light += lights[i].color * (
        max(dot(direction, normal), 0.0)
        + pow(max(dot(normal, halfway), 0.0), 32.0)
      );
    }
  #endif
  return light;
}

void main() {
  float distance;
  vec3 position = cameraPosition;
  SDF step = SDF(vec3(0.0), MAX_DISTANCE);
  for (
    int iterations = 0;
    step.distance > MIN_DISTANCE && distance < MAX_DISTANCE && iterations < MAX_ITERATIONS;
    iterations++
  ) {
    float distanceToBounds = sdSphere(position - bounds.center, bounds.radius);
    if (distanceToBounds > MIN_DISTANCE) {
      step.distance = distanceToBounds;
    } else {
      step = map(position);
    }
    position += ray * step.distance;
    distance += step.distance;
  }
  if (step.distance > MIN_DISTANCE) {
    discard;
  }
  vec3 light = getLight(position, getNormal(position));
  fragColor = clamp(LinearTosRGB(vec4(step.color * light, 1.0)), 0.0, 1.0);
  float depth = camera.y + camera.z / (-distance * dot(cameraDirection, ray));
  gl_FragDepth = (gl_DepthRange.diff * depth + gl_DepthRange.near + gl_DepthRange.far) / 2.0;
}
