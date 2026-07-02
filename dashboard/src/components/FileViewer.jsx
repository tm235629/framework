import React, { useState, useEffect, useCallback } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useDashboard } from '../context/DashboardContext.jsx';
import {
  FOLDER_CAT_BY_ID,
  FILE_TYPE_BY_ID,
  styleForFolderSub,
} from '../config/categories.js';
import { resolvePath, fetchConfig, toNativePath } from '../utils/paths.js';

// The native path prefix comes from the server (KB_ROOT) via /api/config; until it
// arrives the "copy full path" string degrades to a plain relative path (no
// hardcoded instance root — see fetchConfig / rootPrefix in utils/paths.js).

// ---------------------------------------------------------------------------
// Renderer dispatch by extension. `viewerKind` decides how the content pane
// renders a file:
//   markdown → react-markdown          text     → <pre> (code/notes/csv/logs)
//   pdf      → <iframe> (/api/asset)    json     → pretty-printed <pre>
//   html     → sandboxed <iframe>       image    → <img> (incl. svg)
//   binary   → metadata card (docx/xlsx/pptx/cad/zip — can't render in-browser)
// Adding a new format = add its extension to one of these sets (+ CSS if needed).
// ---------------------------------------------------------------------------
const EXT_KIND = {
  markdown: ['md', 'markdown', 'mdx'],
  pdf: ['pdf'],
  html: ['html', 'htm'],
  image: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico', 'avif'],
  json: ['json', 'jsonl', 'geojson'],
  text: [
    'txt', 'csv', 'tsv', 'log', 'yml', 'yaml', 'xml', 'toml', 'ini', 'cfg', 'env',
    'js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs', 'css', 'scss', 'py', 'sh', 'bat', 'ps1',
    'c', 'cpp', 'h', 'hpp', 'java', 'go', 'rs', 'rb', 'php', 'sql', 'r', 'm',
  ],
};
const KIND_BY_EXT = Object.fromEntries(
  Object.entries(EXT_KIND).flatMap(([kind, exts]) => exts.map(e => [e, kind]))
);
function extOf(filePath) {
  const base = filePath.split('/').pop();
  const dot = base.lastIndexOf('.');
  return dot > 0 ? base.slice(dot + 1).toLowerCase() : '';
}
function viewerKindFor(filePath) {
  return KIND_BY_EXT[extOf(filePath)] || 'binary';
}
// Kinds whose content we fetch as UTF-8 text from /api/files; others stream via /api/asset.
const TEXT_KINDS = new Set(['markdown', 'json', 'text']);

