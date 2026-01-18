import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { texturePreviewStore$ } from './texture-preview-store';

export const GlobalTextureRenderer = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // 1. Setup Single Renderer
    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: false,
      preserveDrawingBuffer: false,
    });

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    // 2. Reusable Geometry & Materials
    const geometry = new THREE.PlaneGeometry(2, 2); // Fills the scissor box

    // Material for Standard Textures
    const matStandard = new THREE.MeshBasicMaterial({ color: 0xffffff });

    // Material for Texture Arrays (Your Sequence)
    const matArray = new THREE.ShaderMaterial({
      uniforms: {
        tArray: { value: null },
        uIndex: { value: 0 },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = vec4(position, 1.0); }
      `,
      fragmentShader: `
        precision highp sampler2DArray;
        uniform sampler2DArray tArray;
        uniform float uIndex;
        varying vec2 vUv;
        void main() {
          gl_FragColor = texture(tArray, vec3(vUv, uIndex));
        }
      `,
    });

    const mesh = new THREE.Mesh(geometry, matStandard);
    scene.add(mesh);

    // 3. Render Loop
    let rAF = 0;
    const render = () => {
      rAF = requestAnimationFrame(render);

      // Sync canvas size to window
      const width = window.innerWidth;
      const height = window.innerHeight;

      if (canvas.width !== width || canvas.height !== height) {
        renderer.setSize(width, height, false);
      }

      // Clear entire screen once
      renderer.setScissorTest(false);
      renderer.clear();
      renderer.setScissorTest(true); // Enable "Window" mode

      // Get all active previews from Legend State
      const previews = texturePreviewStore$.get();

      Object.values(previews).forEach((req) => {
        if (!req.enabled || !req.texture) return;

        // Convert DOMRect (Top-Left) to WebGL Scissor (Bottom-Left)
        // Note: We ignore pixelRatio here if we used setSize(w,h,false) above,
        // effectively mapping 1 CSS pixel to 1 Canvas pixel for simplicity.
        const { left, bottom, width: w, height: h } = req.rect;

        // Skip if off-screen
        if (bottom < 0 || left > width || left + w < 0) return;

        const scissorY = height - bottom; // Flip Y axis

        renderer.setViewport(left, scissorY, w, h);
        renderer.setScissor(left, scissorY, w, h);

        // Switch Material Logic
        if ('isDataArrayTexture' in req.texture && req.texture.isDataArrayTexture) {
          mesh.material = matArray;
          matArray.uniforms.tArray.value = req.texture;
          matArray.uniforms.uIndex.value = req.layerIndex;
        } else {
          mesh.material = matStandard;
          matStandard.map = req.texture as THREE.Texture;
        }

        renderer.render(scene, camera);
      });
    };
    render();

    return () => {
      cancelAnimationFrame(rAF);
      renderer.dispose();
      matStandard.dispose();
      matArray.dispose();
      geometry.dispose();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        pointerEvents: 'none', // Critical: Let clicks pass through to nodes
        zIndex: 9999, // On top of everything
      }}
    />
  );
};
