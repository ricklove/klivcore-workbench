import { useLayoutEffect, useRef, useId } from 'react';
import * as THREE from 'three';
import { texturePreviewStore$ } from './texture-preview-store';

export const useTexturePreview = (
  texture: THREE.Texture | THREE.DataArrayTexture | undefined,
  layerIndex: number = 0,
) => {
  const ref = useRef<HTMLDivElement>(null);
  const id = useId(); // Unique ID for this node instance

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Helper to update global state
    const updateRect = () => {
      if (!texture) return;

      texturePreviewStore$.assign({
        [id]: {
          id,
          rect: el.getBoundingClientRect(), // Magic: gets screen position
          texture,
          layerIndex,
          enabled: true,
        },
      });
    };

    // 1. Update immediately
    updateRect();

    // 2. Update on Scroll/Resize of the window or container
    // We use a ResizeObserver on the element itself, plus a global scroll listener
    const resizeObserver = new ResizeObserver(() => updateRect());
    resizeObserver.observe(el);

    // Listener for when the node graph is panned/zoomed
    // (You might need to attach this to your specific Node Editor's container instead of window)
    window.addEventListener('scroll', updateRect, true);
    window.addEventListener('resize', updateRect);

    // 3. Loop update (optional/fallback)
    // Sometimes scroll listeners don't fire during JS animations.
    // A slow interval ensures it snaps back if it drifts.
    const interval = setInterval(updateRect, 100);

    return () => {
      // Cleanup: Remove from global render list
      const current = texturePreviewStore$.get();
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { [id]: _removed, ...rest } = current;
      texturePreviewStore$.set(rest);

      resizeObserver.disconnect();
      window.removeEventListener('scroll', updateRect, true);
      window.removeEventListener('resize', updateRect);
      clearInterval(interval);
    };
  }, [id, texture, layerIndex]);

  return ref;
};
