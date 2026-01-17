import { useLayoutEffect, useRef } from 'react';
import { WorkflowNodeWrapperSimple } from '../../workflow/node-wrapper';
import { type WorkflowComponentProps_Obs } from '../../workflow/types';
import * as THREE from 'three';
import { useValue } from '@legendapp/state/react';

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
    { canvas: { canvas: HTMLCanvasElement }; renderer: { renderer: THREE.WebGLRenderer } }
  >,
) => {
  const { canvas: canvasObj, renderer: rendererObj } = useValue(() => ({
    canvas: props.data.outputs$.canvas.get() as undefined | { canvas: HTMLCanvasElement },
    renderer: props.data.outputs$.renderer.get() as undefined | { renderer: THREE.WebGLRenderer },
  }));
  console.log('[CanvasThreeRendererNodeComponent] render', { canvasObj, renderer: rendererObj });
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const canvas = canvasObj?.canvas;
    const renderer = rendererObj?.renderer;
    if (!canvas || !renderer) {
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
    };
    handleResize();
    const resizeObserver = new ResizeObserver(() => handleResize());
    resizeObserver.observe(container);

    return () => {
      container?.removeChild(canvas);
      resizeObserver.disconnect();
    };
  }, [canvasObj?.canvas, rendererObj?.renderer]);

  const containerRef = useRef<HTMLDivElement>(null);
  return (
    <>
      <WorkflowNodeWrapperSimple {...props}>
        <div className="bg-black w-full h-full nowheel nodrag nopan" ref={containerRef} />
      </WorkflowNodeWrapperSimple>
    </>
  );
};
