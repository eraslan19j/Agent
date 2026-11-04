/* =========================================================
   AETHERION — menu screens (pause, settings, inventory, map,
   party, codex)
   ========================================================= */
import { CHARACTERS, PARTY_ORDER, getCharacter, WEAPON_LABEL } from '../data/characters';
import { ELEMENTS, REACTION_CODEX } from '../data/elements';
import { ITEMS } from '../data/items';
import { QUESTS } from '../data/quests';
import { LANDMARKS } from '../data/world';
import type { GameContext } from '../game/types';
import { clamp } from '../core/utils';

export type ScreenName = 'pause' | 'settings' | 'inventory' | 'map' | 'party' | 'codex' | 'journal' | null;

export class Screens {
  private layer = document.getElementById('screen')!;
  private panel = document.getElementById('screen-panel')!;
  current: ScreenName = null;
  onExitToMenu: (() => void) | null = null;
  onResume: (() => void) | null = null;

  constructor(private ctx: GameContext) {}

  get isOpen() {
    return this.current !== null;
  }

  open(name: ScreenName) {
    this.current = name;
    this.layer.classList.remove('hidden');
    this.render();
    this.ctx.audio.ui();
  }

  close() {
    this.current = null;
    this.layer.classList.add('hidden');
    this.panel.innerHTML = '';
    this.ctx.audio.uiBack();
  }

  toggle(name: ScreenName) {
    if (this.current === name) this.close();
    else this.open(name);
  }

  private render() {
    switch (this.current) {
      case 'pause': this.renderPause(); break;
      case 'settings': this.renderSettings(); break;
      case 'inventory': this.renderInventory(); break;
      case 'map': this.renderMap(); break;
      case 'party': this.renderParty(); break;
      case 'codex': this.renderCodex(); break;
      case 'journal': this.renderJournal(); break;
      default: this.close();
    }
  }

  private head(title: string, sub: string) {
    return `<h2>${title}</h2><p>${sub}</p>`;
  }

  private btn(label: string, act: string, ghost = false) {
    return `<button class="big-btn ${ghost ? 'ghost' : ''}" data-s="${act}">${label}</button>`;
  }

  private wire() {
    this.panel.querySelectorAll<HTMLElement>('[data-s]').forEach((btn) => {
      btn.addEventListener('click', () => this.handle(btn.dataset.s!));
    });
  }

  private handle(act: string) {
    const ctx = this.ctx;
    ctx.audio.ui();
    switch (act) {
      case 'resume': this.close(); this.onResume?.(); break;
      case 'settings': this.open('settings'); break;
      case 'party': this.open('party'); break;
      case 'inventory': this.open('inventory'); break;
      case 'map': this.open('map'); break;
      case 'codex': this.open('codex'); break;
      case 'journal': this.open('journal'); break;
      case 'back': this.open('pause'); break;
      case 'menu': this.close(); this.onExitToMenu?.(); break;
      case 'heal': ctx.inventory.useHeal(); this.open('inventory'); break;
      case 'quality-low': this.setQuality('low'); break;
      case 'quality-medium': this.setQuality('medium'); break;
      case 'quality-high': this.setQuality('high'); break;
      case 'toggle-bloom': ctx.settings.bloom = !ctx.settings.bloom; ctx.engine.setBloom(ctx.settings.bloom); this.saveSettings(); this.open('settings'); break;
      case 'toggle-fps': ctx.settings.showFps = !ctx.settings.showFps; this.saveSettings(); this.open('settings'); break;
      case 'toggle-dmg': ctx.settings.showDamageNumbers = !ctx.settings.showDamageNumbers; this.saveSettings(); this.open('settings'); break;
      case 'toggle-auto': ctx.settings.autoTarget = !ctx.settings.autoTarget; this.saveSettings(); this.open('settings'); break;
      case 'toggle-invert': ctx.settings.invertY = !ctx.settings.invertY; this.saveSettings(); this.open('settings'); break;
      case 'toggle-shadows': {
        ctx.settings.shadows = !ctx.settings.shadows;
        ctx.engine.shadowsEnabled = ctx.settings.shadows;
        ctx.engine.renderer.shadowMap.enabled = ctx.settings.shadows;
        ctx.save.markDirty();
        this.open('settings');
        break;
      }
      default:
        if (act.startsWith('travel:')) {
          const id = act.slice(7);
          const lm = LANDMARKS.find((l) => l.id === id);
          if (lm && ctx.save.data.waypoints.includes(id)) {
            ctx.player.position.set(lm.x, ctx.terrain.heightAt(lm.x, lm.z) + 0.3, lm.z + 2.5);
            ctx.player.velocity.set(0, 0, 0);
            ctx.cam.snapTo(ctx.player.position);
            ctx.notify(`${lm.name}'a seyahat edildi`, '◈');
            this.close();
          }
        }
    }
  }

