import * as THREE from 'three';
import { VRButton } from 'three/examples/jsm/webxr/VRButton.js';
import { SoundFX } from './Audio';
import { BubbleManager } from './BubbleManager';
import { MagicWorld } from './MagicWorld';
import { SpatialUI, type MenuAction } from './SpatialMenu';
import { VRInput } from './VRInput';
import { createWaterPistolMesh, WaterStream } from './WaterPistol';

type GameState = 'menu' | 'playing' | 'gameover';
type GameMode = 'timed' | 'milestone';

const TIMED_DURATION = 60;
const MILESTONE_START_DURATION = 45;
const MILESTONE_BONUS_POINTS = 50;
const MILESTONE_BONUS_TIME = 12;
const FIRE_INTERVAL = 0.045; // ~22 droplets/sec while trigger/mouse held

/**
 * Core WebXR Bubble Game orchestrator: manages menu, two game modes,
 * ballistic water pistols, rising soap bubbles, and desktop/VR input.
 */
export class Game {
  private readonly scene = new THREE.Scene();
  private readonly camera: THREE.PerspectiveCamera;
  private readonly cameraRig = new THREE.Group();
  private readonly renderer: THREE.WebGLRenderer;

  private readonly world: MagicWorld;
  private readonly bubbles: BubbleManager;
  private readonly waterStream: WaterStream;
  private readonly spatialUI: SpatialUI;
  private readonly vrInput: VRInput;
  private readonly sfx = new SoundFX();

  private readonly desktopPistol: THREE.Group;
  private readonly desktopNozzle: THREE.Object3D;
  private readonly pointer = new THREE.Vector2();
  private readonly desktopRaycaster = new THREE.Raycaster();
  private readonly clock = new THREE.Clock();

  private readonly tmpOrigin = new THREE.Vector3();
  private readonly tmpDir = new THREE.Vector3();
  private readonly tmpTarget = new THREE.Vector3();

  private state: GameState = 'menu';
  private mode: GameMode = 'timed';
  private score = 0;
  private timeLeft = TIMED_DURATION;
  private bubblesPopped = 0;
  private milestonesHit = 0;
  private nextMilestone = 100;

  private hasPointer = false;
  private isDesktopMouseDown = false;
  private fireCooldown = 0;
  private squirtSoundCooldown = 0;

  constructor(
    private readonly scoreEl: HTMLElement | null,
    private readonly statusEl: HTMLElement | null,
  ) {
    this.camera = new THREE.PerspectiveCamera(
      70,
      window.innerWidth / window.innerHeight,
      0.1,
      120,
    );
    this.camera.position.set(0, 1.6, 0);
    this.cameraRig.add(this.camera);
    this.scene.add(this.cameraRig);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.xr.enabled = true;
    document.body.appendChild(this.renderer.domElement);
    document.body.appendChild(VRButton.createButton(this.renderer));

    this.world = new MagicWorld(this.scene);
    this.bubbles = new BubbleManager(this.scene);
    this.bubbles.seedInitialBubbles(10);
    this.waterStream = new WaterStream(this.scene);
    this.spatialUI = new SpatialUI(this.scene);

    // Desktop water pistol attached to camera (rotated 180° on Y because Object3D.lookAt aligns +Z)
    const desktopGun = createWaterPistolMesh();
    desktopGun.group.rotation.y = Math.PI;
    this.desktopPistol = new THREE.Group();
    this.desktopPistol.add(desktopGun.group);
    this.desktopNozzle = desktopGun.nozzleAnchor;
    this.desktopPistol.position.set(0.28, -0.22, -0.45);
    this.camera.add(this.desktopPistol);

    this.vrInput = new VRInput(this.renderer, this.cameraRig, this.camera, (raycaster) => {
      this.handleSelectRay(raycaster);
    });

    this.bindEvents();
    this.syncHUDText();
  }

  start(): void {
    this.renderer.setAnimationLoop(() => this.tick());
  }

