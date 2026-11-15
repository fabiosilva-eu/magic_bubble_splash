import * as THREE from 'three';
import type { WaterDroplet } from './WaterPistol';

export interface BubblePopEvent {
  points: number;
  position: THREE.Vector3;
  colorHex: number;
}

interface SoapBubble {
  mesh: THREE.Mesh;
  radius: number;
  points: number;
  colorHex: number;
  riseSpeed: number;
  swayFreq: number;
  swayAmp: number;
  phase: number;
  baseX: number;
  baseZ: number;
}

const BUBBLE_PALETTE = [0x93c5fd, 0xf9a8d4, 0xc4b5fd, 0x6ee7b7, 0xfde047];

/**
 * Spawns, animates, and pops rising soap bubbles in the magic meadow.
 */
export class BubbleManager {
  private readonly bubbles: SoapBubble[] = [];
  private readonly sphereGeo = new THREE.SphereGeometry(1, 24, 18);
  private spawnTimer = 0;
  private readonly maxBubbles = 18;

  constructor(private readonly scene: THREE.Scene) {}

  reset(): void {
    for (const b of this.bubbles) {
      this.scene.remove(b.mesh);
      (b.mesh.material as THREE.Material).dispose();
    }
    this.bubbles.length = 0;
    this.spawnTimer = 0;
  }

  private spawnBubble(initialY?: number): void {
    const isGolden = Math.random() < 0.14;
    const isSmall = !isGolden && Math.random() < 0.3;

    const radius = isGolden ? 0.24 : isSmall ? 0.22 : 0.32 + Math.random() * 0.12;
    const points = isGolden ? 30 : isSmall ? 20 : 10;
    const colorHex = isGolden
      ? 0xfacc15
      : BUBBLE_PALETTE[Math.floor(Math.random() * BUBBLE_PALETTE.length)];

    const mat = new THREE.MeshPhysicalMaterial({
      color: colorHex,
      emissive: colorHex,
      emissiveIntensity: isGolden ? 0.35 : 0.18,
      transparent: true,
      opacity: isGolden ? 0.68 : 0.5,
      roughness: 0.05,
      metalness: 0.05,
      iridescence: 1.0,
      iridescenceIOR: 1.33,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05,
    });

    const mesh = new THREE.Mesh(this.sphereGeo, mat);
    mesh.scale.setScalar(radius);

    // Spawn mostly in front semicircle (-110 deg to +110 deg) so desktop & VR are both fun,
    // with occasional bubbles wider to the sides.
    const angle = (Math.random() - 0.5) * Math.PI * 1.35;
    const dist = 2.6 + Math.random() * 4.8;
    const baseX = Math.sin(angle) * dist;
    const baseZ = -Math.cos(angle) * dist;
    const y = initialY ?? -0.25;

    mesh.position.set(baseX, y, baseZ);
    this.scene.add(mesh);

    this.bubbles.push({
      mesh,
      radius,
      points,
      colorHex,
      riseSpeed: (isGolden ? 1.15 : isSmall ? 1.0 : 0.68) + Math.random() * 0.35,
      swayFreq: 1.2 + Math.random() * 1.2,
      swayAmp: 0.2 + Math.random() * 0.25,
      phase: Math.random() * Math.PI * 2,
      baseX,
      baseZ,
    });
  }

  seedInitialBubbles(count = 10): void {
    for (let i = 0; i < count; i++) {
      this.spawnBubble(0.6 + Math.random() * 3.2);
    }
  }

  update(
    dt: number,
    elapsed: number,
    droplets: WaterDroplet[],
    canPop: boolean,
    onPop: (event: BubblePopEvent) => void,
  ): void {
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0 && this.bubbles.length < this.maxBubbles) {
      this.spawnBubble();
      this.spawnTimer = 0.42;
    }

    for (let i = this.bubbles.length - 1; i >= 0; i--) {
      const b = this.bubbles[i];
      b.mesh.position.y += b.riseSpeed * dt;
      b.mesh.position.x = b.baseX + Math.sin(elapsed * b.swayFreq + b.phase) * b.swayAmp;
      b.mesh.position.z = b.baseZ + Math.cos(elapsed * b.swayFreq * 0.8 + b.phase) * (b.swayAmp * 0.6);

      // Gentle soap bubble wobble
      const wobble = 1 + Math.sin(elapsed * 4 + b.phase) * 0.04;
      b.mesh.scale.set(b.radius * wobble, b.radius / wobble, b.radius * wobble);

      if (b.mesh.position.y > 8.5) {
        this.removeBubbleAt(i);
        continue;
      }

      if (!canPop) continue;

      for (const droplet of droplets) {
        if (!droplet.active) continue;
        const hitDist = b.radius + droplet.radius + 0.04;
        if (b.mesh.position.distanceToSquared(droplet.mesh.position) <= hitDist * hitDist) {
          droplet.active = false;
          droplet.mesh.visible = false;

          const popPos = b.mesh.position.clone();
          const { points, colorHex } = b;
          this.removeBubbleAt(i);
          onPop({ points, position: popPos, colorHex });
          break;
        }
      }
    }
  }

  private removeBubbleAt(index: number): void {
    const b = this.bubbles[index];
    this.scene.remove(b.mesh);
    (b.mesh.material as THREE.Material).dispose();
    this.bubbles.splice(index, 1);
  }
}
