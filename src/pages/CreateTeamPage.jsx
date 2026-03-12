import { useState } from 'react';
import { useTeam } from '../contexts/TeamContext';

export default function CreateTeamPage() {
  const { createTeam } = useTeam();
  const [name, setName] = useState('');
  const [sport, setSport] = useState('softball');
  const [seasonYear, setSeasonYear] = useState(new Date().getFullYear());
  const [seasonLabel, setSeasonLabel] = useState('Spring');
  const [creating, setCreating] = useState(false);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    try {
      await createTeam({ name: name.trim(), sport, seasonYear, seasonLabel });
    } catch (err) {
      console.error('Failed to create team:', err);
      setCreating(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4"
         style={{ background: 'radial-gradient(ellipse at 30% 20%, rgba(142,212,49,0.06) 0%, transparent 60%), var(--color-field)' }}>
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-lime mb-1">Create Your Team</h1>
          <p className="text-chalk-muted text-sm">Set up your first team to get started</p>
        </div>

        <form onSubmit={handleCreate} className="space-y-5">
          {/* Team Name */}
          <div>
            <label className="block text-xs font-semibold text-chalk-muted uppercase tracking-wider mb-1.5">
              Team Name
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Thunder, Wildcats, Pabst Softball"
              className="w-full px-4 py-3 rounded-xl bg-panel border border-border text-chalk
                         placeholder:text-chalk-muted/40 focus:border-lime focus:outline-none
                         transition-colors"
              autoFocus
            />
          </div>

          {/* Sport */}
          <div>
            <label className="block text-xs font-semibold text-chalk-muted uppercase tracking-wider mb-1.5">
              Sport
            </label>
            <div className="grid grid-cols-2 gap-3">
              {['softball', 'baseball'].map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSport(s)}
                  className={`px-4 py-3 rounded-xl border text-sm font-semibold capitalize transition-all
                    ${sport === s
                      ? 'border-lime bg-lime/10 text-lime'
                      : 'border-border bg-panel text-chalk-muted hover:border-border-light'
                    }`}
                >
                  {s === 'softball' ? '🥎' : '⚾'} {s}
                </button>
              ))}
            </div>
          </div>

          {/* Season */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-chalk-muted uppercase tracking-wider mb-1.5">
                Season
              </label>
              <select
                value={seasonLabel}
                onChange={e => setSeasonLabel(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-panel border border-border text-chalk
                           focus:border-lime focus:outline-none transition-colors"
              >
                {['Spring', 'Summer', 'Fall', 'Winter'].map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-chalk-muted uppercase tracking-wider mb-1.5">
                Year
              </label>
              <input
                type="number"
                value={seasonYear}
                onChange={e => setSeasonYear(Number(e.target.value))}
                className="w-full px-4 py-3 rounded-xl bg-panel border border-border text-chalk
                           focus:border-lime focus:outline-none transition-colors"
              />
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={!name.trim() || creating}
            className="w-full py-3.5 rounded-xl bg-lime text-field font-bold text-sm uppercase tracking-wider
                       hover:bg-lime-bright active:scale-[0.98] transition-all duration-150
                       disabled:opacity-40 disabled:cursor-not-allowed
                       shadow-lg shadow-lime/20"
          >
            {creating ? 'Creating...' : 'Create Team'}
          </button>
        </form>
      </div>
    </div>
  );
}
