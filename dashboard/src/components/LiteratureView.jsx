import React, { useState, useEffect, useMemo } from 'react';
import { useDashboard } from '../context/DashboardContext.jsx';
import { fold, foldTerms } from '../config/search.js';

// ---------------------------------------------------------------------------
// Literature view — searchable, filterable list of the __Literature database
// (one sidecar .md per PDF; served by /api/literature) with an inline PDF
// reader (browser-native viewer via /api/asset). Markdown sidecars stay the
// source of truth; this is a read-only projection.
// ---------------------------------------------------------------------------

let litCache = null;

function useLiterature() {
  const [state, setState] = useState(litCache);
  const [error, setError] = useState(null);
  useEffect(() => {
    if (litCache) { setState(litCache); return; }
    fetch('/api/literature')
      .then(r => r.ok ? r.json() : Promise.reject(new Error('failed to load /api/literature')))
      .then(d => { litCache = d; setState(d); })
      .catch(e => setError(e.message));
  }, []);
  return [state, error];
}

function authorLine(authors) {
  if (!authors?.length) return '—';
  const fams = authors.map(a => a.split(',')[0]);
  return fams.length <= 3 ? fams.join(', ') : `${fams[0]}, …, ${fams[fams.length - 1]} (${fams.length} authors)`;
}

// `fold` + `foldTerms` are shared with the graph + file-tree search (config/search.js).

// one searchable haystack per paper; authors in both "Last, First" and
// "First Last" order so natural-order name searches match
function haystack(p) {
  const both = p.authors.flatMap(a => {
    const [last, first] = a.split(',').map(x => x.trim());
    return [a, first ? `${first} ${last}` : a];
  });
  return fold([p.title, both.join(' '), p.journal, p.description, p.summary,
    p.tags.join(' '), p.doi, p.year, p.patent_number, p.assignee].join(' '));
}

// Optional provenance-tag highlight colors: papers carrying one of these frontmatter
// tags get a colored badge. Instance-specific vocabulary — empty by default (no
// highlight badges) so the slice ships no company literals; an instance maps its own
// tags → colors here (e.g. { 'our-publication': '#4b7bd4' }).
const HIGHLIGHT_TAGS = {};

const SORTS = {
  'year-desc': (a, b) => (b.year || 0) - (a.year || 0) || a.title.localeCompare(b.title),
  'year-asc': (a, b) => (a.year || 9999) - (b.year || 9999) || a.title.localeCompare(b.title),
  'title': (a, b) => a.title.localeCompare(b.title),
  'author': (a, b) => authorLine(a.authors).localeCompare(authorLine(b.authors)),
};

