import './style.css';

import GUI from 'lil-gui';
import Stats from 'stats.js';
import * as THREE from 'three';
import { FBXLoader, GLTFLoader, OrbitControls, RGBELoader } from 'three-stdlib';
import {
  BatchedText,
  getCaretAtPoint,
  preloadFont,
  Text,
} from 'troika-three-text';

// const FONT_URL =
//   'https://cdn.jsdelivr.net/npm/@fontsource/roboto-mono@4.5.8/files/roboto-mono-latin-400-normal.woff';
const FONT_URL =
  'https://cdn.jsdelivr.net/npm/@fontsource/fira-code@4.5.12/files/fira-code-latin-400-normal.woff';

export class Sketch {
  constructor(props) {
    this.root = props.root;
    this.setup();
    this.resize();
    window.addEventListener('resize', this.resize);
    window.addEventListener('keydown', this.fullscreen);
    window.addEventListener('mousemove', this.mousemove);
    this.textInputEl = document.querySelector('#text-input');
    this.textInputEl.focus();
    // 防止输入中文太快了，导致不能监听空格确认输入某个中文
    this.textInputEl.addEventListener(
      'input',
      this.updateCaretPosBasedOnInputELementAndSyncTextContent.bind(this),
    );
    // press <- or ->, then change the caret location
    this.textInputEl.addEventListener(
      'keyup',
      this.updateCaretPosBasedOnInputELementAndSyncTextContent.bind(this),
    );
    window.addEventListener('click', (event) => {
      this.textInputEl.focus();
      this.textInputEl.value = this.myText.text;
      const mouse = new THREE.Vector2();
      mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
      this.raycaster.setFromCamera(mouse.clone(), this.camera);
      var objects = this.raycaster.intersectObjects(this.scene.children);
      if (objects.length === 0) return;
      const clickedPtInTextMesh = new THREE.Vector3(
        objects[0].point.x,
        objects[0].point.y,
        0,
      );
      this.myText.worldToLocal(clickedPtInTextMesh);
      const caretPos = getCaretAtPoint(
        this.myText._textRenderInfo,
        clickedPtInTextMesh.x,
        clickedPtInTextMesh.y,
      );
      this.cursorMesh.position.x = caretPos.x;
      this.caretIndex = caretPos.charIndex;
      this.setCaretPosition('text-input', this.caretIndex);
      this.firstActive = true;
    });
    this.firstActive = false;
  }

  setup() {
    this.guiProps = {};
    this.width = window.innerWidth;
    this.height = window.innerHeight;

    this.clock = new THREE.Clock();
    this.mouse = new THREE.Vector2();

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#111111');

    const fov = 50;
    const aspect = this.width / this.height;
    const near = 0.1;
    const far = 100;
    this.camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
    this.camera.position.set(0, 0, 20);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setAnimationLoop(this.update);
    this.renderer.physicallyCorrectLights = true;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1;
    this.renderer.outputEncoding = THREE.sRGBEncoding;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.root.appendChild(this.renderer.domElement);

    this.orbit = new OrbitControls(this.camera, this.renderer.domElement);
    this.orbit.enableDamping = true;

    this.stats = new Stats();
    this.root.appendChild(this.stats.dom);

    const loadingManager = new THREE.LoadingManager();
    this.gltfLoader = new GLTFLoader(loadingManager);
    this.fbxLoader = new FBXLoader(loadingManager);
    this.rgbeLoader = new RGBELoader(loadingManager);
    this.textureLoader = new THREE.TextureLoader(loadingManager);
    this.cubeTextureLoader = new THREE.CubeTextureLoader(loadingManager);

    this.addGui();
    this.addStuff();
    this.addLights();
  }