  private setQuality(q: 'low' | 'medium' | 'high') {
    this.ctx.settings.quality = q;
    this.ctx.engine.applyQuality(q);
    this.ctx.sky.setQuality(q);
    this.ctx.scatter.setQuality(q);
    this.saveSettings();
    this.open('settings');
  }

  private saveSettings() {
    this.ctx.save.markDirty();
    this.ctx.save.flush();
  }

  /* ---------------- screens ---------------- */
  private renderPause() {
    const p = this.ctx.save.data.player;
    this.panel.innerHTML = `
      ${this.head('DURAKLATILDI', `Gözcü ${p.name} · Seviye ${p.level} · ${this.ctx.player.save.player.mora} Mora`)}
      <div class="grid-2">
        <div class="card">
          <h4>Yolculuk</h4>
          <div class="stat"><span>Seviye</span><b>${p.level}</b></div>
          <div class="stat"><span>Tecrübe</span><b>${p.xp} / ${p.xpNext}</b></div>
          <div class="stat"><span>Saldırı</span><b>${Math.round(this.ctx.player.atk)}</b></div>
          <div class="stat"><span>Savunma</span><b>${Math.round(this.ctx.player.def_)}</b></div>
          <div class="stat"><span>Yenilen düşman</span><b>${this.ctx.save.data.stats.kills}</b></div>
          <div class="stat"><span>Tepkime</span><b>${this.ctx.save.data.stats.reactions}</b></div>
        </div>
        <div class="card">
          <h4>Görev</h4>
          <div style="font-size:11.5px;color:#cfd9ea;line-height:1.6">
            ${this.ctx.quests.tracker()?.title ?? 'Tüm görevler tamamlandı'}
          </div>
          <h4 style="margin-top:12px">Kontroller</h4>
          <div style="font-size:10px;color:#a9b6cf;line-height:1.7">
            Sol alt: hareket · Sağ yarı: kamera<br>
            ⚔ Saldırı · ◈ Yetenek (E) · ✦ Patlama (Q)<br>
            ⇧ Zıpla · » Koş · F Etkileşim
          </div>
        </div>
      </div>
      <div class="row" style="margin-top:16px">
        ${this.btn('Devam Et', 'resume')}
        ${this.btn('Karakterler', 'party', true)}
        ${this.btn('Envanter', 'inventory', true)}
        ${this.btn('Harita', 'map', true)}
        ${this.btn('Görevler', 'journal', true)}
      </div>
      <div class="row" style="margin-top:8px">
        ${this.btn('Ayarlar', 'settings', true)}
        ${this.btn('Kodeks', 'codex', true)}
        ${this.btn('Ana Menü', 'menu', true)}
      </div>`;
    this.wire();
  }

