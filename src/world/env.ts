import * as THREE from 'three';

// A studio for metal: a dark warm room with a large soft key above and in front, a tall strip to one side, a rim
// strip behind and a low warm bounce card. Polished brass shows these as long soft reflections, which is what makes
// it read as metal and not as yellow paint. Built once and turned into an environment map by the stage.
export function studioScene(): THREE.Scene {
  const s = new THREE.Scene();
  const room = new THREE.Mesh(new THREE.BoxGeometry(14, 9, 14), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.012, 0.009, 0.007), side: THREE.BackSide }));
  room.position.y = 2;
  s.add(room);
  const card = (w: number, h: number, k: number, tint: [number, number, number], p: [number, number, number], look: [number, number, number]) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(...tint).multiplyScalar(k), side: THREE.DoubleSide }));
    m.position.set(...p);
    m.lookAt(...look);
    s.add(m);
  };
  card(4.2, 2.2, 3.6, [1, 0.93, 0.84], [0.4, 3.6, 2.6], [0, 0, 0]);
  card(0.7, 3.8, 1.3, [1, 0.9, 0.78], [-4.2, 1.4, 1.2], [0, 0.6, 0]);
  card(0.5, 3.2, 1.6, [1, 0.8, 0.6], [3.8, 1.6, -3.4], [0, 0.4, 0]);
  card(4.5, 0.9, 0.45, [1, 0.6, 0.3], [0, -1.4, 3.6], [0, 0.4, 0]);
  return s;
}
