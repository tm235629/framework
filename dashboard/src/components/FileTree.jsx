import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useDashboard } from '../context/DashboardContext.jsx';
import {
  FOLDER_CAT_BY_ID,
  FILE_TYPE_BY_ID,
  styleForFolderSub,
} from '../config/categories.js';
import { fold, foldTerms } from '../config/search.js';
import { fetchConfig, toNativePath } from '../utils/paths.js';

// Color resolution: prefer the most specific bucket
// (sub-cat → top cat → file-type fallback).
function treeNodeColor(node) {
  if (node.folderSubCat && node.folderCat)
    return styleForFolderSub(node.folderCat, node.folderSubCat).color;
  if (node.folderCat) return FOLDER_CAT_BY_ID[node.folderCat]?.color || '#6b7280';
  if (node.fileType)  return FILE_TYPE_BY_ID[node.fileType]?.color   || '#6b7280';
  return '#6b7280';
}

function TreeNode({ node, depth, expanded, onToggle, selectedNodes, selectedFile, onSelect, onContextMenu }) {
  const isDir = node.type === 'directory';
  const isSelected = selectedNodes.has(node.path) || selectedFile === node.path;
  const isExpanded = expanded.has(node.path);
  const isSkill = node.category === 'skill';
  const displayName = isSkill ? `/${node.name.replace('.md', '')}` : node.name;

  const handleClick = (e) => {
    e.stopPropagation();
    // Folders only expand/collapse — they must NOT select. Selecting a folder set
    // selectedNodes, and the reveal effect re-derives `expanded` from each selected
    // node's ancestor chain (which includes the folder itself), instantly undoing a
    // manual collapse. Toggle-only keeps collapse working (and matches Explorer/VS Code).
    if (isDir) onToggle(node.path);
    else onSelect(node.path);
  };

  const handleContextMenu = (e) => {
    e.preventDefault();
    e.stopPropagation();
    onContextMenu(e, node);
  };

  return (
    <>
      <div
        className={`tree-node ${isDir ? 'tree-node--dir' : ''} ${isSelected ? 'tree-node--selected' : ''}`}
        style={{ paddingLeft: 8 + depth * 16 }}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        title={node.path}
        data-path={node.path}
      >
        <span className={`tree-chevron ${isDir ? (isExpanded ? 'open' : '') : 'hidden'}`}>
          &#9654;
        </span>

        {isDir ? (
          <span className="tree-icon" style={{ color: 'var(--text-muted)' }}>
            {isExpanded ? '\uD83D\uDCC2' : '\uD83D\uDCC1'}
          </span>
        ) : node.hasGraph ? (
          <span className="tree-category-dot" style={{ background: treeNodeColor(node) }} />
        ) : (
          <span className="tree-icon" style={{ color: 'var(--text-muted)', fontSize: 10 }}>&#9679;</span>
        )}

        <span className="tree-label">{displayName}</span>

        {node.collapsed && node.fileCount > 0 && (
          <span className="tree-badge">{node.fileCount}</span>
        )}
      </div>

      {isDir && isExpanded && node.children && node.children.map(child => (
        <TreeNode
          key={child.path}
          node={child}
          depth={depth + 1}
          expanded={expanded}
          onToggle={onToggle}
          selectedNodes={selectedNodes}
          selectedFile={selectedFile}
          onSelect={onSelect}
          onContextMenu={onContextMenu}
        />
      ))}
    </>
  );
}

// Build the set of ancestor directories for a file path
function getAncestorPaths(filePath) {
  const parts = filePath.split('/');
  const paths = new Set();
  for (let i = 1; i <= parts.length; i++) {
    paths.add(parts.slice(0, i).join('/'));
  }
  return paths;
}

