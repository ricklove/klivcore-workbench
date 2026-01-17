import { useLayoutEffect, useRef } from 'react';
import { WorkflowNodeWrapperSimple } from '../../workflow/node-wrapper';
import { type WorkflowComponentProps_Obs } from '../../workflow/types';

export const CanvasNodeComponent = (
  props: WorkflowComponentProps_Obs<
    Record<string, never>,
    Record<string, never>,
    { canvas: HTMLCanvasElement }
  >,
) => {
  const { outputs$ } = props.data;

  const containerRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const canvas = document.createElement('canvas');
    if (!canvas) {
      return;
    }

    container.innerHTML = '';
    container.appendChild(canvas);
    outputs$.canvas?.set(canvas);

    const handleResize = () => {
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
    };
    handleResize();
    const resizeObserver = new ResizeObserver(() => handleResize());
    resizeObserver.observe(container);

    return () => {
      container?.removeChild(canvas);
      resizeObserver.disconnect();
    };
  }, []);

  return (
    <>
      <WorkflowNodeWrapperSimple {...props}>
        <div className="bg-black w-full h-full nowheel nodrag nopan" ref={containerRef} />
      </WorkflowNodeWrapperSimple>
    </>
  );
};

export const CanvasWebglNodeComponent = (
  props: WorkflowComponentProps_Obs<
    Record<string, never>,
    Record<string, never>,
    { canvas: HTMLCanvasElement; webgl: WebGL2RenderingContext }
  >,
) => {
  const { outputs$ } = props.data;

  const containerRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const canvas = document.createElement('canvas');
    const webgl = canvas.getContext('webgl2');
    if (!canvas || !webgl) {
      return;
    }

    container.innerHTML = '';
    container.appendChild(canvas);
    outputs$.canvas?.set(canvas);
    outputs$.webgl?.set(webgl);

    const handleResize = () => {
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
    };
    handleResize();
    const resizeObserver = new ResizeObserver(() => handleResize());
    resizeObserver.observe(container);

    return () => {
      container?.removeChild(canvas);
      resizeObserver.disconnect();
    };
  }, []);

  return (
    <>
      <WorkflowNodeWrapperSimple {...props}>
        <div className="bg-black w-full h-full nowheel nodrag nopan" ref={containerRef} />
      </WorkflowNodeWrapperSimple>
    </>
  );
};
