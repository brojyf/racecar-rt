// ===== constant =====
const EPSILON         = 1e-8;
const DEFAULT_CLOSEST = 1e9;
const PI              = 3.14159265359;
const BG              = vec3f(0.2, 0.2, 0.2);
const STACK_SIZE      = 128u;
const MAX_BOUNCES     = 6u;
const RAY_EPS         = 1e-4;
const ATTENUATION_WATER = 0.35;
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
    v0  : vec4f,
    v1  : vec4f,
    v2  : vec4f,
    n0  : vec4f,
    n1  : vec4f,
    n2  : vec4f,
    uv01: vec4f,
    uv2 : vec4f,
}

struct BVHNode {
    min       : vec3f,
    leftOrFirst: u32,
    max       : vec3f,
    triCount  : u32
}

struct Light {
    posRadius: vec4f,
    colorInten: vec4f
}

struct Material {
    baseColorFactor: vec4f,
    atlasTransform : vec4f,
    normalAtlasTransform: vec4f,
    params         : vec4f,
    extras         : vec4f,
}

struct Hit {
    t   : f32,
    bary: vec3f,
}

struct ClosestHit {
    t       : f32,
    bary    : vec3f,
    triIndex: u32,
    hitFound: bool,
}

// ===== binding =====
@group(0) @binding(0)
var<uniform> camera: Camera;

@group(0) @binding(1)
var<storage, read> triangles: array<Triangle>;

@group(0) @binding(2)
var<storage, read> nodes: array<BVHNode>;

@group(0) @binding(3)
var<uniform> light: Light;

@group(0) @binding(4)
var<storage, read> materials: array<Material>;

@group(0) @binding(5)
var atlasTexture: texture_2d<f32>;

@group(0) @binding(6)
var atlasSampler: sampler;

// ===== function =====
@vertex
fn vertMain(
    @builtin(vertex_index) vertexIndex: u32
) -> @builtin(position) vec4f {
    return vec4f(SCREEN_TRIANGLE[vertexIndex], 0.0, 1.0);
}

@fragment
fn fragMain(@builtin(position) pos: vec4f) -> @location(0) vec4f {
    let ray = makeRay(pos.xy, vec2f(0.5));
    return vec4f(traceWhitted(ray), 1.0);
}

fn traceWhitted(rayIn: Ray) -> vec3f {
    var ray = rayIn;
    var color = vec3f(0.0);
    var atten = vec3f(1.0);

    for (var bounce = 0u; bounce < MAX_BOUNCES; bounce = bounce + 1u) {
        let hit = intersectScene(ray);
        if (!hit.hitFound) {
            color = color + atten * BG;
            break;
        }

        let tri = triangles[hit.triIndex];
        let material = materialForTriangle(tri);
        let hitP = ray.o + ray.d * hit.t;
        let geomNormal = shadeNormal(tri, material, hit.bary);

        // water
        if (material.extras.x > 1.5) { 
            let lightDist = length(light.posRadius.xyz - hitP);
            let lightDir = (light.posRadius.xyz - hitP) / max(lightDist, EPSILON);
            let shadowRay = Ray(hitP + geomNormal * RAY_EPS, lightDir);
            let shadowAttn = select(1.0, ATTENUATION_WATER, occluded(shadowRay, lightDist - RAY_EPS));

            ray = Ray(hitP + geomNormal * RAY_EPS, reflect(ray.d, geomNormal));
            atten = atten * material.baseColorFactor.rgb * shadowAttn;
            continue;
        }

        // dielectric
        if (material.extras.x > 0.5) {  
            ray = dielectricBounce(ray, hitP, geomNormal, material.extras.y);
            atten = atten * material.baseColorFactor.rgb;
            continue;
        }

        let local = shade(tri, material, hitP, hit.bary, geomNormal);
        color = color + atten * local;
        break;
    }

    return color;
}

