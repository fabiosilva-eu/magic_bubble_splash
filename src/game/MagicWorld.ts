import * as THREE from 'three';

interface FloatingProp {
  object: THREE.Object3D;
  baseY: number;
  speed: number;
  phase: number;
}

/**
 * Builds and animates the cartoon magic environment: gradient sky dome,
 * twinkling sparkles, stylized clouds, floating crystals, and pastel meadow.
 */
export class MagicWorld {
  private readonly floatingProps: FloatingProp[] = [];
  private readonly sparkles: THREE.Points;
  private readonly sparkleBaseY: Float32Array;

  constructor(scene: THREE.Scene) {
    scene.fog = new THREE.FogExp2(0x2a1b4e, 0.018);

    this.setupLighting(scene);
    this.setupSkyDome(scene);
    this.setupGround(scene);
    this.setupClouds(scene);
    this.setupCrystals(scene);

    const { points, baseY } = this.createSparkles(scene);
    this.sparkles = points;
    this.sparkleBaseY = baseY;
  }

  private setupLighting(scene: THREE.Scene): void {
    const hemi = new THREE.HemisphereLight(0xffd6ff, 0x3b2d6b, 1.15);
    scene.add(hemi);

    const sun = new THREE.DirectionalLight(0xfff1d6, 1.5);
    sun.position.set(8, 14, 6);
    scene.add(sun);

    const rim = new THREE.DirectionalLight(0x7dd3fc, 0.7);
    rim.position.set(-10, 6, -12);
    scene.add(rim);
  }

  private setupSkyDome(scene: THREE.Scene): void {
    const skyGeo = new THREE.SphereGeometry(55, 32, 24);
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        topColor: { value: new THREE.Color(0x1e1b4b) },
        midColor: { value: new THREE.Color(0x7e22ce) },
        horizonColor: { value: new THREE.Color(0xf472b6) },
        bottomColor: { value: new THREE.Color(0x38bdf8) },
      },
      vertexShader: `
        varying vec3 vWorldPos;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPos = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 midColor;
        uniform vec3 horizonColor;
        uniform vec3 bottomColor;
        varying vec3 vWorldPos;
        void main() {
          float h = normalize(vWorldPos).y;
          vec3 col = mix(horizonColor, midColor, smoothstep(0.0, 0.45, max(h, 0.0)));
          col = mix(col, topColor, smoothstep(0.35, 0.95, max(h, 0.0)));
          if (h < 0.0) {
            col = mix(horizonColor, bottomColor, smoothstep(0.0, -0.35, h));
          }
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });

    scene.add(new THREE.Mesh(skyGeo, skyMat));
  }

  private setupGround(scene: THREE.Scene): void {
    const groundGeo = new THREE.CircleGeometry(45, 48);
    const groundMat = new THREE.MeshToonMaterial({
      color: 0x3b2d7a,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);

    // Decorative pastel magic rings on the meadow floor
    const ringColors = [0x38bdf8, 0xf472b6, 0xa855f7];
    [4.5, 9.5, 16].forEach((radius, idx) => {
      const ringGeo = new THREE.RingGeometry(radius - 0.08, radius + 0.08, 64);
      const ringMat = new THREE.MeshBasicMaterial({
        color: ringColors[idx % ringColors.length],
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.35,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.01;
      scene.add(ring);
    });
  }

  private setupClouds(scene: THREE.Scene): void {
    const cloudMat = new THREE.MeshToonMaterial({
      color: 0xfce7f3,
      emissive: 0x4c1d95,
      emissiveIntensity: 0.15,
    });
    const puffGeo = new THREE.SphereGeometry(1, 14, 12);

    for (let i = 0; i < 10; i++) {
      const group = new THREE.Group();
      const puffs = 3 + (i % 3);
      for (let p = 0; p < puffs; p++) {
        const puff = new THREE.Mesh(puffGeo, cloudMat);
        const scale = 0.9 + ((p + i) % 3) * 0.45;
        puff.scale.set(scale * 1.2, scale * 0.85, scale);
        puff.position.set((p - puffs / 2) * 1.1, (p % 2) * 0.35, (p % 3 - 1) * 0.3);
        group.add(puff);
      }

      const angle = (i / 10) * Math.PI * 2;
      const dist = 20 + (i % 3) * 6;
      const baseY = 9 + (i % 4) * 2.2;
      group.position.set(Math.cos(angle) * dist, baseY, Math.sin(angle) * dist);
      group.lookAt(0, baseY, 0);
      scene.add(group);

      this.floatingProps.push({
        object: group,
        baseY,
        speed: 0.4 + (i % 3) * 0.15,
        phase: i * 1.1,
      });
    }
  }

  private setupCrystals(scene: THREE.Scene): void {
    const crystalGeo = new THREE.OctahedronGeometry(0.65, 0);
    const colors = [0x38bdf8, 0xf472b6, 0xfacc15, 0xc084fc];

    for (let i = 0; i < 8; i++) {
      const mat = new THREE.MeshToonMaterial({
        color: colors[i % colors.length],
        emissive: colors[i % colors.length],
        emissiveIntensity: 0.35,
      });
      const crystal = new THREE.Mesh(crystalGeo, mat);
      crystal.scale.set(0.7, 1.5, 0.7);

      const angle = (i / 8) * Math.PI * 2 + 0.3;
      const dist = 12 + (i % 2) * 4;
      const baseY = 2.2 + (i % 3) * 1.2;
      crystal.position.set(Math.cos(angle) * dist, baseY, Math.sin(angle) * dist);
      scene.add(crystal);

      this.floatingProps.push({
        object: crystal,
        baseY,
        speed: 0.9 + (i % 3) * 0.25,
        phase: i * 0.9,
      });
    }
  }

  private createSparkles(scene: THREE.Scene): {
    points: THREE.Points;
    baseY: Float32Array;
  } {
    const count = 160;
    const positions = new Float32Array(count * 3);
    const baseY = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 4 + Math.random() * 24;
      const y = 0.6 + Math.random() * 14;
      positions[i * 3] = Math.cos(angle) * radius;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = Math.sin(angle) * radius;
      baseY[i] = y;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const mat = new THREE.PointsMaterial({
      color: 0xfef08a,
      size: 0.16,
      transparent: true,
      opacity: 0.85,
    });

    const points = new THREE.Points(geo, mat);
    scene.add(points);
    return { points, baseY };
  }

  update(dt: number, elapsed: number): void {
    for (const prop of this.floatingProps) {
      prop.object.position.y = prop.baseY + Math.sin(elapsed * prop.speed + prop.phase) * 0.45;
      if (prop.object instanceof THREE.Mesh) {
        prop.object.rotation.y += dt * 0.6;
      }
    }

    const posAttr = this.sparkles.geometry.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < posAttr.count; i++) {
      posAttr.setY(i, this.sparkleBaseY[i] + Math.sin(elapsed * 1.4 + i) * 0.35);
    }
    posAttr.needsUpdate = true;
    this.sparkles.rotation.y += dt * 0.03;
  }
}
