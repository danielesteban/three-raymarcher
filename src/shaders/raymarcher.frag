precision highp float;

struct Entity {
  vec3 color;
  vec3 position;
  vec4 rotation;
  vec3 scale;
  int shape;
};

struct SDF {
  vec3 color;
  float distance;
};

out vec4 fragColor;
in vec3 ray;
uniform vec3 camera;
uniform vec3 cameraDirection;
uniform vec3 cameraPosition;
uniform Entity entities[MAX_ENTITIES];
uniform vec3 lightDirection;

vec3 applyQuaternion(const in vec3 p, const in vec4 q) {
  return p + 2.0 * cross(q.xyz, cross(q.xyz, p) + q.w * p);
}

vec4 linearTosRGB(const in vec4 value) {
  return vec4(mix(pow(value.rgb, vec3(0.41666)) * 1.055 - vec3(0.055), value.rgb * 12.92, vec3(lessThanEqual(value.rgb, vec3(0.0031308)))), value.a);
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

SDF map(const in vec3 p) {
  SDF scene = sdEntity(p, entities[0]);
  for (int i = 1; i < MAX_ENTITIES; i++) {
    scene = opSmoothUnion(scene, sdEntity(p, entities[i]), 0.5);
  }
  return scene;
}

vec3 getNormal(const in vec3 p) {
  const vec2 o = vec2(0.01, 0);
  return normalize(
    map(p).distance - vec3(
      map(p - o.xyy).distance,
      map(p - o.yxy).distance,
      map(p - o.yyx).distance
    )
  );
}

float getDirectLight(const in vec3 position, const in vec3 normal) {
  vec3 direction = normalize(-lightDirection);
  vec3 halfway = normalize(direction + normalize(cameraPosition - position));
  const float ambient = 0.1;
  float diffuse = max(dot(direction, normal), 0.0) * 0.7;
  float specular = pow(max(dot(normal, halfway), 0.0), 32.0) * 0.3;
  return ambient + diffuse + specular;
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
    step = map(position);
    position += ray * step.distance;
    distance += step.distance;
  }
  if (step.distance > MIN_DISTANCE) {
    discard;
  }
  float light = getDirectLight(position, getNormal(position));
  fragColor = clamp(linearTosRGB(vec4(step.color * light, 1.0)), 0.0, 1.0);
  float depth = camera.y + camera.z / (-distance * dot(cameraDirection, ray));
  gl_FragDepth = (gl_DepthRange.diff * depth + gl_DepthRange.near + gl_DepthRange.far) / 2.0;
}
