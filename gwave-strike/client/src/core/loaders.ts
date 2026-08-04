import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader.js";
import type * as THREE from "three";

/// Shared GLTFLoader with DRACO + KTX2 registered (blueprint §3.2) —
/// decoders are vendored under /decoders so the CDN serves them with the
/// same immutable caching as the models.

let loader: GLTFLoader | null = null;

export function gltfLoader(renderer: THREE.WebGLRenderer): GLTFLoader {
  if (loader) return loader;
  const draco = new DRACOLoader().setDecoderPath("/decoders/draco/");
  const ktx2 = new KTX2Loader()
    .setTranscoderPath("/decoders/basis/")
    .detectSupport(renderer);
  loader = new GLTFLoader().setDRACOLoader(draco).setKTX2Loader(ktx2);
  return loader;
}
