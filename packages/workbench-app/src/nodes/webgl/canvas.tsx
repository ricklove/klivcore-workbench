import { useLayoutEffect, useRef } from 'react';
import { WorkflowNodeWrapperSimple } from '../../workflow/node-wrapper';
import { type WorkflowComponentProps_Obs } from '../../workflow/types';
import * as THREE from 'three';
import { useValue } from '@legendapp/state/react';
import { unbox, type Box } from './types';

// export const CanvasNodeComponent = (
//   props: WorkflowComponentProps_Obs<
//     Record<string, never>,
//     Record<string, never>,
//     { canvas: HTMLCanvasElement }
//   >,
// ) => {
//   const { outputs$ } = props.data;

//   useLayoutEffect(() => {
//     const container = containerRef.current;
//     if (!container) {
//       return;
//     }

//     const canvas = outputs$.get().canvas;
//     if (!canvas) {
//       return;
//     }

//     container.innerHTML = '';
//     container.appendChild(canvas);
//     outputs$.canvas?.set(canvas);

//     const handleResize = () => {
//       canvas.width = container.clientWidth;
//       canvas.height = container.clientHeight;
//     };
//     handleResize();
//     const resizeObserver = new ResizeObserver(() => handleResize());
//     resizeObserver.observe(container);

//     return () => {
//       container?.removeChild(canvas);
//       resizeObserver.disconnect();
//     };
//   }, []);

//   const containerRef = useRef<HTMLDivElement>(null);
//   return (
//     <>
//       <WorkflowNodeWrapperSimple {...props}>
//         <div className="bg-black w-full h-full nowheel nodrag nopan" ref={containerRef} />
//       </WorkflowNodeWrapperSimple>
//     </>
//   );
// };

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
    canvas: props.data.outputs$.canvas.get() as undefined | Box<HTMLCanvasElement>,
    renderer: props.data.outputs$.renderer.get() as undefined | Box<THREE.WebGLRenderer>,
    camera: props.data.outputs$.camera.get() as undefined | Box<THREE.PerspectiveCamera>,
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

    console.log('[CanvasThreeRendereNodeComponent] attaching canvas to container', {
      container,
      canvas,
    });
    container.innerHTML = '';
    container.appendChild(canvas);

    const handleResize = () => {
      if (!canvas || !renderer) {
        console.log('[CanvasThreeRendererNodeComponent] handleResize missing canvas or renderer');
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
  }, [unbox(canvasObj), unbox(rendererObj)]);

  const containerRef = useRef<HTMLDivElement>(null);
  return (
    <>
      <WorkflowNodeWrapperSimple {...props}>
        <div className="bg-black w-full h-full nowheel nodrag nopan" ref={containerRef} />
      </WorkflowNodeWrapperSimple>
    </>
  );
};
