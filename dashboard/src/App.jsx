import React, { useState, useEffect } from 'react';
import { useDashboard } from './context/DashboardContext.jsx';
import { useResizable } from './hooks/useResizable.js';
import { usePersistentState } from './hooks/usePersistentState.js';
import FileTree from './components/FileTree.jsx';
import TreeGraph from './components/TreeGraph.jsx';
import FileViewer from './components/FileViewer.jsx';
import SkillTiles from './components/SkillTiles.jsx';
import { ProjectsView, ProjectDetail, SyncView, TodosView, CalendarView, ContactsView } from './components/DataViews.jsx';
import LiteratureView from './components/LiteratureView.jsx';
import { applyInstanceConfig } from './config/instance-config.js';
import './app.css';

const VIEWS = [
  { id: 'graph', label: 'Graph' },
  { id: 'projects', label: 'Projects' },
  { id: 'contacts', label: 'Contacts' },
  { id: 'sync', label: 'Sync' },
  { id: 'todos', label: 'To-Do' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'literature', label: 'Literature' },
  { id: 'skills', label: 'Skills' },
];

export default function App() {
  const { graphData, selectedFile, selectedNodes, showSkillTiles, error, selectNode, clearSelection, refreshAll, selectedProject, closeTimeline } = useDashboard();
  const { width: leftWidth, isResizing, onMouseDown } = useResizable(280, 180, 500);
  // Instance identity comes from /api/config (the server derives it from KB_ROOT +
  // the manifest display name). Falls back to a neutral label before the fetch
  // resolves, so the header never hardcodes a company name.
  const [displayName, setDisplayName] = useState('Dashboard');
  useEffect(() => {
    let alive = true;
    fetch('/api/config').then(r => r.ok ? r.json() : null).then(cfg => {
      if (!alive || !cfg) return;
      // Merge manifest-derived vocab orders / category rules over the client
      // fallbacks so the Projects facets sort by this instance's ordering.
      applyInstanceConfig(cfg);
      if (cfg.displayName) setDisplayName(cfg.displayName);
    }).catch(() => { /* keep default label + fallback vocab */ });
    return () => { alive = false; };
  }, []);
  // Active tab persists across reloads; coerce an unknown/removed persisted id
  // back to 'graph' so a stale localStorage value can't blank the center panel.
  const [view, setView] = usePersistentState('mot-view', 'graph');
  const activeView = VIEWS.some(v => v.id === view) ? view : 'graph';

  // Escape closes whatever is open in the right panel (file viewer, skill tiles,
  // or a project timeline) — one shortcut covers every variant.
  useEffect(() => {
    if (!selectedFile && !selectedProject) return;
    const onKey = (e) => { if (e.key === 'Escape') clearSelection(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedFile, selectedProject, clearSelection]);
  // Left file panel is hidden by default — the graph is the primary navigation.
  // Toggle it from the header button (persisted across reloads).
  const [showLeft, setShowLeft] = useState(() => {
    try { return localStorage.getItem('mot-show-left') === '1'; } catch { return false; }
  });
  const toggleLeft = () => setShowLeft(s => {
    const next = !s;
    try { localStorage.setItem('mot-show-left', next ? '1' : '0'); } catch { /* ignore */ }
    return next;
  });

  const handleNodeClick = (node, event) => {
    if (!node.id) {
      clearSelection();
      return;
    }
    selectNode(node.id, event?.shiftKey);
  };

  return (
    <div className="app">
      <header className="header">
        <div className="header-brand">
          {activeView === 'graph' && (
            <button
              className={`panel-toggle ${showLeft ? 'panel-toggle--on' : ''}`}
              onClick={toggleLeft}
              title={showLeft ? 'Hide file panel' : 'Show file panel'}
              aria-label="Toggle file panel"
            >
              {showLeft ? '◀' : '☰'}
            </button>
          )}
          <span className="header-logo">{displayName}</span>
          <span className="header-title">Dashboard</span>
        </div>
        <nav className="header-tabs">
          {VIEWS.map(v => (
            <button
              key={v.id}
              className={`header-tab ${activeView === v.id ? 'header-tab--active' : ''}`}
              onClick={() => setView(v.id)}
            >
              {v.label}
            </button>
          ))}
        </nav>
        <div className="header-actions">
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {graphData ? `${graphData.nodes.length} nodes, ${graphData.edges.length} edges` : '...'}
          </span>
        </div>
      </header>

      <main className="three-panel">
        {activeView === 'graph' && showLeft && (
          <>
            <div className="panel-left" style={{ width: leftWidth }}>
              <FileTree />
            </div>

            <div
              className={`resize-handle ${isResizing ? 'active' : ''}`}
              onMouseDown={onMouseDown}
            />
          </>
        )}

        <div className="panel-center">
          {error && (
            <div style={{ padding: '12px 16px', background: '#3b1518', color: '#f87171', borderBottom: '1px solid #522', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>⚠️ {error}</span>
              <button onClick={refreshAll} style={{ marginLeft: 'auto', padding: '2px 10px', background: '#4a2020', color: '#f87171', border: '1px solid #633', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}>Retry</button>
            </div>
          )}
          {activeView === 'graph' && graphData && (
            <TreeGraph
              data={graphData}
              onNodeClick={handleNodeClick}
              selectedNodes={selectedNodes}
            />
          )}
          {activeView === 'projects' && <ProjectsView />}
          {activeView === 'contacts' && <ContactsView />}
          {activeView === 'sync' && <SyncView />}
          {activeView === 'todos' && <TodosView />}
          {activeView === 'calendar' && <CalendarView />}
          {activeView === 'literature' && <LiteratureView />}
          {activeView === 'skills' && <SkillTiles />}
        </div>

        {(selectedFile || selectedProject) && (
          <div className="panel-right" style={{ width: '40%', maxWidth: 600, minWidth: 300 }}>
            {selectedProject ? (
              <ProjectDetail projectId={selectedProject} onClose={closeTimeline} />
            ) : showSkillTiles ? (
              <SkillTiles />
            ) : (
              <FileViewer
                filePath={selectedFile}
                onClose={clearSelection}
              />
            )}
          </div>
        )}
      </main>
    </div>
  );
}
