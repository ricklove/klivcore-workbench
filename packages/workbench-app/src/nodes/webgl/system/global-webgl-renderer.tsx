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
      alpha: true,
      antialias: true,
      preserveDrawingBuffer: false,
    });
    renderer.autoClear = false;

    // 2. Setup Texture Preview Helper (Quad)
    const quadScene = new THREE.Scene();
    const quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const geometry = new THREE.PlaneGeometry(2, 2);

    const matStandard = new THREE.MeshBasicMaterial({ color: 0xffffff });

    // GLSL 3.0 Shader for DataArrayTexture
    const matArray = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3, // <--- Fixes 'sampler2DArray' and syntax errors
      uniforms: {
        tArray: { value: null },
        uIndex: { value: 0 },
      },
      vertexShader: `
        in vec3 position;
        in vec2 uv;
        out vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        precision highp float;
        precision highp sampler2DArray;
        
        uniform sampler2DArray tArray;
        uniform float uIndex;
        in vec2 vUv;
        out vec4 fragColor;
        
        void main() {
          fragColor = texture(tArray, vec3(vUv, uIndex));
        }
      `,
    });

    // Explicitly type the mesh so it allows swapping materials
    const quadMesh = new THREE.Mesh(geometry, matStandard as THREE.Material);
    quadScene.add(quadMesh);

    // 3. Render Loop
    let rAF = 0;
    const render = () => {
      rAF = requestAnimationFrame(render);

      const width = window.innerWidth;
      const height = window.innerHeight;

      if (canvas.width !== width || canvas.height !== height) {
        renderer.setSize(width, height, false);
      }

      renderer.setScissorTest(false);
      renderer.clear();
      renderer.setScissorTest(true);

      const previews = webglPreviewStore$.get();

      Object.values(previews).forEach((req) => {
        if (!req.enabled) return;

        const { left, bottom, width: w, height: h } = req.rect;

        if (bottom < 0 || left > width || left + w < 0) return;
        const scissorY = height - bottom;

        renderer.setViewport(left, scissorY, w, h);
        renderer.setScissor(left, scissorY, w, h);

        if (req.data.type === 'texture') {
          // --- RENDER TEXTURE ---
          const tex = req.data.texture;

          if ('isDataArrayTexture' in tex && tex.isDataArrayTexture) {
            quadMesh.material = matArray;
            // Safe uniform access
            if (matArray.uniforms['tArray']) {
              matArray.uniforms['tArray'].value = tex;
            }
            if (matArray.uniforms['uIndex']) {
              matArray.uniforms['uIndex'].value = req.data.layerIndex;
            }
          } else {
            quadMesh.material = matStandard;
            matStandard.map = tex as THREE.Texture;
            // Ensure we update if the texture just loaded
            matStandard.needsUpdate = true;
          }

          renderer.render(quadScene, quadCamera);
        } else if (req.data.type === 'scene') {
          // --- RENDER SCENE ---
          const { scene, camera } = req.data;

          // Double cast to bypass strict structural checks
          const cam = camera as unknown as THREE.PerspectiveCamera;

          if (cam.isPerspectiveCamera) {
            const aspect = w / h;
            // Only update projection if strictly necessary (perf optimization)
            if (Math.abs(cam.aspect - aspect) > 0.01) {
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