  private bindEvents(): void {
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });

    window.addEventListener('pointermove', (event) => {
      this.hasPointer = true;
      this.pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
      this.pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
    });

    window.addEventListener('pointerdown', (event) => {
      if (this.renderer.xr.isPresenting || event.button !== 0) return;
      this.isDesktopMouseDown = true;

      if (this.hasPointer) {
        this.desktopRaycaster.setFromCamera(this.pointer, this.camera);
        this.handleSelectRay(this.desktopRaycaster);
      }
    });

    window.addEventListener('pointerup', () => {
      this.isDesktopMouseDown = false;
    });

    this.renderer.xr.addEventListener('sessionstart', () => {
      this.desktopPistol.visible = false;
      this.syncHUDText();
    });

    this.renderer.xr.addEventListener('sessionend', () => {
      this.desktopPistol.visible = true;
      this.syncHUDText();
    });
  }

  private handleSelectRay(raycaster: THREE.Raycaster): void {
    const hitButton = this.spatialUI.raycastButtons(raycaster);
    if (!hitButton) return;

    this.sfx.playClick();
    this.triggerMenuAction(hitButton.action);
  }

  private triggerMenuAction(action: MenuAction): void {
    switch (action) {
      case 'start_timed':
        this.startRound('timed');
        break;
      case 'start_milestone':
        this.startRound('milestone');
        break;
      case 'play_again':
        this.startRound(this.mode);
        break;
      case 'main_menu':
        this.goToMenu();
        break;
    }
  }

  private goToMenu(): void {
    this.state = 'menu';
    this.waterStream.clear();
    this.spatialUI.setScreen('menu');
    this.vrInput.setMenuRayVisible(true);
    this.syncHUDText();
  }

  private startRound(mode: GameMode): void {
    this.mode = mode;
    this.state = 'playing';
    this.score = 0;
    this.bubblesPopped = 0;
    this.milestonesHit = 0;
    this.nextMilestone = 100;
    this.timeLeft = mode === 'timed' ? TIMED_DURATION : MILESTONE_START_DURATION;

    this.waterStream.clear();
    this.bubbles.reset();
    this.bubbles.seedInitialBubbles(12);
    this.spatialUI.setScreen('playing');
    this.vrInput.setMenuRayVisible(false);
    this.syncHUDText();
  }

  private endRound(): void {
    this.state = 'gameover';
    this.isDesktopMouseDown = false;
    this.waterStream.clear();

    const modeLabel = this.mode === 'timed' ? 'Timed Mode' : 'Milestone Mode';
    this.spatialUI.updateGameOverSummary(
      modeLabel,
      this.score,
      this.bubblesPopped,
      this.milestonesHit,
    );
    this.spatialUI.setScreen('gameover');
    this.vrInput.setMenuRayVisible(true);
    this.sfx.playMilestone();
    this.syncHUDText();
  }

  private checkMilestones(): void {
    if (this.mode !== 'milestone') return;

    while (this.score >= this.nextMilestone) {
      this.milestonesHit += 1;
      this.score += MILESTONE_BONUS_POINTS;
      this.timeLeft += MILESTONE_BONUS_TIME;
      this.spatialUI.showMilestoneBanner(
        `MILESTONE! +${MILESTONE_BONUS_POINTS} pts & +${MILESTONE_BONUS_TIME}s`,
      );
      this.sfx.playMilestone();

      const step = this.milestonesHit < 4 ? 150 + this.milestonesHit * 50 : 300;
      this.nextMilestone += step;
    }
  }

  private updateMenuHover(): void {
    if (this.renderer.xr.isPresenting) {
      for (const slot of this.vrInput.slots) {
        const hit = this.spatialUI.raycastButtons(
          this.vrInput.getControllerRaycaster(slot.controller),
        );
        if (hit) {
          this.spatialUI.setHovered(hit);
          this.vrInput.setMenuRayVisible(true);
          return;
        }
      }
      this.spatialUI.setHovered(null);
      this.vrInput.setMenuRayVisible(this.state !== 'playing');
      return;
    }

    if (this.hasPointer) {
      this.desktopRaycaster.setFromCamera(this.pointer, this.camera);
      this.spatialUI.setHovered(this.spatialUI.raycastButtons(this.desktopRaycaster));
    }
  }

  private updateDesktopPistolAim(): void {
    if (this.renderer.xr.isPresenting || !this.hasPointer) return;

    this.desktopRaycaster.setFromCamera(this.pointer, this.camera);
    this.tmpTarget
      .copy(this.desktopRaycaster.ray.origin)
      .addScaledVector(this.desktopRaycaster.ray.direction, 8);
    this.desktopPistol.lookAt(this.tmpTarget);
  }

  private handleWaterShooting(dt: number): void {
    if (this.state !== 'playing') return;

    // Don't spray if hovering the in-game MENU button
    if (this.spatialUI.getHoveredAction() !== null) return;

    this.fireCooldown = Math.max(0, this.fireCooldown - dt);
    this.squirtSoundCooldown = Math.max(0, this.squirtSoundCooldown - dt);

    if (this.renderer.xr.isPresenting) {
      let firedAny = false;
      for (const slot of this.vrInput.slots) {
        if (!slot.isTriggerDown || this.fireCooldown > 0) continue;
        this.vrInput.getNozzleTransform(slot, this.tmpOrigin, this.tmpDir);
        this.waterStream.fire(this.tmpOrigin, this.tmpDir);
        firedAny = true;
      }
      if (firedAny) {
        this.fireCooldown = FIRE_INTERVAL;
        if (this.squirtSoundCooldown <= 0) {
          this.sfx.playSquirt();
          this.squirtSoundCooldown = 0.12;
        }
      }
      return;
    }

    if (this.isDesktopMouseDown && this.fireCooldown <= 0) {
      this.desktopNozzle.getWorldPosition(this.tmpOrigin);
      this.desktopPistol.getWorldDirection(this.tmpDir);
      // Object3D.lookAt points +Z toward target, whereas our pistol mesh nozzle points -Z.
      // Invert if needed? No: Object3D.lookAt on non-camera objects aligns +Z toward target!
      // Wait: createWaterPistolMesh() has nozzle at -Z, so let's compute direction from pistol to tmpTarget.
      this.tmpDir.subVectors(this.tmpTarget, this.tmpOrigin).normalize();
      this.waterStream.fire(this.tmpOrigin, this.tmpDir);

      this.fireCooldown = FIRE_INTERVAL;
      if (this.squirtSoundCooldown <= 0) {
        this.sfx.playSquirt();
        this.squirtSoundCooldown = 0.12;
      }
    }
  }

  private syncHUDText(): void {
    if (this.statusEl) {
      if (this.state === 'menu') {
        this.statusEl.textContent = 'Choose a game mode on the 3D menu!';
      } else if (this.state === 'playing') {
        const modeLabel = this.mode === 'timed' ? 'Timed Mode' : 'Milestone Mode';
        this.statusEl.textContent = `${modeLabel} • Hold trigger / click to spray water!`;
      } else {
        this.statusEl.textContent = 'Round complete! Pick Play Again or Main Menu.';
      }
    }

    if (this.scoreEl) {
      if (this.state === 'playing') {
        this.scoreEl.textContent = `Score: ${this.score}  •  Time: ${Math.ceil(this.timeLeft)}s`;
      } else {
        this.scoreEl.textContent = `Score: ${this.score}`;
      }
    }
  }

  private tick(): void {
    const dt = Math.min(this.clock.getDelta(), 0.1);
    const elapsed = this.clock.elapsedTime;

    this.vrInput.updateLocomotion(dt);
    this.world.update(dt, elapsed);
    this.updateDesktopPistolAim();
    this.updateMenuHover();
    this.handleWaterShooting(dt);
    this.waterStream.update(dt);

    if (this.state === 'playing') {
      this.timeLeft -= dt;
      if (this.timeLeft <= 0) {
        this.timeLeft = 0;
        this.endRound();
      } else {
        const modeLabel = this.mode === 'timed' ? 'TIMED MODE' : 'MILESTONE MODE';
        this.spatialUI.updatePlayingHUD(
          dt,
          this.score,
          this.timeLeft,
          modeLabel,
          this.mode === 'milestone' ? this.nextMilestone : null,
        );
        this.syncHUDText();
      }
    }

    this.bubbles.update(
      dt,
      elapsed,
      this.waterStream.droplets,
      this.state === 'playing',
      (pop) => {
        this.score += pop.points;
        this.bubblesPopped += 1;
        this.waterStream.spawnPopBurst(pop.position, pop.colorHex);
        this.sfx.playPop(0.85 + Math.random() * 0.35);
        this.checkMilestones();
        this.syncHUDText();
      },
    );

    this.renderer.render(this.scene, this.camera);
  }
}