// ===== helper functions =====
fn intersectScene(ray: Ray) -> ClosestHit {
    var result: ClosestHit;
    result.t = DEFAULT_CLOSEST;
    result.bary = vec3f(0.0);
    result.triIndex = 0u;
    result.hitFound = false;

    if (arrayLength(&nodes) == 0u) { return result; }

    var stack: array<u32, 128>;
    var stackCount = 0u;
    stack[stackCount] = 0u;
    stackCount = stackCount + 1u;

    while (stackCount > 0u) {
        stackCount = stackCount - 1u;
        let node = nodes[stack[stackCount]];

        let nodeT = rayAabbT(ray, node.min, node.max, result.t);
        if (nodeT < 0.0) { continue; }

        if (node.triCount > 0u) {
            let first = node.leftOrFirst;
            let end = first + node.triCount;
            for (var i = first; i < end; i = i + 1u) {
                let h = hitTriangle(ray, triangles[i]);
                if (h.t > 0.0 && h.t < result.t) {
                    result.t = h.t;
                    result.bary = h.bary;
                    result.triIndex = i;
                    result.hitFound = true;
                }
            }
        } else {
            let left = node.leftOrFirst;
            let right = left + 1u;
            let leftT = rayAabbT(ray, nodes[left].min, nodes[left].max, result.t);
            let rightT = rayAabbT(ray, nodes[right].min, nodes[right].max, result.t);
            let leftHit = leftT >= 0.0;
            let rightHit = rightT >= 0.0;

            if (leftHit && rightHit) {
                if (leftT < rightT) {
                    if (stackCount + 1u < STACK_SIZE) {
                        stack[stackCount] = right; stackCount = stackCount + 1u;
                        stack[stackCount] = left;  stackCount = stackCount + 1u;
                    }
                } else {
                    if (stackCount + 1u < STACK_SIZE) {
                        stack[stackCount] = left;  stackCount = stackCount + 1u;
                        stack[stackCount] = right; stackCount = stackCount + 1u;
                    }
                }
            } else if (leftHit) {
                if (stackCount < STACK_SIZE) {
                    stack[stackCount] = left; stackCount = stackCount + 1u;
                }
            } else if (rightHit) {
                if (stackCount < STACK_SIZE) {
                    stack[stackCount] = right; stackCount = stackCount + 1u;
                }
            }
        }
    }

    return result;
}

fn occluded(ray: Ray, maxT: f32) -> bool {
    if (arrayLength(&nodes) == 0u) { return false; }

    var stack: array<u32, 128>;
    var stackCount = 0u;
    stack[stackCount] = 0u;
    stackCount = stackCount + 1u;

    while (stackCount > 0u) {
        stackCount = stackCount - 1u;
        let node = nodes[stack[stackCount]];

        let nodeT = rayAabbT(ray, node.min, node.max, maxT);
        if (nodeT < 0.0) { continue; }

        if (node.triCount > 0u) {
            let first = node.leftOrFirst;
            let end = first + node.triCount;
            for (var i = first; i < end; i = i + 1u) {
                let tri = triangles[i];
                let mat = materialForTriangle(tri);

                // skip transparent
                if (mat.extras.x > 0.5) { continue; } 

                let h = hitTriangle(ray, tri);
                if (h.t > EPSILON && h.t < maxT) {
                    return true;
                }
            }
        } else {
            let left = node.leftOrFirst;
            let right = left + 1u;
            if (stackCount + 1u < STACK_SIZE) {
                stack[stackCount] = left;  stackCount = stackCount + 1u;
                stack[stackCount] = right; stackCount = stackCount + 1u;
            }
        }
    }

    return false;
}

fn dielectricBounce(ray: Ray, hitP: vec3f, normal: vec3f, ior: f32) -> Ray {
    var n = normal;
    var cosI = -dot(ray.d, n);
    var etaI = 1.0;
    var etaT = ior;
    if (cosI < 0.0) {
        n = -n;
        cosI = -cosI;
        etaI = ior;
        etaT = 1.0;
    }

    let eta = etaI / etaT;
    let sinT2 = eta * eta * max(0.0, 1.0 - cosI * cosI);
    let cosT2 = 1.0 - sinT2;

    if (cosT2 <= 0.0) {
        return Ray(hitP + n * RAY_EPS, reflect(ray.d, n));
    }
    
    let cosT = sqrt(cosT2);
    let dir = eta * ray.d + (eta * cosI - cosT) * n;
    return Ray(hitP - n * RAY_EPS, normalize(dir));
}

fn shade(t: Triangle, material: Material, hitP: vec3f, bary: vec3f, normal: vec3f) -> vec3f {
    let baseColor = sampleBaseColor(material, interpolateUv(t, bary));
    let toLight = light.posRadius.xyz - hitP;
    let lightDist = length(toLight);
    let lightDir = toLight / max(lightDist, EPSILON);
    let lightColor = light.colorInten.xyz * light.colorInten.w;
    let ambient = baseColor * 0.18 * lightColor;

    let shadowRay = Ray(hitP + normal * RAY_EPS, lightDir);
    if (occluded(shadowRay, lightDist - RAY_EPS)) {
        return ambient;
    }

    let viewDir = normalize(camera.position.xyz - hitP);
    let diffuse = max(dot(normal, lightDir), 0.0);
    let specDir = reflect(-lightDir, normal);
    let specular = pow(max(dot(viewDir, specDir), 0.0), material.params.y) * material.params.x;

    return lightColor * (baseColor * (0.18 + 0.82 * diffuse) + vec3f(specular));
}

