import { useValue } from '@legendapp/state/react';
import { useLayoutEffect, useRef } from 'react';
import * as THREE from 'three';
import { NodeTypeWrapComponentWithNodeWrapper } from '../../workflow/node-types-wrapper';
import {
  WorkflowBrandedTypes,
  type WorkflowComponentProps_Obs,
  type WorkflowRuntimeNodeTypeDefinition,
} from '../../workflow/types';
import { type Box, box, unbox } from './types';

// eslint-disable-next-line react-refresh/only-export-components
export const threeSceneView: WorkflowRuntimeNodeTypeDefinition = {
  type: WorkflowBrandedTypes.typeName(`threeSceneView`),
  getComponent: () => ({
    Component: NodeTypeWrapComponentWithNodeWrapper(
      CanvasThreeRendererNodeComponent,
    ),
  }),
  inputs: [
    {
      name: WorkflowBrandedTypes.inputName(`scene`),
      type: WorkflowBrandedTypes.valueType(`Box<THREE.Scene>`),
    },
    {
      name: WorkflowBrandedTypes.inputName(`camera`),
      type: WorkflowBrandedTypes.valueType(`Box<THREE.Camera>`),
    },
  ],
  outputs: [
    {
      name: WorkflowBrandedTypes.outputName(`renderer`),
      type: WorkflowBrandedTypes.valueType(`Box<THREE.WebGLRenderer>`),
    },
    {
      name: WorkflowBrandedTypes.outputName(`canvas`),
      type: WorkflowBrandedTypes.valueType(`Box<HTMLCanvasElement>`),
    },
    {
      name: WorkflowBrandedTypes.outputName(`camera`),
      type: WorkflowBrandedTypes.valueType(`Box<THREE.Camera>`),
    },
  ],
  execute: async ({ inputs, runtimeState }) => {
    const camera = unbox(inputs.camera as Box<THREE.Camera>);
    const scene = unbox(inputs.scene as Box<THREE.Scene>);
    if (!scene || !camera) {
      console.log('[threeSceneView] execute missing scene or camera', {
        scene,
        camera,
      });
      return;
    }

    const rs = runtimeState as {
      camera?: THREE.Camera;
      scene?: THREE.Scene;
      dispose?: () => void;
    };

    if (camera === rs.camera && scene === rs.scene) {
      return;
    }
    rs.dispose?.();
    rs.camera = camera;
    rs.scene = scene;
    rs.dispose = () => {};

    const canvas = document.createElement('canvas');
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
    });

    function animate() {
      if (!scene || !camera) {
        return;
      }
      renderer.render(scene, camera);
    }
    renderer.setAnimationLoop(animate);

    rs.dispose = () => {
      renderer.setAnimationLoop(null);
      renderer.dispose();
    };

    return {
      outputs: {
        renderer: box(renderer),
        canvas: box(canvas),
        camera: box(camera),
      },
    };
  },
};

export const CanvasThreeRendererNodeComponent = (
  props: WorkflowComponentProps_Obs<
    Record<string, never>,
    Record<string, never>,
    {
      canvas: Box<HTMLCanvasElement>;
      renderer: Box<THREE.WebGLRenderer>;
      camera: Box<THREE.Camera>;
    }
  >,
) => {
  const {
    canvas: canvasObj,
    renderer: rendererObj,
    camera: cameraObj,
  } = useValue(() => ({
    canvas: props.data.outputs$.canvas.get() as
      | undefined
      | Box<HTMLCanvasElement>,
    renderer: props.data.outputs$.renderer.get() as
      | undefined
      | Box<THREE.WebGLRenderer>,
    camera: props.data.outputs$.camera.get() as
      | undefined
      | Box<THREE.PerspectiveCamera>,
  }));
  console.log('[CanvasThreeRendererNodeComponent] render', {
    canvasObj,
    renderer: rendererObj,
    camera: cameraObj,
  });
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const canvas = unbox(canvasObj);
    const renderer = unbox(rendererObj);
    const camera = unbox(cameraObj);
    if (!canvas || !renderer || !camera) {
      console.log(
        '[CanvasThreeRendererNodeComponent] handleResize missing canvas, renderer, or camera',
      );
      return;
    }

    console.log(
      '[CanvasThreeRendereNodeComponent] attaching canvas to container',
      {
        container,
        canvas,
      },
    );
    container.innerHTML = '';
    container.appendChild(canvas);

    const handleResize = () => {
      if (!canvas || !renderer) {
        console.log(
          '[CanvasThreeRendererNodeComponent] handleResize missing canvas or renderer',
        );
        return;
      }
      console.log('[CanvasThreeRendererNodeComponent] handleResize', {
        container,
        canvas,
        renderer,
      });
      canvas.setAttribute('width', `${container.clientWidth}`);
      canvas.setAttribute('height', `${container.clientHeight}`);
      renderer.setSize(canvas.width, canvas.height);
      const c = { camera }.camera as THREE.PerspectiveCamera;
      c.aspect = canvas.width / canvas.height;
      c.updateProjectionMatrix();
    };
    handleResize();
    const resizeObserver = new ResizeObserver(() => handleResize());
    resizeObserver.observe(container);

    return () => {
      container?.removeChild(canvas);
      resizeObserver.disconnect();
    };
  }, [cameraObj, canvasObj, rendererObj]);

  const containerRef = useRef<HTMLDivElement>(null);
  return (
    <div
      className="bg-black w-full h-full nowheel nodrag nopan"
      ref={containerRef}
    />
  );
};
