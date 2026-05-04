<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <script type="module">
    import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160/build/three.module.js";
    import { GLTFLoader } from "https://cdn.jsdelivr.net/npm/three@0.160/examples/jsm/loaders/GLTFLoader.js";
    import { OrbitControls } from "https://cdn.jsdelivr.net/npm/three@0.160/examples/jsm/controls/OrbitControls.js";

    const urlParams = new URLSearchParams(window.location.search);
    const modelUrl = urlParams.get("model");

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    const light = new THREE.HemisphereLight(0xffffff, 0x444444);
    scene.add(light);

    const controls = new OrbitControls(camera, renderer.domElement);

    const loader = new GLTFLoader();
    loader.load(modelUrl, (gltf) => {
      scene.add(gltf.scene);
    });

    camera.position.set(0, 5, 10);

    function animate() {
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    }

    animate();
  </script>
</head>
<body style="margin:0"></body>
</html>