import * as THREE from 'three';
import { createWaterPistolMesh } from './WaterPistol';

export type SelectHandler = (raycaster: THREE.Raycaster) => void;

export interface ControllerSlot {
  controller: THREE.XRTargetRaySpace;
  nozzleAnchor: THREE.Object3D;
  rayLine: THREE.Line;
  isTriggerDown: boolean;
}

/**
 * Manages WebXR controllers, attached 3D water pistols, menu laser rays,
 * trigger hold state, and thumbstick locomotion.
 */
export class VRInput {
  readonly slots: ControllerSlot[] = [];
  private readonly tempMatrix = new THREE.Matrix4();
  private readonly tempQuat = new THREE.Quaternion();
  private readonly raycaster = new THREE.Raycaster();
  private readonly moveForward = new THREE.Vector3();
  private readonly moveRight = new THREE.Vector3();
  private readonly worldUp = new THREE.Vector3(0, 1, 0);

  constructor(
    private readonly renderer: THREE.WebGLRenderer,
    private readonly cameraRig: THREE.Group,
    private readonly camera: THREE.PerspectiveCamera,
    onSelect: SelectHandler,
  ) {
    const lineGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, -1),
    ]);
    const lineMat = new THREE.LineBasicMaterial({
      color: 0xfef08a,
      transparent: true,
      opacity: 0.65,
    });

    for (let i = 0; i < 2; i++) {
      const controller = renderer.xr.getController(i);

      const { group: pistolGroup, nozzleAnchor } = createWaterPistolMesh();
      controller.add(pistolGroup);

      const rayLine = new THREE.Line(lineGeo, lineMat);
      rayLine.scale.z = 6;
      controller.add(rayLine);

      const slot: ControllerSlot = {
        controller,
        nozzleAnchor,
        rayLine,
        isTriggerDown: false,
      };

      controller.addEventListener('selectstart', () => {
        slot.isTriggerDown = true;
        onSelect(this.getControllerRaycaster(controller));
      });

      controller.addEventListener('selectend', () => {
        slot.isTriggerDown = false;
      });

      this.cameraRig.add(controller);
      this.slots.push(slot);
    }
  }

  setMenuRayVisible(visible: boolean): void {
    for (const slot of this.slots) {
      slot.rayLine.visible = visible;
    }
  }

  /**
   * Builds a Raycaster oriented along the given XR controller's pointing direction.
   */
  getControllerRaycaster(controller: THREE.XRTargetRaySpace): THREE.Raycaster {
    this.tempMatrix.identity().extractRotation(controller.matrixWorld);
    this.raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
    this.raycaster.ray.direction.set(0, 0, -1).applyMatrix4(this.tempMatrix);
    return this.raycaster;
  }

  /**
   * Writes the world-space nozzle origin and forward direction for the given controller slot.
   */
  getNozzleTransform(
    slot: ControllerSlot,
    outOrigin: THREE.Vector3,
    outDirection: THREE.Vector3,
  ): void {
    slot.nozzleAnchor.getWorldPosition(outOrigin);
    slot.controller.getWorldQuaternion(this.tempQuat);
    outDirection.set(0, 0, -1).applyQuaternion(this.tempQuat).normalize();
  }

  /**
   * Applies smooth thumbstick locomotion to the camera rig when in an active XR session.
   */
  updateLocomotion(dt: number, speed = 2.6): void {
    const session = this.renderer.xr.getSession();
    if (!session) return;

    for (const source of session.inputSources) {
      const gamepad = source.gamepad;
      if (!gamepad || gamepad.axes.length < 4) continue;

      const xAxis = gamepad.axes[2] ?? 0;
      const yAxis = gamepad.axes[3] ?? 0;
      const deadzone = 0.15;

      const moveX = Math.abs(xAxis) > deadzone ? xAxis : 0;
      const moveZ = Math.abs(yAxis) > deadzone ? yAxis : 0;
      if (moveX === 0 && moveZ === 0) continue;

      this.camera.getWorldDirection(this.moveForward);
      this.moveForward.y = 0;
      this.moveForward.normalize();

      this.moveRight.crossVectors(this.moveForward, this.worldUp).normalize();

      this.cameraRig.position.addScaledVector(this.moveForward, -moveZ * speed * dt);
      this.cameraRig.position.addScaledVector(this.moveRight, moveX * speed * dt);
    }
  }
}
