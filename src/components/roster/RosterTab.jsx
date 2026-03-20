import { useState } from 'react';
import { useTeam } from '../../contexts/TeamContext';
import StarRating from '../shared/StarRating';

const POSITIONS = ['Pitcher', 'Catcher', '1st Base', '2nd Base', 'Shortstop', '3rd Base', 'Left Field', 'Center Field', 'Right Field'];

export default function RosterTab() {
  const { players, team, addPlayer, updatePlayer, removePlayer, getPlayerStats } = useTeam();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const [showPrintConfig, setShowPrintConfig] = useState(false);
  const [printOpts, setPrintOpts] = useState({
    defRating: false,
    gloveArm: false,
    obp: false,
    coachNotes: false,
    blankNotes: true,
  });

  const togglePrintOpt = (key) => setPrintOpts(prev => ({ ...prev, [key]: !prev[key] }));

  const printRoster = () => {
    const opts = printOpts;
    const sorted = [...players].sort((a, b) => (a.number || 99) - (b.number || 99));

    // Build header columns
    let headers = '<th class="num"></th><th class="jersey">#</th><th class="name">Player</th>';
    if (opts.defRating) headers += '<th class="stat">Def</th>';
    if (opts.gloveArm) headers += '<th class="stat">Glove</th><th class="stat">Arm</th>';
    if (opts.obp) headers += '<th class="stat">OBP</th>';
    if (opts.coachNotes) headers += '<th class="notes-col">Notes</th>';
    if (opts.blankNotes) headers += '<th class="blank-col">Notes</th>';

    // Build rows
    const rows = sorted.map((p, i) => {
      const stats = getPlayerStats(p.id);
      let row = `<td class="num">${i + 1}</td>`;
      row += `<td class="jersey">${p.number || '\u2014'}</td>`;
      row += `<td class="name">${p.name}</td>`;
      if (opts.defRating) row += `<td class="stat">${p.defRating}\u2605</td>`;
      if (opts.gloveArm) {
        row += `<td class="stat">${p.catchRating ? p.catchRating + '\u2605' : '\u2014'}</td>`;
        row += `<td class="stat">${p.throwRating ? p.throwRating + '\u2605' : '\u2014'}</td>`;
      }
      if (opts.obp) row += `<td class="stat">${stats.obp !== null ? stats.obp.toFixed(3).replace(/^0/, '') : '\u2014'}</td>`;
      if (opts.coachNotes) row += `<td class="notes-col">${p.notes || ''}</td>`;
      if (opts.blankNotes) row += `<td class="blank-col"><div class="notes-line"></div></td>`;
      return `<tr>${row}</tr>`;
    }).join('');

    const html = `
      <html><head><title>${team?.name || 'Roster'} \u2014 Practice Sheet</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Arial, sans-serif; padding: 24px; }
        table { width: 100%; border-collapse: collapse; }
        th { text-align: left; font-size: 9px; text-transform: uppercase; letter-spacing: 0.1em; color: #888; padding: 6px 8px; border-bottom: 2px solid #1a4332; }
        td { padding: 8px; border-bottom: 1px solid #ddd; font-size: 13px; vertical-align: top; }
        .num { width: 24px; text-align: center; color: #999; font-weight: 700; }
        .jersey { width: 40px; text-align: center; color: #1a4332; font-weight: 700; font-size: 15px; }
        .name { font-weight: 600; white-space: nowrap; }
        .stat { width: 50px; text-align: center; color: #555; font-size: 12px; }
        .notes-col { font-size: 11px; color: #666; max-width: 200px; }
        .blank-col { width: auto; }
        .notes-line { border-bottom: 1px dotted #bbb; height: 22px; min-width: 120px; }
      </style></head><body>
      <div style="display:flex;align-items:center;gap:12px;border-bottom:3px solid #1a4332;padding-bottom:8px;margin-bottom:16px;">
        <img src="/logo-square.jpg" alt="Dugout IQ" style="width:36px;height:36px;border-radius:8px;">
        <div style="font-size:18px;font-weight:700;color:#1a4332;">${team?.name || 'Team'} \u2014 Practice Sheet</div>
      </div>
      <table>
        <thead><tr>${headers}</tr></thead>
        <tbody>${rows}</tbody>
      </table>
      </body></html>
    `;

    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;top:-10000px;left:-10000px;width:0;height:0;';
    document.body.appendChild(iframe);
    const doc = iframe.contentDocument || iframe.contentWindow.document;
    doc.open();
    doc.write(html);
    doc.close();
    iframe.onload = () => {
      setTimeout(() => {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
        setTimeout(() => document.body.removeChild(iframe), 1000);
      }, 250);
    };
    setShowPrintConfig(false);
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <h2 className="text-xl font-bold text-lime">Team Roster</h2>
          <p className="text-xs text-chalk-muted mt-0.5">
            {players.length} player{players.length !== 1 ? 's' : ''} · Set ratings, roles, and preferences
          </p>
        </div>
        <div className="flex gap-2">
          {players.length > 0 && !('ontouchstart' in window) && (
            <button onClick={() => setShowPrintConfig(true)}
              className="px-3 py-2 rounded-lg bg-border text-chalk-dim font-bold text-xs
                         hover:bg-border-light active:scale-[0.97] transition-all">
              🖨 Practice Sheet
            </button>
          )}
          <button
            onClick={() => { setShowForm(!showForm); setEditingId(null); }}
            className="px-4 py-2 rounded-lg bg-lime text-field font-bold text-sm
                       hover:bg-lime-bright active:scale-[0.97] transition-all"
          >
            {showForm ? 'Cancel' : '+ Add Player'}
          </button>
        </div>
      </div>

      {/* Print Config Modal */}
      {showPrintConfig && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40" onClick={() => setShowPrintConfig(false)}>
          <div className="bg-white border border-gray-200 rounded-2xl p-5 w-full max-w-sm mx-4 shadow-2xl"
               onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-800 mb-1">Practice Sheet</h3>
            <p className="text-xs text-gray-500 mb-4">Choose what to include on the printout.</p>

            <div className="space-y-2.5 mb-5">
              {[
                ['defRating', 'Defensive rating (overall stars)'],
                ['gloveArm', 'Glove & arm ratings (if entered)'],
                ['obp', 'On-base percentage'],
                ['coachNotes', 'Coach notes (from roster)'],
                ['blankNotes', 'Blank notes column (write during practice)'],
              ].map(([key, label]) => (
                <label key={key} className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={printOpts[key]}
                    onChange={() => togglePrintOpt(key)}
                    className="w-4 h-4 accent-[#1a4332] rounded" />
                  <span className="text-sm text-gray-700">{label}</span>
                </label>
              ))}
            </div>

            <div className="flex gap-2">
              <button onClick={printRoster}
                className="flex-1 py-2.5 rounded-xl bg-[#1a4332] text-white font-bold text-sm
                           hover:bg-[#152e26] active:scale-[0.97] transition-all">
                🖨 Print
              </button>
              <button onClick={() => setShowPrintConfig(false)}
                className="px-4 py-2.5 rounded-xl bg-gray-100 text-gray-600 font-semibold text-sm
                           hover:bg-gray-200 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Form */}
      {showForm && (
        <PlayerForm
          onSave={async (data) => {
            if (editingId) {
              await updatePlayer(editingId, data);
            } else {
              await addPlayer(data);
            }
            setShowForm(false);
            setEditingId(null);
          }}
          onCancel={() => { setShowForm(false); setEditingId(null); }}
          initial={editingId ? players.find(p => p.id === editingId) : null}
        />
      )}

      {/* Player Grid */}
      {players.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-5xl mb-3">⚾</div>
          <p className="text-chalk-muted">Add your players to get started</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
          {players.map(player => (
            <PlayerCard
              key={player.id}
              player={player}
              onEdit={() => { setEditingId(player.id); setShowForm(true); }}
              onRemove={() => {
                if (confirm(`Remove ${player.name} from roster?`)) {
                  removePlayer(player.id);
                }
              }}
              onRatingChange={(rating) => updatePlayer(player.id, { defRating: rating })}
              onCatcherToggle={(val) => updatePlayer(player.id, { canCatch: val })}
              onPitcherToggle={(val) => updatePlayer(player.id, { canPitch: val })}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PlayerCard({ player, onEdit, onRemove, onRatingChange, onCatcherToggle, onPitcherToggle }) {
  const p = player;
  const { getPlayerStats, getRollingAvg } = useTeam();
  const stats = getPlayerStats(p.id);
  const rolling = getRollingAvg(p.id);

  return (
    <div className="bg-panel border border-border rounded-xl shadow-sm p-4 transition-colors relative">
      {/* Name + Jersey with divider */}
      <div className="flex items-start justify-between pb-2 mb-2 border-b border-border">
        <div className="text-lg font-bold text-chalk">{p.name}</div>
        {p.number && (
          <div className="text-xl font-bold text-chalk-muted/25 select-none">#{p.number}</div>
        )}
      </div>

      {/* Def Rating + Stars */}
      <div className="flex items-center gap-1 mb-2">
        <span className="text-xs text-chalk-muted">Def Rating: {p.defRating}/5</span>
        <StarRating value={p.defRating} onChange={onRatingChange} size="sm" />
      </div>

      {/* Stat Badges */}
      <div className="flex gap-1.5 flex-wrap mb-2">
        {rolling.absCount > 0 && (
          <span className="px-2 py-0.5 text-[11px] border border-border rounded text-chalk-dim">
            <strong>{rolling.avg.toFixed(2)}</strong> avg
          </span>
        )}
        {stats.obp !== null && (
          <span className="px-2 py-0.5 text-[11px] border border-border rounded text-chalk-dim">
            <strong className="text-sky">{stats.obp.toFixed(3).replace(/^0/, '')}</strong> OBP
          </span>
        )}
      </div>

      {/* Checkboxes + Edit */}
      <div className="flex items-center gap-3 mb-2">
        <label className="flex items-center gap-1.5 text-xs text-chalk-muted cursor-pointer">
          <input type="checkbox" checked={p.canPitch || false}
            onChange={e => onPitcherToggle(e.target.checked)}
            className="w-3.5 h-3.5 accent-red rounded" />
          Available Pitcher
        </label>
        <label className="flex items-center gap-1.5 text-xs text-chalk-muted cursor-pointer">
          <input type="checkbox" checked={p.canCatch || false}
            onChange={e => onCatcherToggle(e.target.checked)}
            className="w-3.5 h-3.5 accent-sky rounded" />
          Available Catcher
        </label>
        <div className="flex-1" />
        <button onClick={onEdit}
          className="px-2.5 py-1 text-xs font-semibold text-chalk-muted bg-field rounded-md hover:bg-border transition-colors">
          ✏️ Edit
        </button>
      </div>

      {/* Bottom row: Position prefs left, trash right */}
      <div className="flex items-center gap-1.5">
        {p.prefPositions?.length > 0 && p.prefPositions.map(pos => (
          <span key={pos} className="px-2 py-0.5 text-[10px] font-semibold text-chalk-muted border border-border rounded">
            {pos}
          </span>
        ))}
        <div className="flex-1" />
        <button onClick={onRemove}
          className="text-chalk-muted/30 hover:text-red transition-colors text-sm">
          🗑
        </button>
      </div>
    </div>
  );
}

function PlayerForm({ onSave, onCancel, initial }) {
  const [name, setName] = useState(initial?.name || '');
  const [number, setNumber] = useState(initial?.number || '');
  const [defRating, setDefRating] = useState(initial?.defRating || 3);
  const [catchRating, setCatchRating] = useState(initial?.catchRating || 0);
  const [throwRating, setThrowRating] = useState(initial?.throwRating || 0);
  const [showBreakdown, setShowBreakdown] = useState(!!(initial?.catchRating || initial?.throwRating));
  const [canPitch, setCanPitch] = useState(initial?.canPitch || false);
  const [canCatch, setCanCatch] = useState(initial?.canCatch || false);
  const [prefPositions, setPrefPositions] = useState(initial?.prefPositions || []);
  const [notes, setNotes] = useState(initial?.notes || '');
  const [saving, setSaving] = useState(false);

  // When catch/throw change, auto-compute defRating (round up the average)
  const updateBreakdown = (newCatch, newThrow) => {
    setCatchRating(newCatch);
    setThrowRating(newThrow);
    if (newCatch > 0 && newThrow > 0) {
      setDefRating(Math.ceil((newCatch + newThrow) / 2));
    } else if (newCatch > 0) {
      setDefRating(newCatch);
    } else if (newThrow > 0) {
      setDefRating(newThrow);
    }
  };

  const togglePref = (pos) => {
    setPrefPositions(prev =>
      prev.includes(pos) ? prev.filter(p => p !== pos) : [...prev, pos]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    const data = {
      name: name.trim(),
      number: number.trim(),
      defRating,
      canPitch,
      canCatch,
      prefPositions,
      notes: notes.trim(),
    };
    // Only store breakdown if coach used it
    if (showBreakdown && (catchRating > 0 || throwRating > 0)) {
      data.catchRating = catchRating;
      data.throwRating = throwRating;
    }
    await onSave(data);
    setSaving(false);
  };

  return (
    <div className="bg-panel border border-border rounded-xl shadow-sm p-5 mb-4">
      <h3 className="text-sm font-bold text-lime uppercase tracking-wider mb-4">
        {initial ? 'Edit Player' : 'New Player'}
      </h3>
      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
          <div className="col-span-2 sm:col-span-1">
            <label className="block text-[10px] font-semibold text-chalk-muted uppercase tracking-wider mb-1">Name</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)}
              placeholder="First name" autoFocus
              className="w-full px-3 py-2 rounded-lg bg-field border border-border text-chalk text-sm
                         placeholder:text-chalk-muted/40 focus:border-lime focus:outline-none" />
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-chalk-muted uppercase tracking-wider mb-1">Jersey #</label>
            <input type="text" value={number} onChange={e => setNumber(e.target.value)}
              placeholder="#" className="w-full px-3 py-2 rounded-lg bg-field border border-border text-chalk text-sm
                         placeholder:text-chalk-muted/40 focus:border-lime focus:outline-none" />
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-chalk-muted uppercase tracking-wider mb-1">Def. Rating</label>
            {!showBreakdown ? (
              <div>
                <StarRating value={defRating} onChange={setDefRating} size="md" />
                <button type="button" onClick={() => setShowBreakdown(true)}
                  className="text-[9px] text-sky hover:underline mt-1 block">
                  Break down by glove + arm
                </button>
              </div>
            ) : (
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-chalk-muted w-10">Glove</span>
                  <StarRating value={catchRating} onChange={(v) => updateBreakdown(v, throwRating)} size="sm" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-chalk-muted w-10">Arm</span>
                  <StarRating value={throwRating} onChange={(v) => updateBreakdown(catchRating, v)} size="sm" />
                </div>
                <div className="text-[10px] text-chalk-muted">
                  = <span className="font-bold text-gold">{defRating}★</span> overall
                  <button type="button" onClick={() => { setShowBreakdown(false); setCatchRating(0); setThrowRating(0); }}
                    className="text-[9px] text-chalk-muted/60 hover:underline ml-2">
                    use single rating instead
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Pitcher / Catcher */}
        <div className="flex gap-6 mb-4">
          <label className="flex items-center gap-2 cursor-pointer text-sm text-chalk-dim">
            <input type="checkbox" checked={canPitch} onChange={e => setCanPitch(e.target.checked)}
              className="w-4 h-4 accent-red rounded" />
            Available Pitcher
          </label>
          <label className="flex items-center gap-2 cursor-pointer text-sm text-chalk-dim">
            <input type="checkbox" checked={canCatch} onChange={e => setCanCatch(e.target.checked)}
              className="w-4 h-4 accent-sky rounded" />
            Available Catcher
          </label>
        </div>

        {/* Position Preferences */}
        <div className="mb-4">
          <label className="block text-[10px] font-semibold text-chalk-muted uppercase tracking-wider mb-2">
            Position Preferences <span className="font-normal text-chalk-muted/60">(extra weight in rotation)</span>
          </label>
          <div className="flex gap-2 flex-wrap">
            {POSITIONS.map(pos => (
              <button key={pos} type="button" onClick={() => togglePref(pos)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all
                  ${prefPositions.includes(pos)
                    ? 'bg-lime/15 text-lime border border-lime/40'
                    : 'bg-field border border-border text-chalk-muted hover:border-border-light'
                  }`}>
                {pos}
              </button>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div className="mb-4">
          <label className="block text-[10px] font-semibold text-chalk-muted uppercase tracking-wider mb-1">
            Coach Notes <span className="font-normal text-chalk-muted/60">(private)</span>
          </label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)}
            rows={2} placeholder="Optional notes about this player..."
            className="w-full px-3 py-2 rounded-lg bg-field border border-border text-chalk text-sm
                       placeholder:text-chalk-muted/40 focus:border-lime focus:outline-none resize-none" />
        </div>

        {/* Buttons */}
        <div className="flex gap-2">
          <button type="submit" disabled={!name.trim() || saving}
            className="px-5 py-2 rounded-lg bg-lime text-field font-bold text-sm
                       hover:bg-lime-bright active:scale-[0.97] transition-all
                       disabled:opacity-40 disabled:cursor-not-allowed">
            {saving ? 'Saving...' : initial ? 'Save Changes' : 'Add to Roster'}
          </button>
          <button type="button" onClick={onCancel}
            className="px-4 py-2 rounded-lg bg-border text-chalk text-sm font-semibold
                       hover:bg-border-light transition-colors">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
