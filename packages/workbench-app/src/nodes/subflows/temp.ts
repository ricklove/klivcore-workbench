import * as THREE from 'three';
import type { Object3D, Scene } from 'three';
import { storageStore$ } from '../storage/_storage-store';

export async function subflow({
  data,
  scene,
}: {
  data: {
    url: string;
    position: [number, number, number];
    rotation: [number, number, number];
  };
  scene: Scene;
}): Promise<{
  obj: Object3D;
  data: {
    url: string;
    position: [number, number, number];
    rotation: [number, number, number];
  };
}> {
  const value = ((x) => x.url)(data);

  const value_3 = (() => {
    const { provider: provider$, path } =
      storageStore$.getProviderWithPath(value) ?? {};
    const provider = provider$?.peek();
    if (!path || !provider || !provider.getUrl) {
      throw new Error('Invalid storage provider or path');
    }
    return provider.getUrl(path);
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
    return { texture };
  })(value_3);

  const { mesh } = ((texture, width, height) => {
    const material = new THREE.MeshBasicMaterial({
      map: texture,
    });
    const geometry = new THREE.PlaneGeometry(width, height);
    const mesh = new THREE.Mesh(geometry, material);
    return { mesh };
  })(texture, 5, 5);

  scene.add(mesh);

  const { position, rotation, dataset } = ((obj, pos, rot) => {
    obj.position.set(pos[0], pos[1], pos[2]);
    obj.rotation.set(rot[0], rot[1], rot[2]);
    return {
      position: pos,
      rotation: rot,
      dataset: { position: pos, rotation: rot },
    };
  })(
    mesh,
    data?.position ?? [
      0.2736914342712329, 0.8538696061636607, 0.7993144729268727,
    ],
    data?.rotation ?? [0, 0, 0],
  );

  const value_7 = ((x, y) => ({ ...x, ...y }))(data, dataset);

  return {
    obj: mesh,
    data: value_7,
  };
}