  addStuff() {
    /**
     * Add stuff here
     */
    const ball = new THREE.Mesh(
      new THREE.SphereGeometry(1, 64, 64),
      new THREE.MeshStandardMaterial({ color: 0xff0000 }),
    );
    ball.castShadow = true;
    ball.position.y = 1;
    // this.scene.add(ball);

    this.ground = new THREE.Mesh(
      new THREE.PlaneGeometry(50, 50, 50, 50),
      new THREE.MeshStandardMaterial({ side: THREE.DoubleSide }),
    );
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.position.y = 0;
    this.ground.receiveShadow = true;
    // this.scene.add(this.ground);

    const myScene = this.scene;

    const cursorGeometry = new THREE.PlaneGeometry(0.3, 2);
    const cursorMaterial = new THREE.MeshNormalMaterial({
      transparent: true,
    });
    this.cursorMesh = new THREE.Mesh(cursorGeometry, cursorMaterial);
    this.cursorMesh.material.opacity = 0;
    this.clock = new THREE.Clock();
    this.raycaster = new THREE.Raycaster();

    const initTextBatch = () => {
      // Create:
      const createText = (content, pos, color) => {
        const myText = new Text();
        myText.anchorX = 'left';
        myText.anchorY = 'top';
        // myText.position.set(pos);
        myText.position.x = pos[0];
        myText.position.y = pos[1];
        myText.position.z = pos[2];
        // Set properties to configure:
        myText.text = content;
        // myText.color = ;
        myText.color = color;
        myText.fontSize = 0.01;
        myText.font = FONT_URL;
        return myText;
      };

      const myText = createText(
        'HELLO, WORLD!',
        [Math.random(), Math.random(), Math.random()],
        Math.round(Math.random() * 0xffffff),
      );
      myScene.add(myText);
      this.myText = myText;
      myText.add(this.cursorMesh);
      myText.sync();

      const batch = new BatchedText();
      batch.font = FONT_URL;
      // batch.font = `mono`;
      // batch.font =
      //   'https://fonts.gstatic.com/s/robotomono/v22/L0x5DF4xlVMF-BfR8bXMIjhLq3-cXbKDO1w.woff';
      // batch.font =
      //   'https://fonts.gstatic.com/s/robotomono/v22/L0x5DF4xlVMF-BfR8bXMIjhLq3-cXbKDO1w.woff';
      // batch.fontSize = 0.1;
      // batch.frustumCulled = false;
      // batch.whiteSpace = 'pre'; // <--- This stops "   " from becoming " "
      // batch.letterSpacing = 0; // <--- Ensures 1 char = 1 unit width exactly

      for (let i = 0; i < 100; i++) {
        const doc = generateRandomDoc(1000, 120);
        const layers = parseColorLayers(doc);
        console.log(`parseColorLayers`, { layers });
        const pos = [Math.random(), Math.random(), Math.random()];
        for (const layer of layers) {
          const textObj = createText(layer.text, pos, layer.color);
          this.textObjs.push(textObj);
          batch.addText(textObj);
        }
      }
      batch.sync();
      myScene.add(batch);
      this.textBatch = batch;
    };

    preloadFont({ font: FONT_URL }, () => {
      // 2. Only run your logic once the font is loaded
      initTextBatch();
    });
  }
  textBatch = null;
  textObjs = [];

  addLights() {
    const ambientLight = new THREE.AmbientLight(0xffffff, 1);
    this.scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(10, 10, 10);
    directionalLight.shadow.mapSize.set(2048, 2048);
    // directionalLight.shadow.camera.left = 10
    // directionalLight.shadow.camera.right = -10
    // directionalLight.shadow.camera.top = 10
    // directionalLight.shadow.camera.bottom = -10
    directionalLight.shadow.camera.far = 30;
    directionalLight.shadow.camera.near = 1;
    directionalLight.castShadow = true;
    this.scene.add(directionalLight);
    // this.scene.add(new THREE.CameraHelper(directionalLight.shadow.camera));
  }

  addGui() {
    this.gui = new GUI({ width: 300 });
  }

