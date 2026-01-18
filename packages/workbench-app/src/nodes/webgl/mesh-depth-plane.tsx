import {
  EmptyNodeComponent,
  NodeTypeWrapComponentWithNodeWrapper,
} from '../../workflow/node-types-wrapper';
import { WorkflowBrandedTypes, type WorkflowRuntimeNodeTypeDefinition } from '../../workflow/types';
import * as THREE from 'three';
import { ObservableHint } from '@legendapp/state';
import { unbox, box, type Box } from './types';

export const threeMeshDepthPlane: WorkflowRuntimeNodeTypeDefinition = {
  type: WorkflowBrandedTypes.typeName(`threeMeshDepthPlane`),
  getComponent: () => ({
    Component: NodeTypeWrapComponentWithNodeWrapper(EmptyNodeComponent),
  }),
  inputs: [
    {
      name: WorkflowBrandedTypes.inputName(`texture`),
      type: WorkflowBrandedTypes.valueType(`Box<THREE.Texture<HTMLImageElement>>`),
    },
    {
      name: WorkflowBrandedTypes.inputName(`depthTexture`),
      type: WorkflowBrandedTypes.valueType(`Box<THREE.Texture<HTMLImageElement>>`),
    },
  ],
  outputs: [
    {
      name: WorkflowBrandedTypes.outputName(`mesh`),
      type: WorkflowBrandedTypes.valueType(`Box<THREE.Mesh>`),
    },
  ],
  execute: async ({ inputs, runtimeState }) => {
    const texture = unbox(inputs.texture as Box<THREE.Texture<HTMLImageElement>>);
    const depthTexture = unbox(inputs.depthTexture as Box<THREE.Texture<HTMLImageElement>>);

    console.log('[threeMeshDepthPlane] START', { texture, depthTexture });

    if (!texture || !depthTexture) {
      console.log('[threeMeshDepthPlane] handleResize missing texture or depthTexture', {
        texture,
        depthTexture,
      });
      return;
    }

    const rs = runtimeState as {
      texture?: THREE.Texture<HTMLImageElement>;
      depthTexture?: THREE.Texture<HTMLImageElement>;
      material?: THREE.MeshStandardMaterial;
      dispose?: () => void;
    };

    if (texture === rs.texture && depthTexture === rs.depthTexture) {
      return;
    }

    if (rs.material) {
      console.log('[threeMeshDepthPlane] switch the textures on the material', {
        texture,
        depthTexture,
        rs,
      });

      rs.texture = texture;
      rs.depthTexture = depthTexture;

      rs.material.map = texture;
      rs.material.displacementMap = depthTexture;
      rs.material.needsUpdate = true;
      return;
    }

    rs.texture = texture;
    rs.depthTexture = depthTexture;
    rs.dispose?.();

    const material = new THREE.MeshStandardMaterial({
      map: texture,
      displacementMap: depthTexture,
      displacementScale: 1.0,
      // Ensures the material is matte and doesn't reflect the light
      //   roughness: 1.0,
      //   metalness: 0.0,
    });

    rs.material = material;

    function getTextureDimensions(
      texture: THREE.Texture,
    ): undefined | { width: number; height: number } {
      const image = texture.image as undefined | HTMLImageElement;

      // In strict mode, we guard against 'null' or undefined images
      if (image && 'width' in image && 'height' in image) {
        return { width: image.width, height: image.height };
      }

      return;
    }

    const imageSize = getTextureDimensions(depthTexture) ??
      getTextureDimensions(texture) ?? { width: 128, height: 128 };

    const aspectRatio = imageSize.width / imageSize.height;
    const width = 1;
    const height = width / aspectRatio;

    console.log('[threeMeshDepthPlane] creating plane with size', { width, height, imageSize });
    const geometry = new THREE.PlaneGeometry(width, height, imageSize.width, imageSize.height);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(Math.random(), Math.random(), Math.random());

    console.log('[threeMeshDepthPlane] DONE', { width, height, imageSize });

    rs.dispose = () => {
      geometry.dispose();
      material.dispose();
    };

    return { outputs: { mesh: ObservableHint.opaque(box(mesh)) } };
  },
};
