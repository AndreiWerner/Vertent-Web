import { useGLTF } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { Box3, Vector3 } from "three";
import { useEffect, useRef } from "react";

export function Terrenos({ url }) {
  const { scene } = useGLTF(url);
  const fittedUrl = useRef(null);
  const { camera, controls } = useThree();

  useEffect(() => {
    scene.traverse((child) => {
      if (!child.isMesh || !child.material) return;

      const materials = Array.isArray(child.material)
        ? child.material
        : [child.material];

      materials.forEach((material) => {
        material.metalness = 0;
        material.roughness = 1;
        material.needsUpdate = true;
      });
    });
  }, [scene]);

  useEffect(() => {
    if (!scene || fittedUrl.current === url) return;

    const box = new Box3().setFromObject(scene);
    if (box.isEmpty()) return;

    const size = box.getSize(new Vector3());
    const center = box.getCenter(new Vector3());

    // Centraliza o terreno no eixo X/Z e coloca a base dele em Y=0.
    // Isso evita que a rotação aconteça em torno de um ponto distante
    // do modelo e mantém o terreno alinhado com o fundo cartográfico.
    scene.position.x -= center.x;
    scene.position.z -= center.z;
    scene.position.y -= box.min.y;

    const fittedBox = new Box3().setFromObject(scene);
    const fittedSize = fittedBox.getSize(new Vector3());
    const fittedCenter = fittedBox.getCenter(new Vector3());

    const maxSize = Math.max(
      fittedSize.x,
      fittedSize.y,
      fittedSize.z,
      0.001
    );

    // Distância calculada automaticamente para cada GLB.
    const fovRadians = (camera.fov * Math.PI) / 180;
    const distance = (maxSize / 2) / Math.tan(fovRadians / 2) * 1.65;

    camera.position.set(
      distance * 0.95,
      Math.max(distance * 0.65, maxSize * 0.35),
      distance * 0.95
    );

    camera.near = Math.max(maxSize / 100000, 0.001);
    camera.far = Math.max(maxSize * 100, 1000);
    camera.updateProjectionMatrix();

    if (controls) {
      controls.target.set(
        fittedCenter.x,
        fittedCenter.y,
        fittedCenter.z
      );
      controls.minDistance = Math.max(maxSize * 0.08, 0.01);
      controls.maxDistance = Math.max(maxSize * 20, 1);
      controls.update();
    }

    fittedUrl.current = url;
  }, [scene, url, camera, controls]);

  return <primitive object={scene} />;
}
