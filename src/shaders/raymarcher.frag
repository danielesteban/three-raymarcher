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
uniform vec3 cameraDirection;
uniform float cameraFar;
uniform float cameraFov;
uniform float cameraNear;
uniform vec3 cameraPosition;
uniform Entity entities[MAX_ENTITIES];
uniform sampler2D envMap;
uniform float envMapIntensity;
#if NUM_LIGHTS > 0
uniform Light lights[NUM_LIGHTS];
#endif
uniform int numEntities;
uniform vec2 resolution;

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

vec3 getNormal(const in vec3 p, const in float d) {
  const vec2 o = vec2(0.001, 0);
  return normalize(
    d - vec3(
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

#ifdef CONETRACING
void march(inout vec4 color, inout float distance) {
  float closest = MAX_DISTANCE;
  float coverage = 1.0;
  float coneRadius = (2.0 * tan(cameraFov / 2.0)) / resolution.y;
  for (int i = 0; i < MAX_ITERATIONS && distance < MAX_DISTANCE; i++) {
    vec3 position = cameraPosition + ray * distance;
    float distanceToBounds = sdSphere(position - bounds.center, bounds.radius);
    if (distanceToBounds > 0.1) {
      distance += distanceToBounds;
    } else {
      SDF step = map(position);
      float cone = coneRadius * distance;
      if (step.distance < cone) {
        if (closest > distance) {
          closest = distance;
        }
        float alpha = smoothstep(cone, -cone, step.distance);
        vec3 pixel = step.color * getLight(position, getNormal(position, step.distance));
        color.rgb += coverage * (alpha * pixel);
        coverage *= (1.0 - alpha);
        if (coverage <= MIN_COVERAGE) {
          break;
        }
      }
      distance += max(abs(step.distance), MIN_DISTANCE);
    }
  }
  distance = closest;
  color.a = 1.0 - (max(coverage - MIN_COVERAGE, 0.0) / (1.0 - MIN_COVERAGE));
}
#else
void march(inout vec4 color, inout float distance) {
  for (int i = 0; i < MAX_ITERATIONS && distance < MAX_DISTANCE; i++) {
    vec3 position = cameraPosition + ray * distance;
    float distanceToBounds = sdSphere(position - bounds.center, bounds.radius);
    if (distanceToBounds > 0.1) {
      distance += distanceToBounds;
    } else {
      SDF step = map(position);
      if (step.distance <= MIN_DISTANCE) {
        color = vec4(step.color * getLight(position, getNormal(position, step.distance)), 1.0);
        break;
      }
      distance += step.distance;
    }
  }
}
#endif

void main() {
  vec4 color = vec4(0.0);
  float distance = cameraNear;
  march(color, distance);
  fragColor = clamp(LinearTosRGB(color), 0.0, 1.0);
  float z = (distance >= MAX_DISTANCE) ? cameraFar : (distance * dot(cameraDirection, ray));
  float ndcDepth = -((cameraFar + cameraNear) / (cameraNear - cameraFar)) + ((2.0 * cameraFar * cameraNear) / (cameraNear - cameraFar)) / z;
  gl_FragDepth = ((gl_DepthRange.diff * ndcDepth) + gl_DepthRange.near + gl_DepthRange.far) / 2.0;
}
