import { useGLTF } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { Box3, Vector3 } from "three";
import { useEffect, useRef } from "react";

export function Terrenos({ url, onTerrenoNode, modoConfrontantes }) {
  const { scene } = useGLTF(url);
  const fittedUrl = useRef(null);
  const { camera, controls } = useThree();
  // Guarda a posição/alvo da câmera de ANTES de entrar no modo
  // Confrontantes, pra poder devolver exatamente o mesmo enquadramento
  // 3D de antes quando o usuário desativa o modo (ETAPA 3, seção 7:
  // "Quando desativado: terreno normal").
  const cameraAnterior = useRef(null);
  const modoAnterior = useRef(false);
  // Bounding box já calculada pelo efeito de enquadramento abaixo --
  // reaproveitada pelo modo Confrontantes pra não recalcular e pra
  // nunca usar um valor "no chute" (ETAPA 3, seção 8/9).
  const fittedInfo = useRef(null);

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

  // Acha o node que carrega os extras gravados pelo Topo Textura
  // (topotexture_origin_x/y/z -- ver export/gltf_exporter.py). O
  // GLTFLoader copia `extras` do glTF para `userData` automaticamente.
  // Terrenos gerados antes dessa funcionalidade existir (ou vindos de
  // outra fonte) não têm esse node. Nessa situação, a raiz do GLB é
  // usada como referencial e a origem retornada pelo Backend é aplicada
  // pela mesma fórmula matemática, mantendo suporte aos GLBs antigos.
  useEffect(() => {
    let encontrado = null;
    scene.traverse((child) => {
      if (!encontrado && child.userData?.topotexture_origin_x !== undefined) {
        encontrado = child;
      }
    });
    onTerrenoNode?.(encontrado ?? scene);
  }, [scene, onTerrenoNode]);

  useEffect(() => {
    if (!scene || fittedUrl.current === url) return;

    const box = new Box3().setFromObject(scene);
    if (box.isEmpty()) return;

    const center = box.getCenter(new Vector3());

    // Centraliza o terreno no eixo X/Z e coloca a base dele em Y=0.
    // Isso evita que a rotação aconteça em torno de um ponto distante
    // do modelo e mantém o terreno alinhado com o fundo cartográfico.
    // eslint-disable-next-line react-hooks/immutability -- Three.js scene graph
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

    // eslint-disable-next-line react-hooks/immutability -- imperative Three.js camera
    camera.near = Math.max(maxSize / 100000, 0.001);
    camera.far = Math.max(maxSize * 100, 1000);
    camera.updateProjectionMatrix();

    if (controls) {
      controls.target.set(
        fittedCenter.x,
        fittedCenter.y,
        fittedCenter.z
      );
      // eslint-disable-next-line react-hooks/immutability -- OrbitControls API
      controls.minDistance = Math.max(maxSize * 0.08, 0.01);
      controls.maxDistance = Math.max(maxSize * 20, 1);
      controls.update();
    }

    fittedInfo.current = { center: fittedCenter, maxSize };
    fittedUrl.current = url;
  }, [scene, url, camera, controls]);

  // Visão superior do modo Confrontantes (ETAPA 3, seção 8): não usa
  // nenhuma posição fixa -- a altura da câmera é um múltiplo do maior
  // lado do bounding box já calculado acima, então funciona igual pra
  // terrenos de qualquer tamanho. Ao desativar, devolve a câmera
  // exatamente pra onde estava antes de entrar no modo.
  useEffect(() => {
    if (!controls || !fittedInfo.current) return;
    if (modoConfrontantes === modoAnterior.current) return;

    if (modoConfrontantes) {
      cameraAnterior.current = {
        position: camera.position.clone(),
        target: controls.target.clone(),
      };

      const { center, maxSize } = fittedInfo.current;
      camera.position.set(center.x, center.y + maxSize * 1.6, center.z + 0.0001);
      controls.target.set(center.x, center.y, center.z);
    } else if (cameraAnterior.current) {
      camera.position.copy(cameraAnterior.current.position);
      controls.target.copy(cameraAnterior.current.target);
    }

    camera.updateProjectionMatrix();
    controls.update();
    modoAnterior.current = modoConfrontantes;
  }, [modoConfrontantes, camera, controls]);

  return <primitive object={scene} />;
}