export default function FileTree() {
  const { treeData, selectedFile, selectedNodes, selectFile, openInExplorer, openInVSCode } = useDashboard();
  // Start fully collapsed
  const [expanded, setExpanded] = useState(new Set());
  const [search, setSearch] = useState('');
  const [contextMenu, setContextMenu] = useState(null);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const menuRef = useRef(null);
  const prevSelectedRef = useRef(new Set());
  const [config, setConfig] = useState(null);

  // Fetch the instance root once for "copy full path"; if it fails, the literal
  // fallback inside toNativePath keeps behavior identical to before.
  useEffect(() => { fetchConfig().then(setConfig); }, []);

  // Derive tree expansion from selectedNodes
  useEffect(() => {
    if (selectedNodes.size === 0) {
      setExpanded(new Set());
      return;
    }

    // Clear search so tree shows full structure
    setSearch('');

    // Reveal the selection by expanding its ancestor chain — MERGED into the
    // existing expanded set, not replacing it, so the user's own manual expansions
    // (and collapses) survive a selection change instead of being clobbered.
    setExpanded(prev => {
      const next = new Set(prev);
      for (const nodeId of selectedNodes) {
        for (const p of getAncestorPaths(nodeId)) next.add(p);
      }
      return next;
    });

    // Find the most recently added node (not in previous selection) for scrolling
    const prevSet = prevSelectedRef.current;
    let scrollTarget = null;
    for (const id of selectedNodes) {
      if (!prevSet.has(id)) scrollTarget = id;
    }
    // If nothing new was added (toggle-off), scroll to last node in set
    if (!scrollTarget && selectedNodes.size > 0) {
      scrollTarget = [...selectedNodes].pop();
    }
    prevSelectedRef.current = new Set(selectedNodes);

    // Scroll to target after React re-renders
    if (scrollTarget) {
      requestAnimationFrame(() => {
        setTimeout(() => {
          const el = document.querySelector(`[data-path="${CSS.escape(scrollTarget)}"]`);
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 150);
      });
    }
  }, [selectedNodes]);

  // Close context menu on click outside
  useEffect(() => {
    if (!contextMenu) return;
    const handleClick = () => setContextMenu(null);
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [contextMenu]);

  const handleToggle = useCallback((path) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  const handleContextMenu = useCallback((e, node) => {
    setContextMenu({ x: e.clientX, y: e.clientY, node });
  }, []);

  const handleCopyPath = useCallback((fullPath) => {
    // Uses the server-supplied root (via config); toNativePath falls back to the
    // historical MOT literal when config hasn't loaded / failed to fetch.
    const windowsPath = toNativePath(fullPath, config);
    navigator.clipboard.writeText(windowsPath);
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 1500);
    setContextMenu(null);
  }, [config]);

  const handleOpenExplorer = useCallback((filePath) => {
    openInExplorer(filePath);
    setContextMenu(null);
  }, [openInExplorer]);

  // Filter tree by search. Multi-term + accent-folding (shared with the graph
  // and literature search via config/search.js): every whitespace-separated
  // term must match the (folded) file/folder name, so "bosch tester" narrows
  // and "Mass" matches "Maß".
  const terms = useMemo(() => foldTerms(search), [search]);
  const filterTree = useCallback((node) => {
    if (!terms.length) return node;
    const selfMatch = terms.every(t => fold(node.name).includes(t));

    if (node.type === 'file') {
      return selfMatch ? node : null;
    }

    // Directory: keep if it matches itself or any child matches
    const filteredChildren = (node.children || [])
      .map(c => filterTree(c))
      .filter(Boolean);

    if (filteredChildren.length === 0 && !selfMatch) {
      return null;
    }

    return { ...node, children: filteredChildren };
  }, [terms]);

  if (!treeData) return <div className="file-tree"><div style={{ padding: 12, color: 'var(--text-muted)' }}>Loading...</div></div>;

  const displayTree = filterTree(treeData);

  return (
    <div className="file-tree">
      <div className="tree-search">
        <input
          type="text"
          placeholder="Filter files..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className="tree-list">
        {displayTree && displayTree.children && displayTree.children.map(node => (
          <TreeNode
            key={node.path}
            node={node}
            depth={0}
            expanded={search ? new Set(getAllPaths(displayTree)) : expanded}
            onToggle={handleToggle}
            selectedNodes={selectedNodes}
            selectedFile={selectedFile}
            onSelect={selectFile}
            onContextMenu={handleContextMenu}
          />
        ))}
        {search && (!displayTree || !displayTree.children?.length) && (
          <div style={{ padding: 12, color: 'var(--text-muted)' }}>No matches</div>
        )}
      </div>

      {contextMenu && (
        <div
          ref={menuRef}
          className="tree-context-menu"
          style={{ position: 'fixed', left: contextMenu.x, top: contextMenu.y }}
        >
          {contextMenu.node.type === 'file' && (
            <div className="tree-context-item" onClick={() => { selectFile(contextMenu.node.path); setContextMenu(null); }}>
              Open
            </div>
          )}
          {contextMenu.node.type === 'file' && (
            <div className="tree-context-item" onClick={() => { openInVSCode(contextMenu.node.path); setContextMenu(null); }}>
              Open in VS Code
            </div>
          )}
          <div className="tree-context-item" onClick={() => handleOpenExplorer(contextMenu.node.path)}>
            Open in Explorer
          </div>
          <div className="tree-context-item" onClick={() => handleCopyPath(contextMenu.node.path)}>
            {copyFeedback ? 'Copied!' : 'Copy full path'}
          </div>
        </div>
      )}
    </div>
  );
}

// Helper: get all directory paths in a tree (for auto-expand during search)
function getAllPaths(node) {
  const paths = [];
  if (node.type === 'directory') {
    paths.push(node.path);
    for (const child of (node.children || [])) {
      paths.push(...getAllPaths(child));
    }
  }
  return paths;
}
