// @builtin(vertex_index)
// @builtin(position)
// @builtin(instance_index)
// @builtin(frag_depth)

// ===== constant =====
const EPSILON         = 1e-8;
const DEFAULT_CLOSEST = 1e9;
const PI              = 3.14159265359;
const BG              = vec3f(0.2, 0.2, 0.2);
const STACK_SIZE      = 128u;
const SCREEN_TRIANGLE = array<vec2f, 3>(
    vec2f(-1.0, -3.0),
    vec2f(3.0, 1.0),
    vec2f(-1.0, 1.0)
);

// ===== struct =====
struct Camera {
    position: vec4f,
    forward : vec4f,
    right   : vec4f,
    up      : vec4f,
    screen  : vec4f
};

struct Ray {
    o: vec3f,
    d: vec3f
}

struct Triangle {
    v0: vec4f,
    v1: vec4f,
    v2: vec4f,
}

struct BVHNode {
    min       : vec3f,
    leftOrFirst: u32,
    max       : vec3f,
    triCount  : u32
}

// ===== binding =====
@group(0) @binding(0)
var<uniform> camera: Camera;

@group(0) @binding(1)
var<storage, read> triangles: array<Triangle>;

@group(0) @binding(2)
var<storage, read> nodes: array<BVHNode>;

// ===== function =====
@vertex
fn vertMain(
    @builtin(vertex_index) vertexIndex: u32
) -> @builtin(position) vec4f {
    return vec4f(SCREEN_TRIANGLE[vertexIndex], 0.0, 1.0);
}

@fragment
fn fragMain(@builtin(position) pos: vec4f) -> @location(0) vec4f {
    let ray = makeRay(pos.xy);
    let color = trace(ray);

    return vec4f(color, 1.0);
}

// ===== helper functions =====
fn trace(ray: Ray) -> vec3f {
    var closest = DEFAULT_CLOSEST;
    var color = BG;
    var stack: array<u32, 128>;
    var stackCount = 0u;
    if (arrayLength(&nodes) == 0u) { return color; }

    stack[stackCount] = 0u;
    stackCount++;

    while (stackCount > 0u) {
        stackCount = stackCount - 1u;
        let nodeIdx = stack[stackCount];
        let node = nodes[nodeIdx];

        let nodeT = rayAabbT(ray, node.min, node.max, closest);
        if (nodeT < 0.0) { continue; }

        if (node.triCount > 0u) {
            let first = node.leftOrFirst;
            let end = first + node.triCount;

            for (var i = first; i < end; i = i + 1u) {
                let tri = triangles[i];
                let t = hitTriangle(ray, tri);

                if (t > 0.0 && t < closest) {
                    closest = t;
                    color = shadeTriangle(tri);
                }
            }
        } else {
            let left = node.leftOrFirst;
            let right = left + 1u;
            let leftNode = nodes[left];
            let rightNode = nodes[right];

            let leftT = rayAabbT(ray, leftNode.min, leftNode.max, closest);
            let rightT = rayAabbT(ray, rightNode.min, rightNode.max, closest);
            let leftHit = leftT >= 0.0;
            let rightHit = rightT >= 0.0;
            
            if (leftHit && rightHit) {
                if (leftT < rightT) {
                    if (stackCount + 1u < STACK_SIZE) {
                        stack[stackCount] = right;
                        stackCount = stackCount + 1u;
                        stack[stackCount] = left;
                        stackCount = stackCount + 1u;
                    }
                } else {
                    if (stackCount + 1u < STACK_SIZE) {
                        stack[stackCount] = left;
                        stackCount = stackCount + 1u;
                        stack[stackCount] = right;
                        stackCount = stackCount + 1u;
                    }
                }
            } else if (leftHit) {
                if (stackCount < STACK_SIZE) {
                    stack[stackCount] = left;
                    stackCount = stackCount + 1u;
                }
            } else if (rightHit) {
                if (stackCount < STACK_SIZE) {
                    stack[stackCount] = right;
                    stackCount = stackCount + 1u;
                }
            }

        }
    }

    return color;
}

fn shadeTriangle(t: Triangle) -> vec3f {
    let v0 = t.v0.xyz;
    let v1 = t.v1.xyz;
    let v2 = t.v2.xyz;

    let normal = normalize(cross(v1 - v0, v2 - v0));
    let lightDirection = normalize(vec3f(0.5, 0.8, 1.0));
    let diffuse = max(dot(normal, lightDirection), 0.0);
    let baseColor = vec3f(0.9, 0.35, 0.2);

    return baseColor * (0.2 + 0.8 * diffuse);
}

// EPSILON checked
fn rayAabbT(ray: Ray, mn: vec3f, mx: vec3f, tmax: f32) -> f32 {
    let invD = 1.0 / ray.d;
    let t0 = (mn - ray.o) * invD;
    let t1 = (mx - ray.o) * invD;

    let near = min(t0, t1);
    let far = max(t0, t1);

    let tMin = max(max(near.x, near.y), max(near.z, 0.0));
    let tMax = min(min(far.x, far.y), min(far.z, tmax));

    if (tMin <= tMax && tMax > EPSILON) {
        return tMin;
    }

    return -1.0;
}

// EPSILON checked
fn hitTriangle(ray: Ray, triangle: Triangle) -> f32 {
    let o = ray.o;
    let d = ray.d;
    let v0 = triangle.v0.xyz;
    let v1 = triangle.v1.xyz;
    let v2 = triangle.v2.xyz;

    let a = v0 - v2;
    let b = v1 - v2;
    let p = cross(d, b);
    let det = dot(a, p);
    if abs(det) < EPSILON { return -1.0; }

    let invDet = 1.0 / det;
    let e = o - v2;
    let l0 = dot(p, e) * invDet;
    if l0 < 0.0 || l0 > 1.0 { return -1.0; }

    let q = cross(e, a);
    let l1 = dot(d, q) * invDet;
    if l1 < 0.0 || l0 + l1 > 1.0 { return -1.0; }

    let t = dot(b, q) * invDet;
    if (t <= EPSILON) { return -1.0; }

    return t;
}

fn makeRay(pixel: vec2f) -> Ray {
    let resolution = camera.screen.xy;
    let aspect = resolution.x / resolution.y;
    let fovRad = camera.screen.z * PI / 180;
    let tanHalfHov = tan(fovRad * 0.5);

    let xRatio = (pixel.x + 0.5) / resolution.x * 2 - 1;
    let yRatio = 1 - ((pixel.y + 0.5) / resolution.y) * 2;
    let x = xRatio * aspect * tanHalfHov;
    let y = yRatio * tanHalfHov;

    let origin = camera.position.xyz;
    let direction = normalize(
        camera.forward.xyz
        + camera.right.xyz * x
        + camera.up.xyz * y
    );    

    return Ray(origin, direction);
}
