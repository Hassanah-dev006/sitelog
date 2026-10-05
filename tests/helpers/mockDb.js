'use strict';

/**
 * Shared database mock.
 *
 * withTransaction hands the callback a client whose query is the same mock,
 * so a test can queue transaction statements the same way as plain ones.
 */
function buildMock() {
  const query = jest.fn();
  return {
    pool: { end: jest.fn() },
    query,
    withTransaction: jest.fn(async (callback) => callback({ query })),
  };
}

module.exports = { buildMock };
