'use strict';

/**
 * The three roles in the system.
 *
 * Kept in its own module so services can use them without importing Express
 * middleware, which would couple business logic to the HTTP layer.
 */
const ROLES = Object.freeze({
  SUPERVISOR: 'site_supervisor',
  MANAGER: 'project_manager',
  ADMIN: 'administrator',
});

const ALL_ROLES = Object.freeze(Object.values(ROLES));

module.exports = { ROLES, ALL_ROLES };