  private renderSettings() {
    const s = this.ctx.settings;
    this.panel.innerHTML = `
      ${this.head('AYARLAR', 'Grafik, ses ve kontrol tercihleri')}
      <div class="grid-2">
        <div class="card">
          <h4>Grafik</h4>
          <div class="setting">
            <label>Kalite<small>Mobil için “Orta” önerilir</small></label>
            <div class="seg">
              <button data-s="quality-low" class="${s.quality === 'low' ? 'on' : ''}">Düşük</button>
              <button data-s="quality-medium" class="${s.quality === 'medium' ? 'on' : ''}">Orta</button>
              <button data-s="quality-high" class="${s.quality === 'high' ? 'on' : ''}">Yüksek</button>
            </div>
          </div>
          <div class="setting">
            <label>Bloom / Işık Taşması<small>Güçlü cihazlarda etkileyici</small></label>
            <button class="big-btn ${s.bloom ? '' : 'ghost'}" data-s="toggle-bloom">${s.bloom ? 'Açık' : 'Kapalı'}</button>
          </div>
          <div class="setting">
            <label>Gölgeler</label>
            <button class="big-btn ${s.shadows ? '' : 'ghost'}" data-s="toggle-shadows">${s.shadows ? 'Açık' : 'Kapalı'}</button>
          </div>
          <div class="setting">
            <label>FPS sayacı</label>
            <button class="big-btn ${s.showFps ? '' : 'ghost'}" data-s="toggle-fps">${s.showFps ? 'Açık' : 'Kapalı'}</button>
          </div>
        </div>
        <div class="card">
          <h4>Oyun</h4>
          <div class="setting">
            <label>Hasar sayıları</label>
            <button class="big-btn ${s.showDamageNumbers ? '' : 'ghost'}" data-s="toggle-dmg">${s.showDamageNumbers ? 'Açık' : 'Kapalı'}</button>
          </div>
          <div class="setting">
            <label>Otomatik hedef<small>Yakındaki düşmana yönel</small></label>
            <button class="big-btn ${s.autoTarget ? '' : 'ghost'}" data-s="toggle-auto">${s.autoTarget ? 'Açık' : 'Kapalı'}</button>
          </div>
          <div class="setting">
            <label>Kamera ters Y</label>
            <button class="big-btn ${s.invertY ? '' : 'ghost'}" data-s="toggle-invert">${s.invertY ? 'Açık' : 'Kapalı'}</button>
          </div>
          <h4 style="margin-top:12px">Kamera hızı</h4>
          <input type="range" min="0.4" max="2" step="0.1" value="${s.sensitivity}" id="sens" style="width:100%">
          <h4 style="margin-top:12px">Ses</h4>
          <div class="stat"><span>Ana ses</span><b><input type="range" id="vol-master" min="0" max="1" step="0.05" value="${s.master}"></b></div>
          <div class="stat"><span>Efektler</span><b><input type="range" id="vol-sfx" min="0" max="1" step="0.05" value="${s.sfx}"></b></div>
          <div class="stat"><span>Müzik</span><b><input type="range" id="vol-music" min="0" max="1" step="0.05" value="${s.music}"></b></div>
        </div>
      </div>
      <div class="row" style="margin-top:14px">${this.btn('Geri', 'back', true)}</div>`;
    const sens = this.panel.querySelector<HTMLInputElement>('#sens')!;
    sens.addEventListener('input', () => {
      s.sensitivity = parseFloat(sens.value);
      this.saveSettings();
    });
    const wireVol = (id: string, key: 'master' | 'sfx' | 'music') => {
      const el = this.panel.querySelector<HTMLInputElement>(`#vol-${id}`)!;
      el.addEventListener('input', () => {
        s[key] = parseFloat(el.value);
        this.ctx.audio.setVolumes(s.master, s.sfx, s.music);
        this.saveSettings();
      });
    };
    wireVol('master', 'master');
    wireVol('sfx', 'sfx');
    wireVol('music', 'music');
    this.wire();
  }

