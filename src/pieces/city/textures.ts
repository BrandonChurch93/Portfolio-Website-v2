import * as THREE from 'three';
import { seeded } from '../../world/build';

function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, srgb = true): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

// Stone paving: running bond slabs with varied tone, worn joints.
export function paving(a: string, b: string, joint: string, seed: number): THREE.CanvasTexture {
  const r = seeded(seed);
  return canvasTex(512, 512, (g) => {
    g.fillStyle = joint;
    g.fillRect(0, 0, 512, 512);
    const rows = 8, cols = 4;
    for (let j = 0; j < rows; j++) {
      const off = (j % 2) * 64;
      for (let i = -1; i < cols + 1; i++) {
        g.fillStyle = r() < 0.5 ? a : b;
        g.globalAlpha = 0.85 + r() * 0.15;
        g.fillRect(i * 128 + off + 2, j * 64 + 2, 124, 60);
      }
    }
    g.globalAlpha = 1;
    for (let k = 0; k < 2500; k++) { g.fillStyle = `rgba(0,0,0,${r() * 0.05})`; g.fillRect(r() * 512, r() * 512, 2, 2); }
  });
}

// Lawn: fine blade noise in warm gold greens.
export function lawn(seed: number): THREE.CanvasTexture {
  const r = seeded(seed);
  return canvasTex(256, 256, (g) => {
    g.fillStyle = '#5b5a2a';
    g.fillRect(0, 0, 256, 256);
    for (let k = 0; k < 9000; k++) {
      const v = r();
      g.fillStyle = v < 0.5 ? 'rgba(122,118,52,0.5)' : v < 0.8 ? 'rgba(86,84,38,0.5)' : 'rgba(150,132,64,0.45)';
      g.fillRect(r() * 256, r() * 256, 1, 2 + r() * 3);
    }
  });
}

// The slab's grid: fine lines every unit, brighter every fifth, as an emissive map.
export function grid(): THREE.CanvasTexture {
  return canvasTex(1024, 1024, (g) => {
    g.fillStyle = 'rgb(0,0,0)';
    g.fillRect(0, 0, 1024, 1024);
    for (let i = 0; i <= 20; i++) {
      const x = (i / 20) * 1024;
      g.strokeStyle = i % 5 === 0 ? 'rgba(255,170,90,0.55)' : 'rgba(255,170,90,0.18)';
      g.lineWidth = i % 5 === 0 ? 2 : 1;
      g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 1024); g.stroke();
      g.beginPath(); g.moveTo(0, x); g.lineTo(1024, x); g.stroke();
    }
  });
}