  animate(time) {
    /**
     * Animate stuff here
     */
    if (this.firstActive) {
      this.updateCursorOpacity();
    }

    this.textObjs.forEach((t) => {
      // console.log(x);
      // x.position.x = (x.position.x + 0.01) % 1;
      t.position.y = (t.position.y - 0.0001 + 1) % 1;
      t.position.x = (t.position.x + 1) % 1;
      t.position.z = (t.position.z + 1) % 1;

      // const p = t.position;
      // const len = p.x * p.x + p.y * p.y + p.z * p.z;
      // if (len > 1) {
      //   // const x = p.x;
      //   // const y = p.y;
      //   const x = Math.random() * Math.random();
      //   const z = Math.random() * Math.random() * Math.sqrt(1 - x * x);
      //   const y = Math.sqrt(1 - x * x - z * z);
      //   const l = x * x + y * y + z * z;
      //   // console.log({ x, y, z, l });
      //   t.position.x = x;
      //   t.position.y = y;
      //   t.position.z = z;
      // }

      // if (Math.random() < 0.001) {
      //   x.text = `Updated! ${Date.now()}`;
      // }
      t.sync();
    });
  }

  update = () => {
    const time = this.clock.getElapsedTime();
    this.animate(time);
    this.stats.update();
    this.orbit.update();
    this.renderer.render(this.scene, this.camera);
  };

  resize = () => {
    this.width = window.innerWidth;
    this.height = window.innerHeight;

    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(this.width, this.height);
    this.renderer.setPixelRatio(window.devicePixelRatio);
  };

  fullscreen = (e) => {
    if (e.ctrlKey && e.code === 'Space') {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        this.renderer.domElement.requestFullscreen();
      }
    }
  };

  updateCaretPosBasedOnInputELementAndSyncTextContent(event) {
    this.caretIndex = event.target.selectionStart;
    console.log(this.caretIndex);
    this.myText.text = this.textInputEl.value;
    this.myText._needsSync = true;
    this.myText.sync(() => {
      const { caretPositions } = this.myText._textRenderInfo;
      this.cursorMesh.position.x =
        caretPositions[this.caretIndex * 4] ??
        caretPositions[caretPositions.length - 3]; // 这里的减三是来自于troika three text 中的textRenderInfo设定
    });
  }
  mousemove = (e) => {
    this.mouse.x = e.clientX / this.width - 0.5;
    this.mouse.y = 0.5 - e.clientY / this.height;
  };

  updateCursorOpacity() {
    const roundPulse = (t) =>
      Math.sign(Math.sin(t * Math.PI)) * Math.sin((t % 1) * 3.14) ** 0.2;
    if (document.hasFocus() && document.activeElement === this.textInputEl) {
      this.cursorMesh.material.opacity = roundPulse(
        2 * this.clock.getElapsedTime(),
      );
    } else {
      this.cursorMesh.material.opacity = 0;
    }
  }
  setCaretPosition(elemId, caretPos) {
    var elem = document.getElementById(elemId);
    if (elem != null) {
      if (elem.createTextRange) {
        var range = elem.createTextRange();
        range.move('character', caretPos);
        range.select();
      } else {
        if (elem.setSelectionRange) {
          elem.focus();
          elem.setSelectionRange(caretPos, caretPos);
        }
      }
    }
  }
}

new Sketch({
  root: document.getElementById('app'),
});

