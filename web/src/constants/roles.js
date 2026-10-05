/** Mirrors src/constants/roles.js on the API. Keep the two in step. */
export const ROLES = {
  SUPERVISOR: 'site_supervisor',
  MANAGER: 'project_manager',
  ADMIN: 'administrator',
};

export const ROLE_LABELS = {
  [ROLES.SUPERVISOR]: 'Site Supervisor',
  [ROLES.MANAGER]: 'Project Manager',
  [ROLES.ADMIN]: 'Administrator',
};
