import { useLayoutEffect, useRef, useId } from 'react';
import {
  webglPreviewStore$,
  type TexturePreviewData,
  type ScenePreviewData,
} from './webgl-preview-store';

export const useWebGLPreview = (data: TexturePreviewData | ScenePreviewData | null | undefined) => {
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const updateRect = () => {
      if (!data) return;

      webglPreviewStore$.assign({
        [id]: {
          id,
          rect: el.getBoundingClientRect(),
          enabled: true,
          data: data,
        },
      });
    };

    updateRect();

    // Observers
    const resizeObserver = new ResizeObserver(() => updateRect());
    resizeObserver.observe(el);
    window.addEventListener('scroll', updateRect, true);
    window.addEventListener('resize', updateRect);
    // Fallback interval for smoothness
    const interval = setInterval(updateRect, 100);

    return () => {
      // Remove from store on unmount
      const current = webglPreviewStore$.get();
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { [id]: _removed, ...rest } = current;
      webglPreviewStore$.set(rest);

      resizeObserver.disconnect();
      window.removeEventListener('scroll', updateRect, true);
      window.removeEventListener('resize', updateRect);
      clearInterval(interval);
    };
  }, [id, data]); // dependencies ensure we update if data changes

  return ref;
};
