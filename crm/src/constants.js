'use strict';

const ROLES = ['admin', 'project_manager', 'supervisor'];
const ROLE_LABELS = { admin: 'Admin global', project_manager: 'Project manager', supervisor: 'Encadrant industriel' };

const DOMAINS = ['DevOps', 'AI & Agents', 'Cybersecurity', 'Data Analysis', 'Full Stack', 'Cloud'];
const LEVELS = ['Débutant', 'Intermédiaire', 'Avancé'];
const STUDENT_STATUSES = ['Étudiant(e)', 'Jeune diplômé(e)', 'En poste', 'En reconversion', "En recherche d'emploi"];
const STAGES = ['lead', 'contacted', 'lab_scheduled', 'active', 'completed', 'dropped'];
const STAGE_LABELS = {
  lead: 'Nouveau lead', contacted: 'Contacté', lab_scheduled: 'Lab planifié',
  active: 'En résidence', completed: 'Terminé', dropped: 'Abandon',
};
const SUBJECT_STATUSES = ['draft', 'open', 'in_progress', 'completed', 'archived'];
const SESSION_STATUSES = ['planned', 'done', 'cancelled'];
const SESSION_MODES = ['onsite', 'online'];
const ATTENDANCE_STATUSES = ['present', 'absent', 'late', 'excused'];
const ACTIVITY_TYPES = ['note', 'call', 'whatsapp', 'email', 'meeting'];
const SOURCES = ['landing', 'whatsapp', 'referral', 'school', 'linkedin', 'import', 'other'];

module.exports = {
  ROLES, ROLE_LABELS, DOMAINS, LEVELS, STUDENT_STATUSES, STAGES, STAGE_LABELS,
  SUBJECT_STATUSES, SESSION_STATUSES, SESSION_MODES, ATTENDANCE_STATUSES, ACTIVITY_TYPES, SOURCES,
};