  private renderInventory() {
    const items = this.ctx.inventory.list();
    const p = this.ctx.save.data.player;
    this.panel.innerHTML = `
      ${this.head('ENVANTER', `${p.mora} Mora · ${p.primogems} Yıldız Taşı`)}
      <div class="inv-grid">
        ${items.length ? items.map((it) => `
          <div class="inv-item">
            <div class="n" style="color:${it.def.color}">${it.def.icon} ${it.amount}</div>
            <div class="l">${it.def.name}</div>
          </div>`).join('') : '<div class="card" style="grid-column:1/-1">Henüz eşya yok. Sandıkları aç ve çiçek topla.</div>'}
      </div>
      <div class="row" style="margin-top:14px">
        ${this.btn('Yankı Çiçeği Kullan (+320 HP)', 'heal')}
        ${this.btn('Geri', 'back', true)}
      </div>
      <p style="margin-top:10px;font-size:10px;color:#8b97ad">Toplam ${items.reduce((a, b) => a + b.amount, 0)} eşya · Envanter otomatik kaydedilir.</p>`;
    this.wire();
  }

  private renderMap() {
    this.panel.innerHTML = `
      ${this.head('AETHERIA HARİTASI', 'Etkinleştirdiğin mühür taşlarına hızlı seyahat edebilirsin')}
      <canvas class="map-canvas" id="worldmap" width="720" height="420"></canvas>
      <div class="row" style="margin-top:12px">
        ${LANDMARKS.filter((l) => l.kind === 'statue' || l.kind === 'summit' || l.kind === 'coast')
          .map((lm) => this.btn(`${lm.name}${this.ctx.save.data.waypoints.includes(lm.id) ? '' : ' (kilitli)'}`, `travel:${lm.id}`, !this.ctx.save.data.waypoints.includes(lm.id)))
          .join('')}
        ${this.btn('Geri', 'back', true)}
      </div>`;
    const canvas = this.panel.querySelector<HTMLCanvasElement>('#worldmap')!;
    const wp = LANDMARKS.filter((l) => l.kind === 'statue' || l.kind === 'summit' || l.kind === 'coast')
      .map((l) => ({ x: l.x, z: l.z, name: l.name, active: this.ctx.save.data.waypoints.includes(l.id) }));
    // reuse the minimap renderer through the HUD instance
    (this.ctx.hud as any).minimap?.drawWorldMap(canvas, this.ctx.player.position, wp);
    this.wire();
  }

  private renderParty() {
    this.panel.innerHTML = `
      ${this.head('YOLDAŞLAR', 'Parti üyeleri arasında geçiş yap — her element farklı bir taktik açar')}
      <div class="grid-2">
        ${PARTY_ORDER.map((id, i) => {
          const def = getCharacter(id);
          const el = ELEMENTS[def.element];
          const member = this.ctx.save.data.party[i];
          const active = this.ctx.player.activeId === id;
          return `
          <div class="char-card" style="background:linear-gradient(160deg,${el.color}22,rgba(12,18,30,.9));${active ? 'border-color:' + el.color : ''}">
            <span class="el-badge" style="background:${el.color}">${el.short}</span>
            <h3>${def.name}${active ? ' · aktif' : ''}</h3>
            <div class="weapon">${WEAPON_LABEL[def.weapon]} · Lv.${member.level}</div>
            <div class="skill-line"><b>${def.skill.name}</b> — ${def.skill.desc}</div>
            <div class="skill-line" style="color:#c7b0ff"><b>${def.burst.name}</b> — ${def.burst.desc}</div>
            <div class="skill-line" style="color:#8b97ad;font-style:italic">${def.quote}</div>
          </div>`;
        }).join('')}
      </div>
      <div class="row" style="margin-top:14px">${this.btn('Geri', 'back', true)}</div>`;
    this.wire();
  }

