import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { initialHiddenFileTypes } from '../config/categories.js';

const DashboardContext = createContext();

export function DashboardProvider({ children }) {
  const [graphData, setGraphData] = useState(null);
  const [treeData, setTreeData] = useState(null);
  const [showSkillTiles, setShowSkillTiles] = useState(false);
  const [error, setError] = useState(null);

  // Multi-selection: set of selected node IDs (for graph + tree highlighting)
  const [selectedNodes, setSelectedNodes] = useState(new Set());
  // The primary/last-clicked file (drives FileViewer)
  const [selectedFile, setSelectedFile] = useState(null);
  // A project Overview id whose TIMELINE detail is open in the right panel
  // (Projects tab). Mutually exclusive with selectedFile: opening a project
  // clears the file view and vice-versa, so the right panel is never ambiguous.
  const [selectedProject, setSelectedProject] = useState(null);

  // File-type visibility filter — the live filter axis (default visibility is
  // encoded in src/config/categories.js). Consumed by TreeGraph's Types ▾ menu
  // and the jump-to-node search.
  const [hiddenFileTypes, setHiddenFileTypes] = useState(() => initialHiddenFileTypes());

  // Select a node from the graph. If additive (shift+click), toggle in set; else replace.
  const selectNode = useCallback((nodeId, additive = false) => {
    if (!nodeId) {
      setSelectedNodes(new Set());
      setSelectedFile(null);
      setShowSkillTiles(false);
      return;
    }

    setShowSkillTiles(false);
    setSelectedProject(null);     // opening a file closes any project timeline
    setSelectedFile(nodeId);

    if (additive) {
      setSelectedNodes(prev => {
        const next = new Set(prev);
        if (next.has(nodeId)) {
          next.delete(nodeId);
          // If we removed the last node, clear selectedFile too
          if (next.size === 0) setSelectedFile(null);
        } else {
          next.add(nodeId);
        }
        return next;
      });
    } else {
      setSelectedNodes(new Set([nodeId]));
    }
  }, []);

  // Select from the tree (always single-select, handles directories)
  const selectFile = useCallback((filePath) => {
    setSelectedProject(null);     // opening a file closes any project timeline
    if (filePath && (filePath.endsWith('/') || filePath === '.claude/commands')) {
      setShowSkillTiles(filePath === '.claude/commands');
      setSelectedFile(filePath);
      setSelectedNodes(new Set());
      return;
    }
    setShowSkillTiles(false);
    setSelectedFile(filePath);
    setSelectedNodes(filePath ? new Set([filePath]) : new Set());
  }, []);

  // Open a project's TIMELINE detail (Projects tab card click). Clears the file
  // view so the right panel shows the project detail, not a stale file.
  const openTimeline = useCallback((projectId) => {
    if (!projectId) return;
    setShowSkillTiles(false);
    setSelectedFile(null);
    setSelectedNodes(new Set());
    setSelectedProject(projectId);
  }, []);
  const closeTimeline = useCallback(() => setSelectedProject(null), []);

  const clearSelection = useCallback(() => {
    setSelectedFile(null);
    setSelectedNodes(new Set());
    setShowSkillTiles(false);
    setSelectedProject(null);
  }, []);

  const toggleFileType = useCallback((ftId) => {
    setHiddenFileTypes(prev => {
      const next = new Set(prev);
      if (next.has(ftId)) next.delete(ftId);
      else next.add(ftId);
      return next;
    });
  }, []);

  const fetchGraph = useCallback(async () => {
    try {
      const res = await fetch('/api/graph');
      if (!res.ok) throw new Error(`Graph API returned ${res.status}`);
      const data = await res.json();
      setGraphData(data);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch graph:', err);
      setError(`Failed to load graph: ${err.message}`);
    }
  }, []);

  const fetchTree = useCallback(async () => {
    try {
      const res = await fetch('/api/tree');
      if (!res.ok) throw new Error(`Tree API returned ${res.status}`);
      const data = await res.json();
      setTreeData(data);
    } catch (err) {
      console.error('Failed to fetch tree:', err);
      setError(`Failed to load tree: ${err.message}`);
    }
  }, []);

  const openInExplorer = useCallback(async (filePath) => {
    try {
      await fetch('/api/explorer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: filePath }),
      });
    } catch (err) {
      console.error('Failed to open explorer:', err);
    }
  }, []);

  const openInVSCode = useCallback(async (filePath) => {
    try {
      await fetch('/api/vscode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: filePath }),
      });
    } catch (err) {
      console.error('Failed to open VS Code:', err);
    }
  }, []);

  const refreshAll = useCallback(async () => {
    await Promise.all([fetchGraph(), fetchTree()]);
  }, [fetchGraph, fetchTree]);

  useEffect(() => {
    fetchGraph();
    fetchTree();
  }, [fetchGraph, fetchTree]);

  return (
    <DashboardContext.Provider value={{
      graphData, treeData, selectedFile, selectedNodes, showSkillTiles, error,
      selectedProject, openTimeline, closeTimeline,
      hiddenFileTypes, setHiddenFileTypes,
      fetchGraph, fetchTree, selectFile, selectNode, clearSelection,
      openInExplorer, openInVSCode, refreshAll, toggleFileType,
    }}>
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboard() {
  const ctx = useContext(DashboardContext);
  if (!ctx) throw new Error('useDashboard must be used within DashboardProvider');
  return ctx;
}
