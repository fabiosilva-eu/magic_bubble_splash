import * as THREE from 'three';

export type MenuAction = 'start_timed' | 'start_milestone' | 'play_again' | 'main_menu';

interface SpatialButton {
  mesh: THREE.Mesh;
  action: MenuAction;
  baseColor: number;
  hoverColor: number;
}

function createCardTexture(
  width: number,
  height: number,
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    draw(ctx, width, height);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/**
 * 3D spatial UI for the Start Menu, Game Over screen, and in-VR HUD/Menu button.
 */
export class SpatialUI {
  readonly startGroup = new THREE.Group();
  readonly gameOverGroup = new THREE.Group();
  readonly playingGroup = new THREE.Group();

  private readonly buttons: SpatialButton[] = [];
  private hoveredButton: SpatialButton | null = null;

  private readonly hudCanvas: HTMLCanvasElement;
  private readonly hudCtx: CanvasRenderingContext2D | null;
  private readonly hudTexture: THREE.CanvasTexture;

  private readonly summaryMesh: THREE.Mesh;
  private milestoneBannerTimer = 0;
  private milestoneBannerText = '';

  constructor(scene: THREE.Scene) {
    // --- Start Menu ---
    this.startGroup.position.set(0, 1.65, -3.0);
    scene.add(this.startGroup);

    const titleTex = createCardTexture(900, 260, (ctx, w, h) => {
      const grad = ctx.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0, 'rgba(49, 27, 94, 0.92)');
      grad.addColorStop(1, 'rgba(88, 28, 135, 0.92)');
      ctx.fillStyle = grad;
      drawRoundedRect(ctx, 10, 10, w - 20, h - 20, 28);
      ctx.fill();

      ctx.strokeStyle = '#f472b6';
      ctx.lineWidth = 6;
      ctx.stroke();

      ctx.fillStyle = '#fef08a';
      ctx.font = 'bold 58px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('MAGIC BUBBLE SPLASH', w / 2, 105);

      ctx.fillStyle = '#e0f2fe';
      ctx.font = '28px system-ui, sans-serif';
      ctx.fillText('Shoot rising soap bubbles with your water pistol!', w / 2, 165);
      ctx.fillStyle = '#bae6fd';
      ctx.font = '24px system-ui, sans-serif';
      ctx.fillText('Water drops arc downward with distance — aim slightly high!', w / 2, 210);
    });
    const titlePlane = new THREE.Mesh(
      new THREE.PlaneGeometry(2.3, 0.66),
      new THREE.MeshBasicMaterial({ map: titleTex, transparent: true }),
    );
    titlePlane.position.set(0, 0.62, 0);
    this.startGroup.add(titlePlane);

    this.addButton(
      this.startGroup,
      {
        action: 'start_timed',
        x: -0.64,
        y: -0.18,
        width: 1.18,
        height: 0.68,
        title: 'TIMED MODE',
        subtitle: '60s fixed timer\nPlay for high score',
        bgHex: '#0284c7',
        borderHex: '#7dd3fc',
        baseColor: 0xffffff,
        hoverColor: 0xfef08a,
      },
    );

    this.addButton(
      this.startGroup,
      {
        action: 'start_milestone',
        x: 0.64,
        y: -0.18,
        width: 1.18,
        height: 0.68,
        title: 'MILESTONE MODE',
        subtitle: 'Bonus pts & +time\non milestones • Keep playing!',
        bgHex: '#9333ea',
        borderHex: '#f472b6',
        baseColor: 0xffffff,
        hoverColor: 0xfef08a,
      },
    );

    // --- Game Over Menu ---
    this.gameOverGroup.position.set(0, 1.65, -3.0);
    this.gameOverGroup.visible = false;
    scene.add(this.gameOverGroup);

    this.summaryMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(2.1, 0.72),
      new THREE.MeshBasicMaterial({ transparent: true }),
    );
    this.summaryMesh.position.set(0, 0.52, 0);
    this.gameOverGroup.add(this.summaryMesh);

    this.addButton(this.gameOverGroup, {
      action: 'play_again',
      x: -0.58,
      y: -0.22,
      width: 1.05,
      height: 0.45,
      title: 'PLAY AGAIN',
      subtitle: 'Same mode',
      bgHex: '#16a34a',
      borderHex: '#86efac',
      baseColor: 0xffffff,
      hoverColor: 0xfef08a,
    });

    this.addButton(this.gameOverGroup, {
      action: 'main_menu',
      x: 0.58,
      y: -0.22,
      width: 1.05,
      height: 0.45,
      title: 'MAIN MENU',
      subtitle: 'Change mode',
      bgHex: '#7e22ce',
      borderHex: '#f472b6',
      baseColor: 0xffffff,
      hoverColor: 0xfef08a,
    });

    // --- Playing Spatial HUD + Menu Button ---
    this.playingGroup.visible = false;
    scene.add(this.playingGroup);

    this.hudCanvas = document.createElement('canvas');
    this.hudCanvas.width = 768;
    this.hudCanvas.height = 192;
    this.hudCtx = this.hudCanvas.getContext('2d');
    this.hudTexture = new THREE.CanvasTexture(this.hudCanvas);
    this.hudTexture.colorSpace = THREE.SRGBColorSpace;

    const hudMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(2.1, 0.52),
      new THREE.MeshBasicMaterial({ map: this.hudTexture, transparent: true }),
    );
    hudMesh.position.set(0, 3.05, -4.4);
    this.playingGroup.add(hudMesh);

    this.addButton(this.playingGroup, {
      action: 'main_menu',
      x: -1.65,
      y: 2.95,
      z: -4.4,
      width: 0.72,
      height: 0.34,
      title: 'MENU',
      subtitle: 'Exit round',
      bgHex: '#4c1d95',
      borderHex: '#f472b6',
      baseColor: 0xffffff,
      hoverColor: 0xfef08a,
    });
  }

  private addButton(
    parent: THREE.Group,
    opts: {
      action: MenuAction;
      x: number;
      y: number;
      z?: number;
      width: number;
      height: number;
      title: string;
      subtitle: string;
      bgHex: string;
      borderHex: string;
      baseColor: number;
      hoverColor: number;
    },
  ): void {
    const tex = createCardTexture(512, 280, (ctx, w, h) => {
      ctx.fillStyle = opts.bgHex;
      drawRoundedRect(ctx, 10, 10, w - 20, h - 20, 28);
      ctx.fill();

      ctx.strokeStyle = opts.borderHex;
      ctx.lineWidth = 8;
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 42px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(opts.title, w / 2, 105);

      ctx.fillStyle = '#e0f2fe';
      ctx.font = '26px system-ui, sans-serif';
      const lines = opts.subtitle.split('\n');
      lines.forEach((line, idx) => {
        ctx.fillText(line, w / 2, 165 + idx * 36);
      });
    });

    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(opts.width, opts.height),
      new THREE.MeshBasicMaterial({
        map: tex,
        transparent: true,
        color: opts.baseColor,
      }),
    );
    mesh.position.set(opts.x, opts.y, opts.z ?? 0);
    parent.add(mesh);

    this.buttons.push({
      mesh,
      action: opts.action,
      baseColor: opts.baseColor,
      hoverColor: opts.hoverColor,
    });
  }

  setScreen(screen: 'menu' | 'playing' | 'gameover'): void {
    this.startGroup.visible = screen === 'menu';
    this.playingGroup.visible = screen === 'playing';
    this.gameOverGroup.visible = screen === 'gameover';
    this.setHovered(null);
  }

  updateGameOverSummary(
    modeLabel: string,
    score: number,
    bubblesPopped: number,
    milestonesHit: number,
  ): void {
    const tex = createCardTexture(860, 280, (ctx, w, h) => {
      ctx.fillStyle = 'rgba(49, 27, 94, 0.94)';
      drawRoundedRect(ctx, 10, 10, w - 20, h - 20, 28);
      ctx.fill();
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 6;
      ctx.stroke();

      ctx.fillStyle = '#fef08a';
      ctx.font = 'bold 48px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('ROUND COMPLETE!', w / 2, 82);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 42px system-ui, sans-serif';
      ctx.fillText(`Final Score: ${score}`, w / 2, 148);

      ctx.fillStyle = '#bae6fd';
      ctx.font = '26px system-ui, sans-serif';
      const extra = milestonesHit > 0 ? `  •  Milestones: ${milestonesHit}` : '';
      ctx.fillText(`${modeLabel}  •  Bubbles Popped: ${bubblesPopped}${extra}`, w / 2, 210);
    });

    const mat = this.summaryMesh.material as THREE.MeshBasicMaterial;
    mat.map?.dispose();
    mat.map = tex;
    mat.needsUpdate = true;
  }

  showMilestoneBanner(text: string): void {
    this.milestoneBannerText = text;
    this.milestoneBannerTimer = 2.5;
  }

  updatePlayingHUD(
    dt: number,
    score: number,
    timeLeft: number,
    modeLabel: string,
    nextMilestone: number | null,
  ): void {
    if (this.milestoneBannerTimer > 0) {
      this.milestoneBannerTimer = Math.max(0, this.milestoneBannerTimer - dt);
    }

    const ctx = this.hudCtx;
    if (!ctx) return;

    const w = this.hudCanvas.width;
    const h = this.hudCanvas.height;
    ctx.clearRect(0, 0, w, h);

    ctx.fillStyle = 'rgba(30, 27, 75, 0.82)';
    drawRoundedRect(ctx, 8, 8, w - 16, h - 16, 26);
    ctx.fill();
    ctx.strokeStyle = this.milestoneBannerTimer > 0 ? '#facc15' : '#38bdf8';
    ctx.lineWidth = 5;
    ctx.stroke();

    ctx.fillStyle = '#e0f2fe';
    ctx.font = 'bold 26px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(modeLabel, 36, 52);

    ctx.fillStyle = '#fef08a';
    ctx.font = 'bold 52px system-ui, sans-serif';
    ctx.fillText(`Score: ${score}`, 36, 118);

    ctx.textAlign = 'right';
    ctx.fillStyle = timeLeft <= 10 ? '#fda4af' : '#7dd3fc';
    ctx.font = 'bold 52px system-ui, sans-serif';
    ctx.fillText(`${Math.ceil(timeLeft)}s`, w - 36, 118);

    ctx.font = '24px system-ui, sans-serif';
    ctx.fillStyle = this.milestoneBannerTimer > 0 ? '#fde047' : '#cbd5e1';
    if (this.milestoneBannerTimer > 0) {
      ctx.fillText(this.milestoneBannerText, w - 36, 160);
    } else if (nextMilestone !== null) {
      ctx.fillText(`Next Milestone: ${nextMilestone} pts`, w - 36, 160);
    }

    this.hudTexture.needsUpdate = true;
  }

  /**
   * Raycasts against currently visible spatial menu buttons.
   */
  raycastButtons(raycaster: THREE.Raycaster): SpatialButton | null {
    const visibleMeshes = this.buttons
      .filter((b) => b.mesh.parent?.visible)
      .map((b) => b.mesh);

    if (visibleMeshes.length === 0) return null;

    const hits = raycaster.intersectObjects(visibleMeshes, false);
    if (hits.length === 0) return null;

    return this.buttons.find((b) => b.mesh === hits[0].object) ?? null;
  }

  setHovered(button: SpatialButton | null): void {
    if (this.hoveredButton === button) return;

    if (this.hoveredButton) {
      const mat = this.hoveredButton.mesh.material as THREE.MeshBasicMaterial;
      mat.color.setHex(this.hoveredButton.baseColor);
      this.hoveredButton.mesh.scale.setScalar(1);
    }

    this.hoveredButton = button;

    if (this.hoveredButton) {
      const mat = this.hoveredButton.mesh.material as THREE.MeshBasicMaterial;
      mat.color.setHex(this.hoveredButton.hoverColor);
      this.hoveredButton.mesh.scale.setScalar(1.06);
    }
  }

  getHoveredAction(): MenuAction | null {
    return this.hoveredButton?.action ?? null;
  }
}