  private renderCodex() {
    this.panel.innerHTML = `
      ${this.head('KODEKS', 'Elementler, tepkimeler ve hayatta kalma notları')}
      <div class="grid-2">
        <div class="card">
          <h4>Elementler</h4>
          ${Object.values(ELEMENTS).filter((e) => e.id !== 'none').map((e) => `
            <div class="codex-item">
              <div class="codex-dot" style="background:${e.color}"></div>
              <div><h5>${e.name} · ${e.short}</h5><p>${e.blurb}</p></div>
            </div>`).join('')}
        </div>
        <div class="card">
          <h4>Tepkimeler</h4>
          ${REACTION_CODEX.map((r) => `
            <div class="codex-item">
              <div class="codex-dot" style="background:${r.color}"></div>
              <div><h5>${r.name} <span style="color:#8b97ad">· ${r.pair}</span></h5><p>${r.text}</p></div>
            </div>`).join('')}
        </div>
      </div>
      <div class="card" style="margin-top:12px">
        <h4>Hayatta Kalma</h4>
        <div class="stat"><span>Dayanıklılık</span><b>Koşma, tırmanma ve sürüklenme tüketir</b></div>
        <div class="stat"><span>Tırmanma</span><b>Dik yamaca doğru ilerle</b></div>
        <div class="stat"><span>Sürüklenme</span><b>Havadayken zıpla</b></div>
        <div class="stat"><span>Su</span><b>Derin suda dayanıklılık biter → kıyıya dönersin</b></div>
        <div class="stat"><span>Mühür Taşı</span><b>Can ve dayanıklılığı doldurur, hızlı seyahat açar</b></div>
      </div>
      <div class="row" style="margin-top:14px">${this.btn('Geri', 'back', true)}</div>`;
    this.wire();
  }

  private renderJournal() {
    const summary = this.ctx.quests.summary();
    this.panel.innerHTML = `
      ${this.head('GÖREV GÜNLÜĞÜ', `Bölüm I · ${summary.filter((s) => s.state.completed).length}/${QUESTS.length} tamamlandı`)}
      ${summary.map((s) => `
        <div class="card" style="margin-bottom:10px;${s.isCurrent ? 'border-color:#e8c983' : ''}">
          <h4>${s.state.completed ? '✓ ' : s.isCurrent ? '◈ ' : '· '}${s.def.title}</h4>
          <p style="font-size:11px;color:#b9c6dc;line-height:1.55">${s.def.summary}</p>
          <div style="margin-top:8px">
            ${s.def.objectives.map((o, i) => `
              <div class="stat"><span>${o.label}</span><b>${i < s.state.stage ? '✓' : `${Math.min(s.state.progress, o.count)}/${o.count}`}</b></div>`).join('')}
          </div>
          ${s.isCurrent ? `<p style="margin-top:8px;font-size:10px;color:#8b97ad">İpucu: ${s.def.hint}</p>` : ''}
        </div>`).join('')}
      <div class="row">${this.btn('Geri', 'back', true)}</div>`;
    this.wire();
  }

  /* ---------------- death ---------------- */
  showDeath() {
    this.current = 'pause';
    this.layer.classList.remove('hidden');
    this.panel.innerHTML = `
      <div style="text-align:center;padding:20px 10px">
        <h2 style="color:#ff8d99">GÖZCÜ DÜŞTÜ</h2>
        <p style="color:#a9b6cf;font-size:12px;margin:8px 0 18px">Mühür taşı seni geri çağırıyor…</p>
        <p style="font-family:'Cinzel',serif;color:#e8c983;font-size:13px" id="death-timer">3</p>
      </div>`;
  }

  /* ---------------- title menu ---------------- */
  static bindTitle(onNew: () => void, onContinue: () => void, onSettings: () => void, onCodex: () => void, hasSave: boolean, continueInfo: string) {
    const cont = document.getElementById('btn-continue') as HTMLButtonElement;
    cont.disabled = !hasSave;
    document.getElementById('continue-info')!.textContent = continueInfo;
    document.querySelector('[data-act="new"]')?.addEventListener('click', onNew);
    cont.addEventListener('click', onContinue);
    document.querySelector('[data-act="settings"]')?.addEventListener('click', onSettings);
    document.querySelector('[data-act="codex"]')?.addEventListener('click', onCodex);
    const dev = document.getElementById('menu-device')!;
    dev.textContent = `${navigator.platform || 'Bilinmeyen cihaz'} · ${window.innerWidth}×${window.innerHeight} · ${(navigator as any).deviceMemory ?? '?'} GB RAM`;
  }
}

export { clamp };
