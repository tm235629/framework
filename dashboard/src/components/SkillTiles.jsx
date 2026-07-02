import React, { useState, useEffect } from 'react';
import { useSkills } from '../hooks/useSkills.js';
import { useDashboard } from '../context/DashboardContext.jsx';

// Skills inventory: view, open/edit (in the right-hand viewer), and create.
// Delete + project-tagging were removed 2026-06-21 — deleting or restructuring a
// skill is done with an agent, not from this UI.
export default function SkillTiles() {
  const { skills, fetchSkills, createSkill } = useSkills();
  const { selectFile, refreshAll } = useDashboard();
  const [newName, setNewName] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    fetchSkills();
  }, [fetchSkills]);

  const handleCreate = async () => {
    if (await createSkill(newName)) {
      setNewName('');
      setShowCreate(false);
      refreshAll();
    }
  };

  return (
    <div className="skill-tiles">
      <div className="skill-tiles-header">
        <h3>Skills</h3>
        <button className="btn btn-sm btn-primary" onClick={() => setShowCreate(!showCreate)}>+ New</button>
      </div>

      {showCreate && (
        <div className="create-form-inline">
          <input
            type="text"
            placeholder="skill-name"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
            autoFocus
          />
          <button className="btn btn-sm btn-primary" onClick={handleCreate}>Create</button>
          <button className="btn btn-sm" onClick={() => setShowCreate(false)}>Cancel</button>
        </div>
      )}

      <div className="skill-tiles-grid">
        {skills.map(skill => (
          <div
            key={skill.name}
            className="skill-tile"
            onClick={() => selectFile(skill.path)}
          >
            <div className="skill-tile-name">/{skill.name}</div>
            <div className="skill-tile-desc">{skill.description || 'No description'}</div>

            <div className="skill-tile-actions" onClick={e => e.stopPropagation()}>
              <button className="btn btn-xs" onClick={() => selectFile(skill.path)}>Open</button>
            </div>
          </div>
        ))}

        <div className="skill-tile skill-tile--create" onClick={() => setShowCreate(true)}>
          + New Skill
        </div>
      </div>
    </div>
  );
}
