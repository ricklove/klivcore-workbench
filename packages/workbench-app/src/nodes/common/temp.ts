import * as THREE from 'three';
import type { Object3D, Scene } from 'three';
import { storageStore$ } from '../storage/_storage-store';

async function subflow({
  data,
  scene,
}: {
  data: { url: string };
  scene: Scene;
}): Promise<{
  obj: Object3D;
  data: { url: string };
}> {
  const { value } = { value: ((x) => x.url)(data) };

  const { value: value_3 } = (() => {
    const { provider: provider$, path } =
      storageStore$.getProviderWithPath(value) ?? {};
    const provider = provider$?.peek();
    if (!path || !provider || !provider.getUrl) {
      return { value: undefined };
    }
    return {
      value: provider.getUrl(path),
    };
  })();

  const { texture } = await (async (url) => {
    const loader = new THREE.TextureLoader();
    const texture = await new Promise<THREE.Texture<HTMLImageElement>>(
      (resolve, reject) => {
        loader.load(
          url,
          (texture) => {
            texture.colorSpace = THREE.SRGBColorSpace;
            resolve(texture);
          },
          undefined,
          (err) => {
            console.error('Error loading texture', { err });
            reject(err);
          },
        );
      },
    );
    return { texture: box(texture) };
  })(value_3);

  const { mesh } = ((texture, width, height) => {
    const material = new THREE.MeshBasicMaterial({
      map: texture,
    });
    const geometry = new THREE.PlaneGeometry(width, height);
    const mesh = new THREE.Mesh(geometry, material);
    return { mesh };
  })(texture, 5, 5);

  const { success } = ((scene, obj) => {
    scene.add(obj);
    return { success: 'success' };
  })(scene, mesh);

  const { position, rotation, vector, dataset } =
    nodeTypes['threePositionController'].execute(/*...*/);

  const { value: value_7 } = {
    value: ((x, y) => ({ ...x, ...y }))(data, dataset),
  };

  return {
    obj: mesh,
    data: value_7,
  };
}