function parseColorLayers(text, defaultColor = '#ffffff') {
  // 1. Parse the string into an intermediate "Char Map"
  //    This maps every character position to a specific color.
  const charMap = [];
  let currentColor = defaultColor;
  let i = 0;

  // Track all unique colors found to initialize layers later
  const uniqueColors = new Set([defaultColor]);

  while (i < text.length) {
    // Check for Tag: $#......
    if (text[i] === '$' && text[i + 1] === '#') {
      const potentialHex = text.substr(i + 2, 6);

      // Simple Regex to validate hex code
      if (/^[0-9a-fA-F]{6}$/.test(potentialHex)) {
        currentColor = '#' + potentialHex;
        uniqueColors.add(currentColor);

        i += 8; // Advance past "$#123456"

        // Rule: Eat exactly one extra space if present
        if (text[i] === ' ') {
          i++;
        }
        continue;
      }
    }

    // Capture standard character
    charMap.push({ char: text[i], color: currentColor });
    i++;
  }

  // 2. Build the layers
  //    For every unique color, we create a full string.
  //    If the char matches the layer color -> use char.
  //    If the char is a newline -> usage newline (keep sync).
  //    Otherwise -> use space.
  const layers = {};

  // Initialize builders
  uniqueColors.forEach((c) => (layers[c] = ''));

  charMap.forEach((item) => {
    uniqueColors.forEach((colorKey) => {
      if (item.char === '\n') {
        // Always preserve newlines in all layers to keep vertical alignment
        layers[colorKey] += '\n';
      } else if (item.color === colorKey) {
        // This character belongs to this layer
        layers[colorKey] += item.char;
      } else {
        // Placeholder space for alignment
        layers[colorKey] += ' ';
      }
    });
  });

  // 3. Format Output
  //    Convert to array and apply trimEnd() to every line
  return Object.keys(layers)
    .map((color) => {
      // Split by newline, trim the end of each line, rejoin
      const rawText = layers[color];
      const trimmedText = rawText
        .split('\n')
        .map((line) => line.trimEnd())
        .join('\n');

      return {
        text: trimmedText,
        color: color, // Pass this directly to Troika color
      };
    })
    .filter((layer) => layer.text.length > 0); // Remove completely empty layers
}

function generateRandomDoc(wordCount, maxLineChars = 80) {
  // VSCode-like Palette (Dark Mode)
  // const PALETTE = [
  //   '569cd6', // Blue (Keywords)
  //   '4ec9b0', // Teal (Types/Classes)
  //   'c586c0', // Purple (Control Flow)
  //   'dcdcaa', // Yellow (Functions)
  //   'ce9178', // Orange (Strings)
  //   '9cdcfe', // Light Blue (Variables)
  //   'd4d4d4', // White (Default)
  //   '6a9955', // Green (Comments)
  // ];
  // Intense / Neon Palette
  const PALETTE = [
    '3399ff', // Neon Blue (Keywords)
    '00ffcc', // Neon Teal (Types)
    'ff33cc', // Hot Pink (Control Flow)
    'ffff00', // Pure Yellow (Functions)
    'ff6600', // Bright Orange (Strings)
    '00ffff', // Cyan (Variables)
    'ffffff', // Pure White (Default)
    '33ff00', // Lime Green (Comments)
  ];

  // Common Code Words
  const WORDS = [
    'const',
    'let',
    'var',
    'function',
    'return',
    'import',
    'from',
    'class',
    'if',
    'else',
    'switch',
    'case',
    'break',
    'try',
    'catch',
    'finally',
    'true',
    'false',
    'null',
    'undefined',
    'async',
    'await',
    'new',
    'this',
    'console',
    'log',
    'map',
    'filter',
    'reduce',
    'length',
    'push',
    'pop',
    'window',
    'document',
    'HTMLElement',
    'requestAnimationFrame',
    'Error',
    ...`(){}[];.,<>?/\\|!@#$%^&*-+=~`.split(''),
  ];

  let output = '';
  let currentLineLen = 0;

  for (let i = 0; i < wordCount; i++) {
    // 1. Pick Random Word & Color
    const word = WORDS[Math.floor(Math.random() * WORDS.length)];
    const color = PALETTE[Math.floor(Math.random() * PALETTE.length)];

    // 2. Check Line Wrap (based on visible word length)
    // +1 accounts for the space we add before the word (if not start of line)
    const padding = currentLineLen === 0 ? 0 : 1;

    if (
      currentLineLen + padding + word.length > maxLineChars ||
      Math.random() < 0.1
    ) {
      output += '\n';
      currentLineLen = 0;

      // random tabs
      const tabs = [...new Array(Math.floor(Math.random() * 5))]
        .map((x) => [`    `])
        .join();
      output += tabs;
      currentLineLen = tabs.length;
    } else if (i > 0) {
      // Add space between words if not a new line
      output += ' ';
      currentLineLen += 1;
    }

    // 3. Append Tag + Word
    // Format: $#RRGGBB Word
    // The parser consumes the space immediately after the hex code.
    output += `$#${color} ${word}`;

    currentLineLen += word.length;
  }

  return output;
}
