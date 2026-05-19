import { vec4 } from "gl-matrix";

const MATERIAL_FLOAT_COUNT = 20;

export interface Material {
    baseColorFactor     : vec4;
    atlasTransform      : vec4;  // offset xy, scale zw
    normalAtlasTransform: vec4;  // offset xy, scale zw
    reflectivity        : number;
    specularPower       : number;
    hasTexture          : number;
    hasNormalMap        : number;
    kind                : number;
    ior                 : number;
}

export function materialsToBuffer(materials: Material[]): Float32Array<ArrayBuffer> {
    const source = materials.length > 0 ? materials : [defaultMaterial()];
    const out = new Float32Array(source.length * MATERIAL_FLOAT_COUNT);

    for (let i = 0; i < source.length; i++) {
        const material = source[i];
        const offset = i * MATERIAL_FLOAT_COUNT;

        out.set(material.baseColorFactor, offset + 0);
        out.set(material.atlasTransform, offset + 4);
        out.set(material.normalAtlasTransform, offset + 8);
        out[offset + 12] = material.reflectivity;
        out[offset + 13] = material.specularPower;
        out[offset + 14] = material.hasTexture;
        out[offset + 15] = material.hasNormalMap;
        out[offset + 16] = material.kind;
        out[offset + 17] = material.ior;
        out[offset + 18] = 0;
        out[offset + 19] = 0;
    }

    return out;
}

export function waterMaterial(): Material {
    return {
        baseColorFactor     : vec4.fromValues(0.85, 0.9, 0.95, 1),
        atlasTransform      : vec4.fromValues(0, 0, 1, 1),
        normalAtlasTransform: vec4.fromValues(0, 0, 1, 1),
        reflectivity        : 0,
        specularPower       : 64,
        hasTexture          : 0,
        hasNormalMap        : 0,
        kind                : 2,
        ior                 : 1.33
    };
}

export function defaultMaterial(): Material {
    return {
        baseColorFactor     : vec4.fromValues(0.9, 0.35, 0.2, 1),
        atlasTransform      : vec4.fromValues(0, 0, 1, 1),
        normalAtlasTransform: vec4.fromValues(0, 0, 1, 1),
        reflectivity        : 0.2,
        specularPower       : 64,
        hasTexture          : 0,
        hasNormalMap        : 0,
        kind                : 0,
        ior                 : 1
    };
}
