import { useGLTF } from "@react-three/drei";
import { useEffect } from "react";

export function Terrenos({ url }) {
  const { scene } = useGLTF(url);

  useEffect(() => {
    scene.traverse((child) => {
      if (child.isMesh && child.material) {
        child.material.metalness = 0;
        child.material.roughness = 1;
        child.material.needsUpdate = true;
      }
    });
  }, [scene]);

  return (
    <primitive
      object={scene}
      scale={0.01}
      position={[0, 0, 0]}
    />
  );
}