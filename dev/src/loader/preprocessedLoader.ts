import { vec4 } from "gl-matrix";
import type { Material } from "../scene/material";
import type { Mesh, TextureAtlas } from "../scene/mesh";

interface LoadedScene {
    meshes   : Mesh[];
    materials: Material[];
    atlas    : TextureAtlas;
}

interface PreprocessedMesh {
    positions    : number[];
    normals      : number[];
    texcoords    : number[];
    indices      : number[];
    materialIndex: number;
}

interface PreprocessedMaterial {
    baseColorFactor     : number[];
    atlasTransform      : number[];
    normalAtlasTransform: number[];
    reflectivity        : number;
    specularPower       : number;
    hasTexture          : number;
    hasNormalMap        : number;
    kind                : number;
    ior                 : number;
}

interface PreprocessedScene {
    atlas    : string;
    meshes   : PreprocessedMesh[];
    materials: PreprocessedMaterial[];
}

export async function loadPreprocessedScene(assetPath: string): Promise<LoadedScene> {
    const assetUrl = new URL(assetPath, window.location.href);
    const data = await fetchJson(assetUrl);
    const atlas = await loadAtlas(new URL(data.atlas, assetUrl));

    return {
        meshes   : data.meshes.map(toMesh),
        materials: data.materials.map(toMaterial),
        atlas
    };
}

async function fetchJson(url: URL): Promise<PreprocessedScene> {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`PREPROCESSED_LOADER_FETCH_FAILED: ${response.status}`);
    }
    return response.json();
}

async function loadAtlas(url: URL): Promise<TextureAtlas> {
    const image = new Image();
    image.src = url.href;
    await image.decode();

    const source = document.createElement("canvas");
    source.width = image.naturalWidth;
    source.height = image.naturalHeight;

    const ctx = source.getContext("2d");
    if (!ctx) throw new Error("PREPROCESSED_ATLAS_CONTEXT_ERROR");
    ctx.drawImage(image, 0, 0);

    return { source };
}

function toMesh(mesh: PreprocessedMesh): Mesh {
    return {
        positions    : new Float32Array(mesh.positions),
        normals      : new Float32Array(mesh.normals),
        texcoords    : new Float32Array(mesh.texcoords),
        indices      : new Uint32Array(mesh.indices),
        materialIndex: mesh.materialIndex
    };
}

function toMaterial(material: PreprocessedMaterial): Material {
    return {
        baseColorFactor    : toVec4(material.baseColorFactor),
        atlasTransform     : toVec4(material.atlasTransform),
        normalAtlasTransform: toVec4(material.normalAtlasTransform),
        reflectivity       : material.reflectivity,
        specularPower      : material.specularPower,
        hasTexture         : material.hasTexture,
        hasNormalMap       : material.hasNormalMap,
        kind               : material.kind,
        ior                : material.ior
    };
}

function toVec4(value: number[]): vec4 {
    return vec4.fromValues(value[0], value[1], value[2], value[3]);
}
