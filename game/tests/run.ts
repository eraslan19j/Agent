/* =========================================================
   AETHERION — headless logic test suite
   Runs in plain Node (no DOM): reactions, damage maths, terrain
   determinism and a chunk-generation performance budget.
   ========================================================= */
import { resolveReaction, nextAura, ELEMENTS } from '../src/data/elements';
import { computeDamage, defFactor, hitStopFor } from '../src/combat/combat';
import { Terrain } from '../src/world/terrain';
import { CHESTS, rollLoot, xpForLevel } from '../src/data/items';
import { WORLD } from '../src/data/world';
import { mulberry32, fbm2 } from '../src/core/utils';

let pass = 0;
let fail = 0;
const failures: string[] = [];

function ok(name: string, cond: boolean, extra = '') {
  if (cond) {
    pass++;
  } else {
    fail++;
    failures.push(`${name} ${extra}`);
    console.error(`  ✗ ${name} ${extra}`);
  }
}
function eq(name: string, actual: unknown, expected: unknown) {
  ok(name, JSON.stringify(actual) === JSON.stringify(expected), `→ ${actual} (beklenen ${expected})`);
}
function group(name: string) {
  console.log(`\n▸ ${name}`);
}

/* ---------------- reactions ---------------- */
group('Element tepkimeleri');
{
  const v1 = resolveReaction('hydro', 'pyro');
  eq('Su + Ateş → Buharlaşma ×2', [v1.id, v1.mult], ['vaporize', 2]);
  const v2 = resolveReaction('pyro', 'hydro');
  eq('Ateş + Su → Buharlaşma ×1.5', [v2.id, v2.mult], ['vaporize', 1.5]);
  eq('Buz + Ateş → Erime ×2', [resolveReaction('cryo', 'pyro').id, resolveReaction('cryo', 'pyro').mult], ['melt', 2]);
  eq('Ateş + Elektro → Aşırı Yük', resolveReaction('pyro', 'electro').id, 'overload');
  eq('Su + Elektro → Elektrik Çarpması', resolveReaction('hydro', 'electro').id, 'electrocharged');
  eq('Buz + Elektro → Süper İletken', resolveReaction('cryo', 'electro').id, 'superconduct');
  eq('Su + Buz → Donma', resolveReaction('hydro', 'cryo').id, 'frozen');
  eq('Rüzgâr + Ateş → Girdap', resolveReaction('pyro', 'anemo').id, 'swirl');
  eq('Toprak + Su → Kristalleşme', resolveReaction('hydro', 'geo').id, 'crystallize');
  eq('Doğa + Su → Çiçeklenme', resolveReaction('dendro', 'hydro').id, 'bloom');
  eq('Aynı element tepkime yok', resolveReaction('pyro', 'pyro').id, 'none');
  eq('Aura yoksa tepkime yok', resolveReaction(null, 'pyro').id, 'none');
  ok('Tüm elementlerin rengi var', Object.values(ELEMENTS).every((e) => /^#[0-9a-f]{6}$/i.test(e.color)));
}

group('Aura zinciri');
{
  const r = resolveReaction('hydro', 'pyro');
  eq('Buharlaşma aurayı tüketir', nextAura('hydro', 'pyro', r), null);
  const frozen = resolveReaction('hydro', 'cryo');
  eq('Donma aurayı tüketir', nextAura('hydro', 'cryo', frozen), null);
  const none = resolveReaction(null, 'cryo');
  eq('Tepkimesiz vuruş yeni aura bırakır', nextAura(null, 'cryo', none), 'cryo');
}

/* ---------------- damage ---------------- */
group('Hasar matematiği');
{
  const rng = () => 0.5; // never crits
  const d = computeDamage({ atk: 100, power: 1, critRate: 0.5, critDmg: 0.5, rng });
  eq('Kritsiz hasar', d.amount, 100);
  const crit = computeDamage({ atk: 100, power: 1, critRate: 1, critDmg: 0.5, rng: () => 0.1 });
  eq('Kritik hasar ×1.5', crit.amount, 150);
  const react = computeDamage({ atk: 100, power: 1, critRate: 0, critDmg: 0, reactionMult: 2, rng });
  eq('Tepkime çarpanı', react.amount, 200);
  ok('Savunma hasarı %35 altına indiremez', defFactor(100000) >= 0.349, `→ ${defFactor(100000)}`);
  ok('Savunma kırma işe yarar', defFactor(1000, 0.4) > defFactor(1000));
  ok('Hit-stop sınırlı', hitStopFor(99999, true) <= 0.14);
  const minDmg = computeDamage({ atk: 1, power: 0.001, critRate: 0, critDmg: 0, rng });
  ok('Hasar asla 0 değil', minDmg.amount >= 1);
}

/* ---------------- terrain ---------------- */
group('Arazi (determinizm + fizik)');
{
  const t1 = new Terrain();
  const t2 = new Terrain();
  ok('Aynı seed → aynı yükseklik', t1.heightAt(12.3, -45.7) === t2.heightAt(12.3, -45.7));
  ok('Yükseklik sonlu', Number.isFinite(t1.heightAt(0, 0)));
  const n = t1.normalAt(10, 10);
  ok('Normal birim uzunlukta', Math.abs(n.length() - 1) < 0.001);
  ok('Eğim 0..1 arası', (() => {
    for (let i = 0; i < 200; i++) {
      const s = t1.slopeAt(i * 3.1 - 300, i * -2.7 + 120);
      if (s < 0 || s > 1) return false;
    }
    return true;
  })());
  ok('Başlangıç alanı su üstünde', t1.heightAt(8, 34) > WORLD.waterLevel + 1);
  ok('Göl havzası su altında', t1.heightAt(-140, 130) < WORLD.waterLevel);
  ok('Zirve yüksek', t1.heightAt(156, -176) > 30, `→ ${t1.heightAt(156, -176).toFixed(1)}`);
  ok('Dünya sınırları içinde yükseklik var', Number.isFinite(t1.heightAt(WORLD.half - 1, WORLD.half - 1)));
  const spot = t1.findFlatSpot(20, 20, 10, 3);
  ok('Düz zemin bulunuyor', spot.y > 0 && Number.isFinite(spot.y));

  // performance budget: chunk generation must stay cheap enough for 60fps mobile
  const t3 = new Terrain();
  const times: number[] = [];
  for (let i = 0; i < 6; i++) {
    const t0 = performance.now();
    (t3 as any).buildChunk(i, 0);
    times.push(performance.now() - t0);
  }
  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  console.log(`    chunk üretimi: ortalama ${avg.toFixed(2)} ms (6 chunk)`);
  ok('Chunk üretimi < 9 ms', avg < 9, `→ ${avg.toFixed(2)}ms`);

  // height lookups are called thousands of times per frame
  const t0 = performance.now();
  let acc = 0;
  for (let i = 0; i < 100000; i++) acc += t1.heightAt((i % 500) - 250, ((i * 7) % 500) - 250);
  const per = (performance.now() - t0) / 100000;
  console.log(`    heightAt: ${(per * 1e6).toFixed(2)} ns/çağrı`);
  ok('heightAt < 5 µs', per < 5, `→ ${(per * 1e6).toFixed(2)}ns`);
  ok('heightAt toplamı sonlu', Number.isFinite(acc));
}

/* ---------------- loot & progression ---------------- */
group('Ganimet ve ilerleme');
{
  const rng = mulberry32(42);
  for (const tier of Object.keys(CHESTS) as (keyof typeof CHESTS)[]) {
    const loot = rollLoot(rng, tier);
    ok(`${tier} sandığı en az 1 ödül`, loot.length >= 1);
    ok(`${tier} mora içeriyor`, loot.some((l) => l.id === 'mora'));
  }
  let monotonic = true;
  for (let l = 1; l < 40; l++) if (xpForLevel(l + 1) <= xpForLevel(l)) monotonic = false;
  ok('Seviye eğrisi artan', monotonic);
  ok('fbm 0..1 aralığında', (() => {
    for (let i = 0; i < 500; i++) {
      const v = fbm2(i * 0.37, i * -0.21, 4, 7);
      if (v < 0 || v > 1) return false;
    }
    return true;
  })());
}

/* ---------------- summary ---------------- */
console.log(`\n${'─'.repeat(46)}`);
console.log(`  ${pass} geçti · ${fail} başarısız`);
if (fail > 0) {
  console.log('  Başarısızlar:');
  failures.forEach((f) => console.log('   - ' + f));
  process.exitCode = 1;
} else {
  console.log('  ✓ Tüm mantık testleri geçti');
}
