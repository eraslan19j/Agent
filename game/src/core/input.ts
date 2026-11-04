/* =========================================================
   AETHERION — input abstraction (touch + keyboard + mouse)
   ========================================================= */

export type ActionName =
  | 'attack'
  | 'skill'
  | 'burst'
  | 'jump'
  | 'sprint'
  | 'interact'
  | 'pause'
  | 'switch1'
  | 'switch2'
  | 'switch3'
  | 'switch4'
  | 'map';

interface BufferedAction {
  t: number;
}

const ACTION_BUFFER = 0.28; // seconds of input buffering (feels responsive on touch)

export class Input {
  /** Movement axis, -1..1 (x = strafe, y = forward). */
  moveX = 0;
  moveY = 0;
  sprintHeld = false;
  /** Camera look delta accumulated since last frame (radians-ish pixels). */
  lookX = 0;
  lookY = 0;
  /** Set by UI when a joystick is active (touch) so keyboard doesn't fight it. */
  usingJoystick = false;

  private actionQueue = new Map<ActionName, BufferedAction>();
  private keys = new Set<string>();
  private now = 0;
  private bound = false;

  attach() {
    if (this.bound) return;
    this.bound = true;
    window.addEventListener('keydown', this.onKeyDown, { passive: false });
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
  }

  detach() {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    this.bound = false;
  }

  private onBlur = () => {
    this.keys.clear();
    this.moveX = 0;
    this.moveY = 0;
    this.sprintHeld = false;
  };

  private onKeyDown = (e: KeyboardEvent) => {
    const code = e.code;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(code)) e.preventDefault();
    if (this.keys.has(code)) return; // ignore auto-repeat for actions
    this.keys.add(code);

    switch (code) {
      case 'Space':
        this.press('jump');
        break;
      case 'KeyJ':
      case 'KeyK':
        this.press('attack');
        break;
      case 'KeyE':
        this.press('skill');
        break;
      case 'KeyQ':
        this.press('burst');
        break;
      case 'KeyF':
        this.press('interact');
        break;
      case 'Escape':
      case 'KeyP':
        this.press('pause');
        break;
      case 'KeyM':
        this.press('map');
        break;
      case 'Digit1': this.press('switch1'); break;
      case 'Digit2': this.press('switch2'); break;
      case 'Digit3': this.press('switch3'); break;
      case 'Digit4': this.press('switch4'); break;
      case 'ShiftLeft':
      case 'ShiftRight':
        this.sprintHeld = true;
        break;
    }
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.sprintHeld = false;
  };

  /** Poll keyboard movement (keyboard only; joystick writes moveX/moveY directly). */
  updateKeyboardAxis() {
    if (this.usingJoystick) return;
    const k = this.keys;
    let x = 0, y = 0;
    if (k.has('KeyW') || k.has('ArrowUp')) y += 1;
    if (k.has('KeyS') || k.has('ArrowDown')) y -= 1;
    if (k.has('KeyA') || k.has('ArrowLeft')) x -= 1;
    if (k.has('KeyD') || k.has('ArrowRight')) x += 1;
    const len = Math.hypot(x, y) || 1;
    this.moveX = x / len;
    this.moveY = y / len;
  }

  press(action: ActionName) {
    this.actionQueue.set(action, { t: this.now });
  }

  setNow(t: number) {
    this.now = t;
    // drop stale buffered inputs
    for (const [k, v] of this.actionQueue) {
      if (t - v.t > ACTION_BUFFER) this.actionQueue.delete(k);
    }
  }

  consume(action: ActionName): boolean {
    const hit = this.actionQueue.get(action);
    if (!hit) return false;
    this.actionQueue.delete(action);
    return true;
  }

  isDown(action: 'sprint'): boolean {
    return this.sprintHeld;
  }

  addLook(dx: number, dy: number) {
    this.lookX += dx;
    this.lookY += dy;
  }

  clearTransient() {
    this.actionQueue.clear();
    this.lookX = 0;
    this.lookY = 0;
  }
}
