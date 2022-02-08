precision highp int;
precision highp float;

out vec3 ray;
in vec3 position;
uniform vec2 aspect;
uniform vec3 camera;
uniform mat4 viewMatrix;

void main() {
  gl_Position = vec4(position.xy, 0, 1);
  vec2 uv = position.xy / vec2(1.0, aspect.y);
  float cameraDistance = camera.x * aspect.x;
  ray = normalize(vec3(uv, -cameraDistance) * mat3(viewMatrix));
}