export default function LiteratureView() {
  const { selectFile } = useDashboard();
  const [data, error] = useLiterature();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState(null);
  const [typ, setTyp] = useState(null);
  const [sort, setSort] = useState('year-desc');
  const [selected, setSelected] = useState(null);

  const indexed = useMemo(
    () => data ? data.papers.map(p => ({ p, hay: haystack(p) })) : [],
    [data]);

  const list = useMemo(() => {
    let l = indexed;
    if (cat) l = l.filter(x => x.p.categories.includes(cat));
    if (typ) l = l.filter(x => x.p.type === typ);
    if (q) {
      // every whitespace-separated term must match somewhere in the haystack
      const terms = foldTerms(q);
      l = l.filter(x => terms.every(t => x.hay.includes(t)));
    }
    return l.map(x => x.p).sort(SORTS[sort]);
  }, [indexed, q, cat, typ, sort]);

  if (error) return <div className="dv-error">{error}</div>;
  if (!data) return <div className="dv-loading">Loading literature…</div>;

  const cats = [...new Set(data.papers.flatMap(p => p.categories))].sort();
  const types = [...new Set(data.papers.map(p => p.type))].sort();
  const catCount = c => data.papers.filter(p => p.categories.includes(c)).length;

  return (
    <div className="dv-root lit-root">
      <div className="dv-toolbar">
        <div className="lit-toolrow">
          <input
            className="dv-search"
            placeholder="Search title, authors, summary, tags, DOI…"
            value={q}
            onChange={e => setQ(e.target.value)}
          />
          <select className="lit-sort" value={cat ?? ''} onChange={e => setCat(e.target.value || null)}
            title="Filter by category">
            <option value="">All categories</option>
            {cats.map(c => (
              <option key={c} value={c}>{c} ({catCount(c)})</option>
            ))}
          </select>
          <select className="lit-sort" value={sort} onChange={e => setSort(e.target.value)}>
            <option value="year-desc">Newest first</option>
            <option value="year-asc">Oldest first</option>
            <option value="title">Title A–Z</option>
            <option value="author">First author A–Z</option>
          </select>
          <span className="dv-stamp">{list.length} / {data.count} items</span>
        </div>
        <div className="dv-chiprow">
          {types.map(t => (
            <button key={t} className={`dv-chip lit-chip-type ${typ === t ? 'dv-chip--on' : ''}`}
              onClick={() => setTyp(typ === t ? null : t)}>
              {t} ({data.papers.filter(p => p.type === t).length})
            </button>
          ))}
        </div>
      </div>

      <div className="lit-split">
        <div className={`lit-list ${selected ? 'lit-list--narrow' : ''}`}>
          {list.map(p => (
            <div key={p.id}
              className={`lit-row ${selected?.id === p.id ? 'lit-row--active' : ''}`}
              onClick={() => setSelected(p)}>
              <div className="lit-row-head">
                <span className="lit-year">{p.year || '—'}</span>
                <span className="lit-title" title={p.description}>{p.title}</span>
              </div>
              <div className="lit-row-sub">
                <span className="lit-authors">{authorLine(p.authors)}</span>
                {p.journal && <span className="lit-journal">{p.journal}</span>}
                <span className="dv-badge">{p.type}</span>
                {p.categories.map(c => <span key={c} className="dv-badge dv-badge--tier">{c}</span>)}
                {p.tags.filter(t => HIGHLIGHT_TAGS[t]).map(t => (
                  <span key={t} className="dv-badge" style={{ background: HIGHLIGHT_TAGS[t], color: '#fff' }}>{t}</span>
                ))}
                {p.supplement_files.length > 0 && <span className="dv-badge" title={p.supplement_files.join(', ')}>+SI</span>}
              </div>
            </div>
          ))}
          {list.length === 0 && <div className="dv-empty">No matches.</div>}
        </div>

        {selected && (
          <div className="lit-reader">
            <div className="lit-reader-bar">
              <span className="lit-reader-title" title={selected.title}>{selected.title}</span>
              <span className="lit-reader-meta">
                {selected.journal} {selected.year}
                {selected.doi && <> · <a href={`https://doi.org/${selected.doi}`} target="_blank" rel="noreferrer">doi</a></>}
              </span>
              <div className="lit-reader-actions">
                <button onClick={() => selectFile(selected.id)} title="Open the paper's info card (summary + metadata) in the file viewer">Info</button>
                <button onClick={() => fetch('/api/explorer', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: selected.pdf || selected.id }) })} title="Show in Windows Explorer">Explorer</button>
                {selected.pdf && <button onClick={() => window.open(`/api/asset?path=${encodeURIComponent(selected.pdf)}`, '_blank')} title="Open PDF in a new tab">↗</button>}
                <button onClick={() => setSelected(null)} title="Close reader">✕</button>
              </div>
            </div>
            {selected.pdf ? (
              <iframe
                key={selected.pdf}
                className="lit-pdf"
                title={selected.title}
                src={`/api/asset?path=${encodeURIComponent(selected.pdf)}`}
              />
            ) : (
              <div className="dv-empty">No PDF found next to this sidecar.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