// Convert a hex color to an rgba string with the given alpha.
function withAlpha(hex, alpha) {
  if (!hex || !hex.startsWith('#') || hex.length < 7) return hex;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function styleForNode(node) {
  if (!node) return { color: '#84cc16', bg: 'rgba(132, 204, 22, 0.15)', label: 'file' };
  if (node.folderSubCat && node.folderCat) {
    const s = styleForFolderSub(node.folderCat, node.folderSubCat);
    return { color: s.color, bg: withAlpha(s.color, 0.15), label: s.label };
  }
  if (node.folderCat) {
    const c = FOLDER_CAT_BY_ID[node.folderCat];
    return { color: c?.color || '#6b7280', bg: withAlpha(c?.color || '#6b7280', 0.15), label: c?.label || node.folderCat };
  }
  if (node.fileType) {
    const ft = FILE_TYPE_BY_ID[node.fileType];
    return { color: ft?.color || '#6b7280', bg: withAlpha(ft?.color || '#6b7280', 0.15), label: ft?.label || node.fileType };
  }
  return { color: '#6b7280', bg: 'rgba(107, 114, 128, 0.15)', label: 'file' };
}

const ASSET_ICONS = {
  document: '📄',
  spreadsheet: '📊',
  presentation: '💻',
  image: '🖼️',
};

// Pretty-print JSON; return the raw string unchanged if it doesn't parse.
function prettyJson(raw) {
  try { return JSON.stringify(JSON.parse(raw), null, 2); }
  catch { return raw; }
}

export default function FileViewer({ filePath, onClose }) {
  const { openInExplorer, openInVSCode, graphData, selectFile } = useDashboard();
  const [content, setContent] = useState('');
  const [frontmatter, setFrontmatter] = useState(null);
  const [modified, setModified] = useState('');
  const [error, setError] = useState(null);
  const [pathCopied, setPathCopied] = useState(false);
  const [config, setConfig] = useState(null);

  // Fetch the instance root once; until it arrives the path stays relative.
  useEffect(() => { fetchConfig().then(setConfig); }, []);

  const nativePath = config
    ? toNativePath(filePath, config)
    : filePath.replace(/\//g, '\\');

  // Find node info from graph
  const nodeInfo = graphData?.nodes?.find(n => n.id === filePath);
  const category = nodeInfo?.category;
  const styled = styleForNode(nodeInfo);
  const catStyle = { color: styled.color, bg: styled.bg };

  const kind = viewerKindFor(filePath);
  const assetUrl = `/api/asset?path=${encodeURIComponent(filePath)}`;

  useEffect(() => {
    if (!filePath) return;
    setError(null);
    setContent('');
    setFrontmatter(null);
    setModified('');
    if (!TEXT_KINDS.has(kind)) return; // pdf/html/image stream via /api/asset; binary = card
    fetch(`/api/files?path=${encodeURIComponent(filePath)}`)
      .then(r => r.ok ? r.json() : Promise.reject(new Error(`Could not open: ${filePath}`)))
      .then(data => {
        setContent(data.content);
        setModified(new Date(data.modified).toLocaleString());
        setFrontmatter(data.frontmatter || null);
      })
      .catch(err => setError(String(err)));
  }, [filePath, kind]);

  const handleCopyPath = useCallback(() => {
    navigator.clipboard.writeText(nativePath);
    setPathCopied(true);
    setTimeout(() => setPathCopied(false), 1500);
  }, [nativePath]);

  // pdf/html/image render edge-to-edge (no padding); text/markdown keep padding.
  const isFrameKind = kind === 'pdf' || kind === 'html' || kind === 'image';

  return (
    <div className="file-viewer">
      <div className="viewer-header">
        <div
          className={`viewer-path ${pathCopied ? 'viewer-path-copied' : ''}`}
          onClick={handleCopyPath}
          title={`${nativePath} (click to copy)`}
        >
          {pathCopied ? 'Copied!' : filePath}
        </div>
        <div className="viewer-actions">
          {isFrameKind && (
            <button className="btn btn-sm" onClick={() => window.open(assetUrl, '_blank')} title="Open in a new tab">↗</button>
          )}
          <button className="btn btn-sm" onClick={() => openInVSCode(filePath)} title="Open in VS Code">
            VS Code
          </button>
          <button className="btn btn-sm" onClick={() => openInExplorer(filePath)} title="Open in Windows Explorer">
            Explorer
          </button>
          <button className="btn-close" onClick={onClose}>&times;</button>
        </div>
      </div>

      <div className="viewer-meta">
        {styled.label && (
          <span className="viewer-meta-badge" style={{ background: catStyle.bg, color: catStyle.color }}>
            {styled.label}
          </span>
        )}
        {modified && <span>Modified: {modified}</span>}
      </div>

      {frontmatter && (
        <div className="viewer-frontmatter">
          {frontmatter.description && (
            <div className="viewer-frontmatter-desc">{frontmatter.description}</div>
          )}
          {Array.isArray(frontmatter.references) && frontmatter.references.length > 0 && (
            <div className="viewer-frontmatter-refs">
              {frontmatter.references.map((ref, i) => (
                <span
                  key={i}
                  className="viewer-ref-badge"
                  onClick={() => selectFile(resolvePath(filePath, ref.path))}
                  title={ref.path}
                >
                  <span style={{ fontSize: 8 }}>
                    {ref.type === 'input' ? '⬅' : ref.type === 'output' ? '➡' : ref.type === 'trigger' ? '⚡' : '•'}
                  </span>
                  {ref.path?.split('/').pop()?.replace('.md', '')}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {error && <div className="viewer-error">{error}</div>}

      {/* ---- Content pane: dispatch on viewerKind ---- */}
      {kind === 'markdown' && (
        <div className="viewer-content">
          <div className="markdown-body">
            <Markdown remarkPlugins={[remarkGfm]}>{content}</Markdown>
          </div>
        </div>
      )}

      {kind === 'pdf' && (
        <div className="viewer-content viewer-content--frame">
          {/* PDF open params (Chrome/PDFium): navpanes=0 hides the thumbnail sidebar,
              view=FitH fits the page to the viewer width by default. */}
          <iframe key={filePath} className="viewer-frame" title={filePath} src={`${assetUrl}#navpanes=0&view=FitH`} />
        </div>
      )}

      {kind === 'html' && (
        <div className="viewer-content viewer-content--frame">
          <iframe
            key={filePath}
            className="viewer-frame"
            title={filePath}
            src={assetUrl}
            sandbox="allow-same-origin"
          />
        </div>
      )}

      {kind === 'image' && (
        <div className="viewer-content viewer-content--frame viewer-content--image">
          <img className="viewer-image" src={assetUrl} alt={filePath.split('/').pop()} />
        </div>
      )}

      {kind === 'json' && (
        <div className="viewer-content">
          <pre className="viewer-code viewer-code--json">{prettyJson(content)}</pre>
        </div>
      )}

      {kind === 'text' && (
        <div className="viewer-content">
          <pre className="viewer-code">{content}</pre>
        </div>
      )}

      {kind === 'binary' && (
        <div className="viewer-content">
          <div className="asset-card">
            <div className="asset-card-icon" style={{ color: catStyle.color }}>
              {ASSET_ICONS[category] || '📁'}
            </div>
            <div className="asset-card-name">{filePath.split('/').pop()}</div>
            <div className="asset-card-type" style={{ color: catStyle.color }}>
              {(category || extOf(filePath) || 'file').toUpperCase()}
            </div>
            {nodeInfo?.description && nodeInfo.description !== '(no frontmatter)' && (
              <div className="asset-card-desc">{nodeInfo.description}</div>
            )}
            <div className="asset-card-path">{filePath}</div>
            {/* Show which nodes reference this asset */}
            {(() => {
              const referencedBy = graphData?.edges
                ?.filter(e => e.target === filePath || e.target?.id === filePath)
                ?.map(e => typeof e.source === 'string' ? e.source : e.source?.id)
                ?.filter(Boolean) || [];
              if (referencedBy.length === 0) return null;
              return (
                <div className="asset-card-refs">
                  <div className="asset-card-refs-title">Referenced by:</div>
                  {referencedBy.map((ref, i) => (
                    <span key={i} className="viewer-ref-badge" onClick={() => selectFile(ref)}>
                      {ref.split('/').pop()?.replace('.md', '')}
                    </span>
                  ))}
                </div>
              );
            })()}
            <button
              className="btn asset-card-open"
              onClick={() => openInExplorer(filePath)}
              style={{ background: catStyle.color, color: '#fff', marginTop: 16 }}
            >
              Open in Explorer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
