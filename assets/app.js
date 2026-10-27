// Therzie Mods Wiki: a no-build static site. Everything comes from data/*.json written by the
// in-game `wikidump` command, so updating the wiki = re-dump + upload the data/icons folders.
(() => {
  'use strict';

  const MOD_INFO = {
    Armory: 'Armor and weapon sets for every biome, crafted at the Armory.',
    Warfare: 'New weapons, bows, crossbows and the Fletcher table and Black forge upgrades.',
    Monstrum: 'New creatures, tameable mounts, and three summonable bosses.',
    Wizardry: 'Staffs, robes, potions and the Wizard table, plus mage creatures.',
  };
  const DAMAGE_TYPES = ['blunt', 'slash', 'pierce', 'chop', 'pickaxe', 'fire', 'frost', 'lightning', 'poison', 'spirit'];
  const TYPE_LABELS = {
    OneHandedWeapon: 'One-handed weapon', TwoHandedWeapon: 'Two-handed weapon', TwoHandedWeaponLeft: 'Two-handed weapon',
    Bow: 'Bow', Shield: 'Shield', Helmet: 'Helmet', Chest: 'Chest', Legs: 'Legs', Shoulder: 'Cape', Utility: 'Utility',
    Trinket: 'Trinket', Ammo: 'Ammo', AmmoNonEquipable: 'Ammo', Consumable: 'Consumable', Material: 'Material',
    Trophy: 'Trophy', Tool: 'Tool', Torch: 'Torch', Misc: 'Misc', Fish: 'Fish', Attach_Atgeir: 'Weapon',
  };

  const db = { items: [], pieces: [], creatures: [], locations: [], conversions: [], vanilla: [], meta: {} };
  const byId = {};       // id -> { kind, obj } for our own content
  const vanillaName = {}; // id -> display name for vanilla references
  const app = document.getElementById('app');
  const search = document.getElementById('search');

  // ---------- helpers ----------
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const words = s => String(s ?? '').replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2');
  const biomes = s => (!s || s === 'None') ? '—' : words(s).replace(/ ,/g, ',');
  const num = n => (n == null ? '—' : Number.isInteger(n) ? String(n) : (Math.round(n * 100) / 100).toString());
  const pct = n => `${num(n * 100)}%`;
  const duration = sec => {
    if (sec == null) return '—';
    if (sec >= 3600) return `${num(sec / 3600)} h`;
    if (sec >= 60) return `${num(sec / 60)} min`;
    return `${num(sec)} s`;
  };
  const yes = b => (b ? 'Yes' : 'No');
  const badge = mod => `<span class="badge mod-${esc(mod)}">${esc(mod)}</span>`;
  const img = (src, alt, cls = '') => src ? `<img src="${esc(src)}" alt="${esc(alt)}" loading="lazy" class="${cls}" onerror="this.style.visibility='hidden'">` : '';
  // Icons go on a light "well" so Therzie's dark icons stay readable.
  const well = (src, alt, cls = '') => src ? `<span class="well ${cls}">${img(src, alt)}</span>` : '';
  const kindPath = { item: 'item', piece: 'piece', creature: 'creature', location: 'location' };

  function nameOf(id) {
    const e = byId[id];
    if (e) return e.obj.displayName || e.obj.name || words(id);
    return vanillaName[id] || words(id);
  }
  function iconOf(id) {
    const e = byId[id];
    if (!e) return null;
    return e.obj.icon || e.obj.portrait || null;
  }
  // Link to our page when it's ours, plain text (vanilla) otherwise.
  function ref(id, label) {
    const e = byId[id];
    const text = esc(label || nameOf(id));
    return e ? `<a href="#/${kindPath[e.kind]}/${encodeURIComponent(id)}">${text}</a>` : `<span>${text}</span>`;
  }
  function ingredient(id, amount, extra = '') {
    return `<span class="ing">${well(iconOf(id), nameOf(id))}<span class="amt">${esc(amount)}×</span>${ref(id)}${extra}</span>`;
  }
  const itemLink = id => `<span class="ing">${well(iconOf(id), nameOf(id))}${ref(id)}</span>`;
  const ingredients = list => (list || []).map(i => ingredient(i.id, i.amount)).join('') || '<span class="muted">—</span>';
  const station = s => s ? `<span class="station">${well(s.icon, s.name, 'thumb')}${esc(s.name)}</span>${s.level > 1 ? ` <span class="muted">(level ${s.level})</span>` : ''}` : '<span class="muted">None</span>';
  const fact = (label, value) => value == null || value === '' ? '' : `<div class="fact"><span>${esc(label)}</span><b>${value}</b></div>`;
  const table = (head, rows) => rows.length ? `<div class="table-wrap"><table><thead><tr>${head.map(h => `<th class="${h.num ? 'num' : ''}">${esc(h.t ?? h)}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map((c, i) => `<td class="${head[i].num ? 'num' : ''}">${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>` : '';
  const section = (title, html) => html ? `<h2>${esc(title)}</h2>${html}` : '';
  function resistances(res) {
    const r = res || {};
    return table(DAMAGE_TYPES.map(t => words(t).replace(/^./, c => c.toUpperCase())),
      [DAMAGE_TYPES.map(t => { const m = r[t] || 'Normal'; return `<span class="res-${m}">${esc(words(m))}</span>`; })]);
  }
  function effect(e, label) {
    if (!e) return '';
    return `<div class="effect">${well(e.icon, e.name)}<div><b>${esc(label ? label + ': ' : '')}${esc(e.name)}</b><div class="tip">${esc(e.tooltip)}</div></div></div>`;
  }

  // ---------- lookups across data ----------
  function usedIn(id) {
    const out = [];
    for (const it of db.items) for (const r of it.recipes || []) {
      if ((r.ingredients || []).some(i => i.id === id) || (r.upgrades || []).some(u => (u.ingredients || []).some(i => i.id === id))) { out.push(it.id); break; }
    }
    for (const p of db.pieces) if ((p.ingredients || []).some(i => i.id === id)) out.push(p.id);
    return out;
  }
  const droppedBy = id => db.creatures.filter(c => (c.drops || []).some(d => d.id === id)).map(c => ({ c, d: c.drops.find(d => d.id === id) }));
  const conversionsFor = id => db.conversions.filter(c => c.from === id || c.to === id);
  const foundIn = id => db.locations.filter(l =>
    (l.pickables || []).some(p => p.id === id) ||
    (l.chests || []).some(ch => (ch.items || []).some(i => i.id === id)));
  const tamedWith = id => db.creatures.filter(c => c.tameable && (c.tameable.food || []).includes(id));
  const summons = id => db.locations.filter(l => l.bossAltar && l.bossAltar.offerItem === id);

  // ---------- list pages ----------
  const state = { mod: 'All', filter: 'All' };

  function listPage(kind, title, list, opts) {
    const mods = ['All', ...db.meta.mods || []];
    const filters = ['All', ...new Set(list.map(opts.group).filter(Boolean))].sort((a, b) => a === 'All' ? -1 : b === 'All' ? 1 : a.localeCompare(b));
    if (!filters.includes(state.filter)) state.filter = 'All';
    const shown = list.filter(x => (state.mod === 'All' || x.mod === state.mod) && (state.filter === 'All' || opts.group(x) === state.filter));
    app.innerHTML = `
      <h1>${esc(title)}</h1>
      <p class="count">Showing ${shown.length} of ${list.length}</p>
      <div class="filters">
        ${mods.map(m => `<button class="chip ${state.mod === m ? 'on' : ''}" data-mod="${esc(m)}">${esc(m)}</button>`).join('')}
        ${filters.length > 2 ? `<select class="chip" id="groupFilter" aria-label="${esc(opts.groupLabel)}">${filters.map(f => `<option ${f === state.filter ? 'selected' : ''} value="${esc(f)}">${f === 'All' ? 'All ' + esc(opts.groupLabel) : esc(f)}</option>`).join('')}</select>` : ''}
      </div>
      ${shown.length ? '' : '<p class="empty">Nothing matches these filters. Try “All”.</p>'}
      <div class="grid">${shown.map(x => card(kind, x, opts.sub(x), opts.big)).join('')}</div>`;
    app.querySelectorAll('[data-mod]').forEach(b => b.onclick = () => { state.mod = b.dataset.mod; route(); });
    const sel = document.getElementById('groupFilter');
    if (sel) sel.onchange = () => { state.filter = sel.value; route(); };
  }
  function card(kind, x, sub, big) {
    const cls = kind === 'location' ? 'big shot' : big ? 'big' : '';
    return `<a class="card ${cls}" href="#/${kind}/${encodeURIComponent(x.id)}">
      ${well(x.icon || x.portrait || x.screenshot, x.displayName || x.name)}
      <div class="name">${esc(x.displayName || x.name || words(x.id))}</div>
      <div class="sub">${badge(x.mod)} ${esc(sub || '')}</div></a>`;
  }

  // ---------- detail pages ----------
  function itemPage(it) {
    const q = it.maxQuality;
    const parts = [];
    parts.push(`<div class="hero">${well(it.icon, it.name)}<div class="info">
      <h1>${esc(it.name)}</h1><div class="kind">${badge(it.mod)} <span class="muted">${esc(TYPE_LABELS[it.type] || words(it.type))}</span></div>
      ${it.description ? `<p class="desc">${esc(it.description)}</p>` : ''}
      <div class="facts">
        ${fact('Weight', num(it.weight))}${fact('Value', it.value ? num(it.value) : null)}
        ${fact('Stack', it.maxStack > 1 ? it.maxStack : null)}${fact('Max quality', q > 1 ? q : null)}
        ${it.durability ? fact('Durability', `${num(it.durability.max)} <span class="muted">+${num(it.durability.perLevel)}/lvl</span>`) : ''}
        ${fact('Teleportable', it.teleportable ? null : 'No')}
        ${it.weapon ? fact('Skill', esc(words(it.weapon.skill))) : ''}
        ${it.weapon && it.weapon.toolTier ? fact('Tool tier', it.weapon.toolTier) : ''}
        ${it.modifiers ? Object.entries(it.modifiers).map(([k, v]) => fact(words(k).replace(/^./, c => c.toUpperCase()), `${v > 0 ? '+' : ''}${num(v * 100)}%`)).join('') : ''}
      </div></div></div>`);

    // Per-quality stats
    const levels = [...Array(q).keys()].map(i => i + 1);
    if (it.weapon && Object.keys(it.weapon.damage || {}).length) {
      const types = Object.keys({ ...it.weapon.damage, ...it.weapon.damagePerLevel });
      parts.push(section('Damage', table([{ t: 'Quality' }, ...types.map(t => ({ t: words(t).replace(/^./, c => c.toUpperCase()), num: true }))],
        levels.map(l => [l, ...types.map(t => num((it.weapon.damage[t] || 0) + (it.weapon.damagePerLevel[t] || 0) * (l - 1)))]))));
      const atk = [['Primary', it.weapon.primaryAttack], ['Secondary', it.weapon.secondaryAttack]].filter(a => a[1]);
      if (atk.length) parts.push(table(['Attack', { t: 'Stamina', num: true }, { t: 'Eitr', num: true }, { t: 'Health', num: true }],
        atk.map(([n, a]) => [n, num(a.stamina || 0), num(a.eitr || 0), num(a.health || 0)])));
    }
    if (it.armor) parts.push(section('Armor', table([{ t: 'Quality' }, { t: 'Armor', num: true }], levels.map(l => [l, num(it.armor.armor + it.armor.perLevel * (l - 1))]))));
    if (it.block) parts.push(section('Blocking', table([{ t: 'Quality' }, { t: 'Block armor', num: true }, { t: 'Block force', num: true }, { t: 'Parry bonus', num: true }],
      levels.map(l => [l, num(it.block.blockPower + it.block.blockPowerPerLevel * (l - 1)), num(it.block.deflection + it.block.deflectionPerLevel * (l - 1)), `${num(it.block.parryBonus)}×`]))));
    if (it.resistances) parts.push(section('Resistances', table(['Damage type', 'Modifier'], it.resistances.map(r => [esc(words(r.type)), `<span class="res-${r.modifier}">${esc(words(r.modifier))}</span>`]))));
    if (it.food) parts.push(section(it.food.isDrink ? 'Drink' : 'Food', `<div class="facts">${fact('Health', num(it.food.health))}${fact('Stamina', num(it.food.stamina))}${fact('Eitr', it.food.eitr ? num(it.food.eitr) : null)}${fact('Duration', duration(it.food.duration))}${fact('Regen', `${num(it.food.regen)}/tick`)}</div>`));

    const effects = [effect(it.equipEffect, 'Equipped'), effect(it.consumeEffect, 'When used'), effect(it.attackEffect, 'On hit'),
      it.set ? effect(it.set.effect, `Set bonus (${it.set.size} pieces)`) : ''].join('');
    parts.push(section('Effects', effects));

    // Recipes
    for (const r of it.recipes || []) {
      parts.push(section('Crafting', `<div class="facts">${fact('Station', station(r.station))}${fact('Makes', r.amount > 1 ? r.amount : null)}${!r.enabled ? fact('Status', 'Disabled in config') : ''}</div>
        <div class="ings">${ingredients(r.ingredients)}</div>`));
      if ((r.upgrades || []).length) parts.push(section('Upgrades', table(['Quality', 'Station', 'Cost'], r.upgrades.map(u => [u.quality, station(u.station), ingredients(u.ingredients)]))));
    }

    parts.push(obtainedSections(it.id));
    if ((it.tooltip || []).length) parts.push(`<details><summary>In-game tooltip</summary>${it.tooltip.map((t, i) => `<h3>Quality ${i + 1}</h3><p class="tooltip">${esc(t)}</p>`).join('')}</details>`);
    app.innerHTML = parts.join('');
  }

  // "Where does it come from / where does it go" sections, shared by items.
  function obtainedSections(id) {
    const parts = [];
    const drops = droppedBy(id);
    if (drops.length) parts.push(section('Dropped by', table(['Creature', { t: 'Amount', num: true }, { t: 'Chance', num: true }],
      drops.map(({ c, d }) => [`${well(c.portrait, c.name, 'thumb')}${ref(c.id)}`, d.min === d.max ? d.min : `${d.min}–${d.max}`, pct(d.chance)]))));
    const locs = foundIn(id);
    if (locs.length) parts.push(section('Found at', locs.map(l => ref(l.id)).join(', ')));
    const conv = conversionsFor(id);
    if (conv.length) parts.push(section('Processing', table(['Station', 'Input', 'Output', { t: 'Time', num: true }],
      conv.map(c => [esc(c.stationName), ingredient(c.from, 1), ingredient(c.to, c.amount), duration(c.seconds)]))));
    const uses = usedIn(id);
    if (uses.length) parts.push(section('Used to make', `<div class="grid">${uses.map(u => card(byId[u].kind, byId[u].obj, '')).join('')}</div>`));
    const tames = tamedWith(id);
    if (tames.length) parts.push(section('Tames', tames.map(c => ref(c.id)).join(', ')));
    const altars = summons(id);
    if (altars.length) parts.push(section('Summons', altars.map(l => `${ref(l.bossAltar.boss)} (offer ${l.bossAltar.offerAmount} at ${ref(l.id)})`).join('<br>')));
    return parts.join('');
  }

  function piecePage(p) {
    const parts = [`<div class="hero">${well(p.icon, p.name)}<div class="info">
      <h1>${esc(p.name)}</h1><div class="kind">${badge(p.mod)} <span class="muted">${esc(p.category)}</span></div>
      ${p.description ? `<p class="desc">${esc(p.description)}</p>` : ''}
      <div class="facts">${fact('Built with', esc(nameOf(p.tool)))}${fact('Requires', station(p.station))}
      ${fact('Health', p.health != null ? num(p.health) : null)}${fact('Material', p.material ? esc(words(p.material)) : null)}
      ${p.comfort ? fact('Comfort', `${p.comfort.value} <span class="muted">(${esc(words(p.comfort.group))})</span>`) : ''}
      ${p.storage ? fact('Storage', `${p.storage.width} × ${p.storage.height}`) : ''}
      ${fact('Only in', p.onlyInBiome ? biomes(p.onlyInBiome) : null)}
      ${p.isStation ? fact('Crafting station', 'Yes') : ''}${p.extends ? fact('Upgrades', esc(p.extends.name)) : ''}</div></div></div>`];
    parts.push(section('Build cost', `<div class="ings">${ingredients(p.ingredients)}</div>`));
    if (p.plant) parts.push(section('Growing', `<div class="facts">${fact('Biomes', biomes(p.plant.biomes))}${fact('Grow time', `${duration(p.plant.growTimeMin)}–${duration(p.plant.growTimeMax)}`)}${fact('Needs cultivated ground', yes(p.plant.needsCultivatedGround))}</div>`));
    if (p.isStation) {
      const items = db.items.filter(i => (i.recipes || []).some(r => r.station && r.station.id === p.id));
      const ext = db.pieces.filter(x => x.extends && x.extends.id === p.id);
      if (ext.length) parts.push(section('Station upgrades', `<div class="grid">${ext.map(x => card('piece', x, '')).join('')}</div>`));
      if (items.length) parts.push(section(`Crafted here (${items.length})`, `<div class="grid">${items.map(x => card('item', x, '')).join('')}</div>`));
    }
    if (p.conversions) parts.push(section('Processing', table(['Input', 'Output', { t: 'Time', num: true }], p.conversions.map(c => [ingredient(c.from, 1), ingredient(c.to, c.amount), duration(c.seconds)]))));
    if (p.resistances && Object.keys(p.resistances).length) parts.push(section('Resistances', resistances(p.resistances)));
    app.innerHTML = parts.join('');
  }

  function creaturePage(c) {
    const parts = [`<div class="hero">${well(c.portrait, c.name, 'portrait')}<div class="info">
      <h1>${esc(c.name)}</h1><div class="kind">${badge(c.mod)} ${c.boss ? '<span class="badge boss">Boss</span>' : ''} <span class="muted">${esc(words(c.faction))}</span></div>
      <div class="facts">${fact('Health', num(c.health))}${c.flying ? fact('Flying', 'Yes') : ''}
      ${fact('Walk / run', `${num(c.walkSpeed)} / ${num(c.runSpeed)}`)}
      ${c.tameable ? fact('Tameable', 'Yes') : ''}</div></div></div>`];
    if (!c.boss) parts.push(section('Health by stars', table([{ t: 'Stars' }, { t: 'Health', num: true }], [0, 1, 2].map(s => ['★'.repeat(s) || '0', num(c.health * (s + 1))]))));
    parts.push(section('Resistances', resistances(c.resistances) + `<p class="muted">Green = takes extra damage, red = takes less or none.</p>`));
    if ((c.drops || []).length) parts.push(section('Drops', table(['Item', { t: 'Amount', num: true }, { t: 'Chance', num: true }, 'Notes'],
      c.drops.map(d => [itemLink(d.id), d.min === d.max ? d.min : `${d.min}–${d.max}`, pct(d.chance),
        [d.scalesWithLevel ? 'more with stars' : '', d.onePerPlayer ? 'one per player' : ''].filter(Boolean).join(', ')]))));
    if (c.tameable) {
      const t = c.tameable;
      parts.push(section('Taming', `<div class="facts">${fact('Taming time', duration(t.tamingTime))}${fact('Stays fed', duration(t.fedDuration))}${fact('Commandable', yes(t.commandable))}${t.saddle ? fact('Saddle', ref(t.saddle)) : ''}</div>
        <div class="ings"><span class="label">Eats</span>${(t.food || []).map(itemLink).join('') || '—'}</div>`));
    }
    const family = [c.offspring ? `Offspring: ${ref(c.offspring)}` : '', c.growsInto ? `Grows into ${ref(c.growsInto.id)} after ${duration(c.growsInto.seconds)}` : '',
      ...db.creatures.filter(x => x.offspring === c.id).map(x => `Born from ${ref(x.id)}`)].filter(Boolean);
    if (family.length) parts.push(section('Family', family.join('<br>')));

    if ((c.spawns || []).length) parts.push(section('Where it spawns', table(['Biome', 'Area', 'Time', { t: 'Chance', num: true }, { t: 'Group', num: true }, { t: 'Stars', num: true }, 'Notes'],
      c.spawns.filter(s => s.enabled).map(s => [biomes(s.biome), esc(words(s.biomeArea)), s.day && s.night ? 'Day & night' : s.day ? 'Day' : 'Night',
        `${num(s.chance)}%`, s.groupMin === s.groupMax ? s.groupMin : `${s.groupMin}–${s.groupMax}`, `${s.levelMin - 1}–${s.levelMax - 1}`,
        [s.requiredKey ? `after ${esc(words(s.requiredKey))}` : '', s.weather ? `weather: ${esc(s.weather.join(', '))}` : '', s.oceanDepthMax ? 'in ocean' : '',
          !s.inForest ? 'outside forests' : !s.outsideForest ? 'in forests' : '', s.huntPlayer ? 'hunts players' : ''].filter(Boolean).join(', ')]))));
    const locs = db.locations.filter(l => (l.creatures || []).some(x => x.id === c.id));
    if (locs.length) parts.push(section('Found at', locs.map(l => ref(l.id)).join(', ')));
    const altar = db.locations.find(l => l.bossAltar && l.bossAltar.boss === c.id);
    if (altar) parts.push(section('How to summon', `Offer ${ingredient(altar.bossAltar.offerItem, altar.bossAltar.offerAmount)} at ${ref(altar.id)}.`));
    if (c.defeatKey) parts.push(`<p class="muted">Defeating it sets the world key <code>${esc(c.defeatKey)}</code>.</p>`);
    app.innerHTML = parts.join('');
  }

  function locationPage(l) {
    const parts = [`<div class="hero">${l.screenshot ? `<div class="shot">${img(l.screenshot, l.displayName)}</div>` : ''}<div class="info">
      <h1>${esc(l.displayName)}</h1><div class="kind">${badge(l.mod)} <span class="muted">${biomes(l.biome)}</span></div>
      <div class="facts">${fact('Biome', biomes(l.biome))}${fact('Biome area', esc(words(l.biomeArea)))}${fact('Per world', l.unique ? '1 (unique)' : `up to ${l.quantity}`)}
      ${fact('Altitude', `${num(l.altitudeMin)} to ${num(l.altitudeMax)}`)}${fact('Distance from center', `${num(l.distanceMin)} to ${num(l.distanceMax)} m`)}
      ${fact('Min. spacing', l.minDistanceFromSimilar ? `${num(l.minDistanceFromSimilar)} m` : null)}${fact('Radius', l.radius ? `${num(l.radius)} m` : null)}
      ${fact('Has interior', l.hasInterior ? 'Yes' : null)}${fact('Shows on map', l.mapIconAlways ? 'Always' : l.mapIconWhenPlaced ? 'When placed' : null)}</div></div></div>`];
    if (l.bossAltar) parts.push(section('Boss altar', `Offer ${ingredient(l.bossAltar.offerItem, l.bossAltar.offerAmount)} to summon ${ref(l.bossAltar.boss)}.`));
    if ((l.vegvisir || []).length) parts.push(section('Vegvisir', l.vegvisir.map(v => `Reveals ${ref(v.location)} on the map.`).join('<br>')));
    const pointedBy = db.locations.filter(x => (x.vegvisir || []).some(v => v.location === l.id));
    if (pointedBy.length) parts.push(section('Found via', pointedBy.map(x => `${ref(x.id)} reveals this location.`).join('<br>')));
    if ((l.creatures || []).length) parts.push(section('Creatures', table(['Creature', { t: 'Count', num: true }, { t: 'Stars', num: true }, 'Time', { t: 'Respawn', num: true }],
      l.creatures.map(c => [`${well(iconOf(c.id), c.name, 'thumb')}${ref(c.id)}`, c.count, `${c.levelMin - 1}–${c.levelMax - 1}`,
        c.day == null ? '—' : c.day && c.night ? 'Day & night' : c.day ? 'Day' : 'Night', c.respawnMinutes ? `${num(c.respawnMinutes)} min` : '—']))));
    for (const ch of l.chests || []) parts.push(section('Chest loot', `<p class="muted">${ch.rollsMin === ch.rollsMax ? ch.rollsMin : `${ch.rollsMin}–${ch.rollsMax}`} rolls${ch.chance < 1 ? `, ${pct(ch.chance)} chance` : ''}</p>` +
      table(['Item', { t: 'Stack', num: true }, { t: 'Weight', num: true }], ch.items.map(i => [itemLink(i.id), i.stackMin === i.stackMax ? i.stackMin : `${i.stackMin}–${i.stackMax}`, `${num(i.weightPercent)}%`]))));
    if ((l.pickables || []).length) parts.push(section('Pickables', l.pickables.map(p => ingredient(p.id, p.count)).join('')));
    if ((l.runestones || []).length) parts.push(section('Rune stones', l.runestones.map(r => `<blockquote class="rune">${esc(r.text)}</blockquote>`).join('')));
    app.innerHTML = parts.join('');
  }

  function homePage() {
    const count = (list, mod) => list.filter(x => x.mod === mod).length;
    app.innerHTML = `<h1>Therzie Mods Wiki</h1>
      <p class="lede">Recipes, stats, creatures and altars for Therzie's Valheim mods, pulled straight from the game data.</p>
      <nav class="quick" aria-label="Shortcuts">
        <a href="#/creatures" data-quick="Tameable">Tameable creatures</a>
        <a href="#/creatures" data-quick="Boss">Bosses</a>
        <a href="#/locations" data-quick="All">Altars &amp; locations</a>
        <a href="#/pieces" data-quick="All">Crafting stations &amp; pieces</a>
      </nav>
      <h2>The mods</h2>
      <div class="home-mods">${(db.meta.mods || []).map(m => `<a class="card" href="#/items" data-home-mod="${esc(m)}">
        <h2 style="color:var(--mod-${esc(m)})">${esc(m)}</h2>
        <div>${esc(MOD_INFO[m] || '')}</div>
        <div class="sub">${count(db.items, m)} items · ${count(db.pieces, m)} pieces · ${count(db.creatures, m)} creatures${count(db.locations, m) ? ` · ${count(db.locations, m)} locations` : ''}</div></a>`).join('')}</div>`;
    app.querySelectorAll('[data-home-mod]').forEach(a => a.onclick = () => { state.mod = a.dataset.homeMod; state.filter = 'All'; });
    app.querySelectorAll('[data-quick]').forEach(a => a.onclick = () => { state.mod = 'All'; state.filter = a.dataset.quick; });
  }

  function searchPage(q) {
    const needle = q.toLowerCase();
    const hit = x => (x.displayName || x.name || '').toLowerCase().includes(needle) || x.id.toLowerCase().includes(needle);
    const groups = [['Items', 'item', db.items], ['Pieces', 'piece', db.pieces], ['Creatures', 'creature', db.creatures], ['Locations', 'location', db.locations]]
      .map(([t, k, list]) => [t, k, list.filter(hit)]).filter(g => g[2].length);
    app.innerHTML = `<h1>Search: “${esc(q)}”</h1>` + (groups.length ? groups.map(([t, k, list]) => section(`${t} (${list.length})`, `<div class="grid">${list.map(x => card(k, x, '')).join('')}</div>`)).join('') : `<p class="empty">Nothing called “${esc(q)}”. Try part of a name, like “bow” or “fenrir”.</p>`);
  }

  // ---------- routing ----------
  function route() {
    const [, page, id] = (location.hash || '#/').split('/');
    const key = id ? decodeURIComponent(id) : null;
    document.querySelectorAll('#tabs a').forEach(a => a.classList.toggle('active', a.dataset.tab === page || a.dataset.tab === page + 's'));
    const q = search.value.trim();
    if (page === 'search') return searchPage(key || '');
    window.scrollTo(0, 0);
    switch (page) {
      case 'items': return listPage('item', 'Items', db.items, { group: x => TYPE_LABELS[x.type] || words(x.type), groupLabel: 'types', sub: x => TYPE_LABELS[x.type] || '' });
      case 'pieces': return listPage('piece', 'Build pieces', db.pieces, { group: x => x.category, groupLabel: 'categories', sub: x => x.category });
      case 'creatures': return listPage('creature', 'Creatures', db.creatures, { group: x => x.boss ? 'Boss' : x.tameable ? 'Tameable' : 'Creature', groupLabel: 'kinds', sub: x => x.boss ? 'Boss' : '', big: true });
      case 'locations': return listPage('location', 'Locations', db.locations, { group: x => biomes(x.biome), groupLabel: 'biomes', sub: x => biomes(x.biome), big: true });
      case 'item': case 'piece': case 'creature': case 'location': {
        const e = byId[key];
        if (!e) { app.innerHTML = `<h1>Not found</h1><p class="muted">No ${esc(page)} called “${esc(key)}”.</p>`; return; }
        return ({ item: itemPage, piece: piecePage, creature: creaturePage, location: locationPage })[e.kind](e.obj);
      }
      default: return q ? searchPage(q) : homePage();
    }
  }

  let searchTimer;
  search.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      const q = search.value.trim();
      location.hash = q ? `#/search/${encodeURIComponent(q)}` : '#/';
    }, 200);
  });
  window.addEventListener('hashchange', route);

  // ---------- theme ----------
  const themeSel = document.getElementById('theme');
  themeSel.value = document.documentElement.dataset.theme || 'auto';
  themeSel.onchange = () => {
    const t = themeSel.value;
    if (t === 'auto') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = t;
    try { t === 'auto' ? localStorage.removeItem('theme') : localStorage.setItem('theme', t); } catch (e) {}
  };

  // ---------- load ----------
  const load = f => fetch(`data/${f}.json`, { cache: 'no-cache' }).then(r => r.ok ? r.json() : []).catch(() => []);
  Promise.all(['items', 'pieces', 'creatures', 'locations', 'conversions', 'vanilla', 'meta'].map(load)).then(([items, pieces, creatures, locations, conversions, vanilla, meta]) => {
    Object.assign(db, { items, pieces, creatures, locations, conversions, vanilla, meta: meta || {} });
    for (const v of vanilla) vanillaName[v.id] = v.name;
    for (const l of locations) {
      // Locations have no in-game name: use the boss / vegvisir target, and your screenshot if one exists.
      l.displayName = l.bossAltar ? `${l.bossAltar.bossName} Altar`
        : (l.vegvisir || []).length ? `Vegvisir: ${l.vegvisir.map(v => v.pin).join(', ')}`
        : words(l.id.replace(/_TW$/, ''));
      l.screenshot = `screenshots/locations/${l.id}.png`;
    }
    [['item', items], ['piece', pieces], ['creature', creatures], ['location', locations]].forEach(([kind, list]) => list.forEach(obj => { byId[obj.id] = byId[obj.id] || { kind, obj }; }));
    document.getElementById('footer').innerHTML = `Data dumped from Valheim ${esc(meta.gameVersion || '?')} on ${esc(meta.dumpedAt || '?')} · Mods: ${(meta.mods || []).map(esc).join(', ')}`;
    route();
  });
})();