fn materialForTriangle(t: Triangle) -> Material {
    let count = arrayLength(&materials);
    var materialIndex = u32(max(t.v0.w, 0.0));
    if (materialIndex >= count) {
        materialIndex = count - 1u;
    }
    return materials[materialIndex];
}

fn sampleBaseColor(material: Material, uv: vec2f) -> vec3f {
    let factor = material.baseColorFactor.rgb;
    if (material.params.z < 0.5) {
        return factor;
    }

    let wrappedUv = fract(uv);
    let atlasUv = material.atlasTransform.xy + wrappedUv * material.atlasTransform.zw;
    let texel = textureSampleLevel(atlasTexture, atlasSampler, atlasUv, 0.0).rgb;
    return texel * factor;
}

fn shadeNormal(t: Triangle, material: Material, bary: vec3f) -> vec3f {
    let v0 = t.v0.xyz;
    let v1 = t.v1.xyz;
    let v2 = t.v2.xyz;
    let rawNormal = t.n0.xyz * bary.x + t.n1.xyz * bary.y + t.n2.xyz * bary.z;

    // fallback 
    var normal = normalize(cross(v1 - v0, v2 - v0));
    if (dot(rawNormal, rawNormal) > EPSILON) {
        normal = normalize(rawNormal);
    }
    if (material.params.w < 0.5) {  return normal; }

    let uv0 = t.uv01.xy;
    let uv1 = t.uv01.zw;
    let uv2 = t.uv2.xy;
    let duv1 = uv1 - uv0;
    let duv2 = uv2 - uv0;
    let denom = duv1.x * duv2.y - duv2.x * duv1.y;
    if (abs(denom) < EPSILON) {
        return normal;
    }

    let edge1 = v1 - v0;
    let edge2 = v2 - v0;
    let r = 1.0 / denom;
    var tangent = normalize((edge1 * duv2.y - edge2 * duv1.y) * r);
    tangent = normalize(tangent - normal * dot(normal, tangent));

    let negate = select(-1.0, 1.0, dot(cross(normal, tangent), (edge2 * duv1.x - edge1 * duv2.x) * r) >= 0.0);
    let bitangent = normalize(cross(normal, tangent)) * negate;
    let sampled = sampleNormalMap(material, interpolateUv(t, bary));

    return normalize(tangent * sampled.x + bitangent * sampled.y + normal * sampled.z);
}

fn sampleNormalMap(material: Material, uv: vec2f) -> vec3f {
    let wrappedUv = fract(uv);
    let offset = material.normalAtlasTransform.xy;
    let scale = material.normalAtlasTransform.zw;
    let atlasUv = offset + wrappedUv * scale;

    let rgb = textureSampleLevel(atlasTexture, atlasSampler, atlasUv, 0.0).xyz;
    let normal = normalize(rgb * 2.0 - vec3f(1.0));

    return normal;
}

fn interpolateUv(t: Triangle, bary: vec3f) -> vec2f {
    let uv0 = t.uv01.xy;
    let uv1 = t.uv01.zw;
    let uv2 = t.uv2.xy;
    return uv0 * bary.x + uv1 * bary.y + uv2 * bary.z;
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
fn hitTriangle(ray: Ray, triangle: Triangle) -> Hit {
    let o = ray.o;
    let d = ray.d;
    let v0 = triangle.v0.xyz;
    let v1 = triangle.v1.xyz;
    let v2 = triangle.v2.xyz;

    let a = v0 - v2;
    let b = v1 - v2;
    let p = cross(d, b);
    let det = dot(a, p);
    if abs(det) < EPSILON { return Hit(-1.0, vec3f(0.0)); }

    let invDet = 1.0 / det;
    let e = o - v2;
    let l0 = dot(p, e) * invDet;
    if l0 < 0.0 || l0 > 1.0 { return Hit(-1.0, vec3f(0.0)); }

    let q = cross(e, a);
    let l1 = dot(d, q) * invDet;
    if l1 < 0.0 || l0 + l1 > 1.0 { return Hit(-1.0, vec3f(0.0)); }

    let t = dot(b, q) * invDet;
    if (t <= EPSILON) { return Hit(-1.0, vec3f(0.0)); }

    return Hit(t, vec3f(l0, l1, 1.0 - l0 - l1));
}

fn makeRay(pixel: vec2f, jitter: vec2f) -> Ray {
    let resolution = camera.screen.xy;
    let aspect = resolution.x / resolution.y;
    let fovRad = camera.screen.z * PI / 180;
    let tanHalfHov = tan(fovRad * 0.5);

    let xRatio = (pixel.x + jitter.x) / resolution.x * 2 - 1;
    let yRatio = 1 - ((pixel.y + jitter.y) / resolution.y) * 2;
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
