import { useState } from 'react';
import { useTeam } from '../../contexts/TeamContext';
import StarRating from '../shared/StarRating';

const POSITIONS = ['Pitcher', 'Catcher', '1st Base', '2nd Base', 'Shortstop', '3rd Base', 'Left Field', 'Center Field', 'Right Field'];

export default function RosterTab() {
  const { players, addPlayer, updatePlayer, removePlayer } = useTeam();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);

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
        <button
          onClick={() => { setShowForm(!showForm); setEditingId(null); }}
          className="px-4 py-2 rounded-lg bg-lime text-field font-bold text-sm
                     hover:bg-lime-bright active:scale-[0.97] transition-all"
        >
          {showForm ? 'Cancel' : '+ Add Player'}
        </button>
      </div>

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

      {/* Def Rating + Stars inline */}
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

      {/* Bottom row: Position prefs (left) + Trash (right) */}
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
  const [canPitch, setCanPitch] = useState(initial?.canPitch || false);
  const [canCatch, setCanCatch] = useState(initial?.canCatch || false);
  const [prefPositions, setPrefPositions] = useState(initial?.prefPositions || []);
  const [notes, setNotes] = useState(initial?.notes || '');
  const [saving, setSaving] = useState(false);

  const togglePref = (pos) => {
    setPrefPositions(prev =>
      prev.includes(pos) ? prev.filter(p => p !== pos) : [...prev, pos]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    await onSave({
      name: name.trim(),
      number: number.trim(),
      defRating,
      canPitch,
      canCatch,
      prefPositions,
      notes: notes.trim(),
    });
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
            <StarRating value={defRating} onChange={setDefRating} size="md" />
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
