import { useState, useCallback } from 'react';

// Skill list + create. (Delete / backups / project-tagging were removed 2026-06-21 —
// the Skills tab is a read/manage inventory; deletion or restructuring is done with an agent.)
export function useSkills() {
  const [skills, setSkills] = useState([]);

  const fetchSkills = useCallback(async () => {
    try {
      const res = await fetch('/api/skills');
      const data = await res.json();
      setSkills(data);
      return data;
    } catch (err) {
      console.error('Failed to fetch skills:', err);
      return [];
    }
  }, []);

  const createSkill = useCallback(async (name) => {
    if (!name?.trim()) return false;
    try {
      const res = await fetch('/api/skills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      });
      if (res.ok) {
        await fetchSkills();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, [fetchSkills]);

  return {
    skills,
    fetchSkills,
    createSkill,
  };
}
