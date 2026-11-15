import * as THREE from 'three';

export interface WaterDroplet {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  age: number;
  active: boolean;
  radius: number;
}

interface SplashParticle {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
}

const DROPLET_GRAVITY = 8.5;
const DROPLET_SPEED = 12.5;
const DROPLET_MAX_AGE = 2.2;
const DROPLET_RADIUS = 0.065;

/**
 * Builds a stylized cartoon 3D water pistol mesh oriented along -Z (nozzle forward).
 */
export function createWaterPistolMesh(): {
  group: THREE.Group;
  nozzleAnchor: THREE.Object3D;
} {
  const group = new THREE.Group();

  const bodyMat = new THREE.MeshToonMaterial({ color: 0x38bdf8 });
  const accentMat = new THREE.MeshToonMaterial({ color: 0xfacc15 });
  const gripMat = new THREE.MeshToonMaterial({ color: 0xf97316 });
  const tankMat = new THREE.MeshPhysicalMaterial({
    color: 0x7dd3fc,
    transparent: true,
    opacity: 0.7,
    roughness: 0.1,
    transmission: 0.3,
  });

  // Main barrel
  const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.065, 0.24), bodyMat);
  barrel.position.set(0, 0.02, -0.06);
  group.add(barrel);

  // Nozzle tip
  const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.024, 0.05, 12), accentMat);
  nozzle.rotation.x = Math.PI / 2;
  nozzle.position.set(0, 0.02, -0.2);
  group.add(nozzle);

  // Water tank on top
  const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.13, 14), tankMat);
  tank.rotation.x = Math.PI / 2;
  tank.position.set(0, 0.075, -0.03);
  group.add(tank);

  // Handle / grip
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.12, 0.052), gripMat);
  grip.position.set(0, -0.055, 0.02);
  grip.rotation.x = 0.25;
  group.add(grip);

  // Trigger guard accent
  const trigger = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.032, 0.025), accentMat);
  trigger.position.set(0, -0.022, -0.025);
  group.add(trigger);

  const nozzleAnchor = new THREE.Object3D();
  nozzleAnchor.position.set(0, 0.02, -0.23);
  group.add(nozzleAnchor);

  return { group, nozzleAnchor };
}

/**
 * Manages ballistic water droplets fired from water pistols and bubble-pop splash bursts.
 */
export class WaterStream {
  readonly droplets: WaterDroplet[] = [];
  private readonly splashes: SplashParticle[] = [];
  private readonly dropletGeo = new THREE.SphereGeometry(DROPLET_RADIUS, 10, 8);
  private readonly dropletMat = new THREE.MeshToonMaterial({
    color: 0x7dd3fc,
    emissive: 0x0ea5e9,
    emissiveIntensity: 0.35,
  });
  private readonly splashGeo = new THREE.SphereGeometry(0.035, 8, 6);

  constructor(private readonly scene: THREE.Scene) {}

  /**
   * Fires a water droplet from the given world origin and direction with slight spread.
   */
  fire(origin: THREE.Vector3, direction: THREE.Vector3): void {
    let droplet = this.droplets.find((d) => !d.active);
    if (!droplet) {
      if (this.droplets.length >= 120) {
        // Reuse oldest droplet if pool is full
        droplet = this.droplets.reduce((oldest, curr) => (curr.age > oldest.age ? curr : oldest));
      } else {
        const mesh = new THREE.Mesh(this.dropletGeo, this.dropletMat);
        this.scene.add(mesh);
        droplet = {
          mesh,
          velocity: new THREE.Vector3(),
          age: 0,
          active: false,
          radius: DROPLET_RADIUS,
        };
        this.droplets.push(droplet);
      }
    }

    droplet.active = true;
    droplet.age = 0;
    droplet.mesh.visible = true;
    droplet.mesh.position.copy(origin);
    droplet.mesh.scale.set(0.9, 0.9, 1.35);

    droplet.velocity.copy(direction).normalize().multiplyScalar(DROPLET_SPEED);
    // Slight playful spray spread
    droplet.velocity.x += (Math.random() - 0.5) * 0.35;
    droplet.velocity.y += (Math.random() - 0.5) * 0.35;
    droplet.velocity.z += (Math.random() - 0.5) * 0.35;
  }

  /**
   * Spawns a small colorful pop-burst of droplets when a bubble pops.
   */
  spawnPopBurst(position: THREE.Vector3, colorHex: number): void {
    const mat = new THREE.MeshBasicMaterial({
      color: colorHex,
      transparent: true,
      opacity: 0.9,
    });

    for (let i = 0; i < 8; i++) {
      const mesh = new THREE.Mesh(this.splashGeo, mat.clone());
      mesh.position.copy(position);
      this.scene.add(mesh);

      const velocity = new THREE.Vector3(
        (Math.random() - 0.5) * 3.8,
        Math.random() * 2.5 + 0.5,
        (Math.random() - 0.5) * 3.8,
      );

      this.splashes.push({
        mesh,
        velocity,
        life: 0,
        maxLife: 0.45 + Math.random() * 0.2,
      });
    }
  }

  update(dt: number): void {
    for (const droplet of this.droplets) {
      if (!droplet.active) continue;

      droplet.age += dt;
      droplet.velocity.y -= DROPLET_GRAVITY * dt;
      droplet.mesh.position.addScaledVector(droplet.velocity, dt);

      if (droplet.mesh.position.y <= 0.03 || droplet.age >= DROPLET_MAX_AGE) {
        droplet.active = false;
        droplet.mesh.visible = false;
      }
    }

    for (let i = this.splashes.length - 1; i >= 0; i--) {
      const s = this.splashes[i];
      s.life += dt;
      if (s.life >= s.maxLife) {
        this.scene.remove(s.mesh);
        (s.mesh.material as THREE.Material).dispose();
        this.splashes.splice(i, 1);
        continue;
      }

      s.velocity.y -= DROPLET_GRAVITY * 0.6 * dt;
      s.mesh.position.addScaledVector(s.velocity, dt);
      const t = 1 - s.life / s.maxLife;
      s.mesh.scale.setScalar(t);
      (s.mesh.material as THREE.MeshBasicMaterial).opacity = t;
    }
  }

  clear(): void {
    for (const droplet of this.droplets) {
      droplet.active = false;
      droplet.mesh.visible = false;
    }
  }
}
