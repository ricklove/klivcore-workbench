import { ObservableHint } from '@legendapp/state';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/Addons.js';
import { EmptyNodeComponent } from '../../workflow/node-types-wrapper';
import {
  WorkflowBrandedTypes,
  type WorkflowRuntimeNodeTypeDefinition,
} from '../../workflow/types';
import { NodeTypeWrapComponentWithNodeWrapper } from './_deps.tsx';
import { type Box, box, unbox } from './types';

export const orbitControlsNodeTypes: WorkflowRuntimeNodeTypeDefinition[] = [
  {
    type: WorkflowBrandedTypes.typeName(`threeOrbitControls`),
    getComponent: () => ({
      Component: NodeTypeWrapComponentWithNodeWrapper(EmptyNodeComponent),
    }),
    inputs: [
      {
        name: WorkflowBrandedTypes.inputName(`camera`),
        type: WorkflowBrandedTypes.valueType(`Box<THREE.Camera>`),
      },
      {
        name: WorkflowBrandedTypes.inputName(`renderer`),
        type: WorkflowBrandedTypes.valueType(`Box<THREE.WebGLRenderer>`),
      },
    ],
    outputs: [
      {
        name: WorkflowBrandedTypes.outputName(`controls`),
        type: WorkflowBrandedTypes.valueType(`Box<OrbitControls>`),
      },
    ],
    execute: async ({ inputs, runtimeState }) => {
      const camera = unbox(inputs.camera as Box<THREE.Camera>);
      const renderer = unbox(inputs.renderer as Box<THREE.WebGLRenderer>);
      if (!renderer || !camera) {
        console.log(
          '[threeOrbitControls] handleResize missing camera or renderer',
          {
            camera,
            renderer,
          },
        );
        return;
      }

      const rs = runtimeState as {
        camera?: THREE.Camera;
        renderer?: THREE.WebGLRenderer;
        dispose?: () => void;
      };

      if (camera === rs.camera && renderer === rs.renderer) {
        return;
      }
      rs.dispose?.();
      rs.camera = camera;
      rs.renderer = renderer;

      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.05;

      const update = () => {
        controls.update();
        id = requestAnimationFrame(update);
      };
      let id = requestAnimationFrame(update);

      rs.dispose = () => {
        controls.dispose();
        cancelAnimationFrame(id);
      };

      return { outputs: { controls: ObservableHint.opaque(box(controls)) } };
    },
  },
  {
    type: WorkflowBrandedTypes.typeName(`threeOrbitControlsOriginGizmo`),
    getComponent: () => ({
      Component: NodeTypeWrapComponentWithNodeWrapper(EmptyNodeComponent),
    }),
    inputs: [
      {
        name: WorkflowBrandedTypes.inputName(`camera`),
        type: WorkflowBrandedTypes.valueType(`Box<THREE.Camera>`),
      },
      {
        name: WorkflowBrandedTypes.inputName(`controls`),
        type: WorkflowBrandedTypes.valueType(`Box<OrbitControls>`),
      },
    ],
    outputs: [
      {
        name: WorkflowBrandedTypes.outputName(`gizmo`),
        type: WorkflowBrandedTypes.valueType(`Box<THREE.Group>`),
      },
    ],
    execute: async ({ inputs, runtimeState }) => {
      const camera = unbox(inputs.camera as Box<THREE.Camera>);
      const controls = unbox(inputs.controls as Box<OrbitControls>);

      if (!camera || !controls) {
        return;
      }

      // Check if inputs have changed; if not, do nothing
      const rs = runtimeState as {
        scene?: THREE.Scene;
        camera?: THREE.Camera;
        controls?: OrbitControls;
        dispose?: () => void;
      };

      if (camera === rs.camera && controls === rs.controls) {
        return;
      }

      // Cleanup previous instance
      rs.dispose?.();
      rs.camera = camera;
      rs.controls = controls;

      // --- 1. Create Gizmo ---
      const gizmoGroup = new THREE.Group();

      // Sphere (Yellow Wireframe)
      const sphereGeom = new THREE.SphereGeometry(0.25, 16, 16);
      const sphereMat = new THREE.MeshBasicMaterial({
        color: 0xffff00,
        wireframe: true,
        depthTest: false, // Always visible through objects
        depthWrite: false,
        transparent: true,
        opacity: 0.5,
      });
      const sphere = new THREE.Mesh(sphereGeom, sphereMat);
      gizmoGroup.add(sphere);

      // Axes Helper (Red/Green/Blue)
      const axes = new THREE.AxesHelper(1.5);
      // Disable depth test for axes so they are always visible
      (axes.material as THREE.Material).depthTest = false;
      (axes.material as THREE.Material).transparent = true;
      gizmoGroup.add(axes);

      // --- 2. Update Loop ---
      const update = () => {
        // Sync Position with OrbitControls target
        gizmoGroup.position.copy(controls.target);

        // Sync Scale based on distance to camera (constant screen size)
        const distance = camera.position.distanceTo(controls.target);
        // Scale factor: Adjust 0.05 to make it larger/smaller on screen
        const scale = Math.max(0.001, distance * 0.05);
        gizmoGroup.scale.setScalar(scale);

        id = requestAnimationFrame(update);
      };

      let id = requestAnimationFrame(update);

      // --- 3. Cleanup ---
      rs.dispose = () => {
        cancelAnimationFrame(id);
        sphereGeom.dispose();
        sphereMat.dispose();
        axes.dispose();
      };

      return { outputs: { gizmo: ObservableHint.opaque(box(gizmoGroup)) } };
    },
  },
];
