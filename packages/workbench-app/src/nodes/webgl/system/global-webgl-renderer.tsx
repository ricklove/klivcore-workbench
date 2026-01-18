// File: packages\workbench-app\src\nodes\webgl\system\global-webgl-renderer.tsx
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { webglPreviewStore$ } from './webgl-preview-store';

export const GlobalWebGLRenderer = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // 1. Setup Single Global Renderer
    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true, // Allows DOM behind to show if scene background is null
      antialias: true,
      preserveDrawingBuffer: false,
    });
    renderer.autoClear = false; // WE CONTROL CLEARING

    // 2. Setup Texture Preview Helper (Quad)
    const quadScene = new THREE.Scene();
    const quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const geometry = new THREE.PlaneGeometry(2, 2);

    const matStandard = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const matArray = new THREE.ShaderMaterial({
      uniforms: { tArray: { value: null }, uIndex: { value: 0 } },
      vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position, 1.0); }`,
      fragmentShader: `
        precision highp sampler2DArray;
        uniform sampler2DArray tArray;
        uniform float uIndex;
        varying vec2 vUv;
        void main() { gl_FragColor = texture(tArray, vec3(vUv, uIndex)); }
      `,
    });
    const quadMesh = new THREE.Mesh(geometry, matStandard);
    quadScene.add(quadMesh);

    // 3. Render Loop
    let rAF = 0;
    const render = () => {
      rAF = requestAnimationFrame(render);

      // A. Resize Canvas to Window
      const width = window.innerWidth;
      const height = window.innerHeight;
      if (canvas.width !== width || canvas.height !== height) {
        renderer.setSize(width, height, false);
      }

      // B. Clear Global Screen
      renderer.setScissorTest(false);
      renderer.clear();
      renderer.setScissorTest(true);

      // C. Process Requests
      const previews = webglPreviewStore$.get();

      Object.values(previews).forEach((req) => {
        if (!req.enabled) return;

        // 1. Calculate Viewport
        const { left, bottom, width: w, height: h } = req.rect;

        // Skip off-screen
        if (bottom < 0 || left > width || left + w < 0) return;
        const scissorY = height - bottom;

        renderer.setViewport(left, scissorY, w, h);
        renderer.setScissor(left, scissorY, w, h);

        // 2. Render Strategy
        if (req.data.type === 'texture') {
          // --- RENDER TEXTURE QUAD ---
          const tex = req.data.texture;

          if ('isDataArrayTexture' in tex && tex.isDataArrayTexture) {
            quadMesh.material = matArray;
            matArray.uniforms.tArray.value = tex;
            matArray.uniforms.uIndex.value = req.data.layerIndex;
          } else {
            quadMesh.material = matStandard;
            matStandard.map = tex as THREE.Texture;
          }
          renderer.render(quadScene, quadCamera);
        } else if (req.data.type === 'scene') {
          // --- RENDER 3D SCENE ---
          const { scene, camera } = req.data;

          // Adjust aspect ratio to fit the node box
          if ((camera as THREE.PerspectiveCamera).isPerspectiveCamera) {
            const cam = camera as THREE.PerspectiveCamera;
            const aspect = w / h;
            if (cam.aspect !== aspect) {
              cam.aspect = aspect;
              cam.updateProjectionMatrix();
            }
          }

          renderer.render(scene, camera);
        }
      });
    };
    render();

    return () => {
      cancelAnimationFrame(rAF);
      renderer.dispose();
      geometry.dispose();
      matStandard.dispose();
      matArray.dispose();
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
        pointerEvents: 'none',
        zIndex: 9999,
      }}
    />
  );
};
