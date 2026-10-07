'use strict';

const { z } = require('zod');
const authService = require('../services/auth.service');
const { ROLES } = require('../middleware/auth');

/** Request validation. Bad input is rejected before it reaches the database. */

const loginSchema = z.object({
  email: z.string().email('A valid email address is required.'),
  password: z.string().min(1, 'Password is required.'),
});

const createUserSchema = z.object({
  fullName: z.string().min(2, 'Full name is required.'),
  email: z.string().email('A valid email address is required.'),
  password: z.string().min(8, 'Password must be at least 8 characters.'),
  role: z.enum([ROLES.SUPERVISOR, ROLES.MANAGER, ROLES.ADMIN]),
  phone: z.string().optional(),
});

function firstIssue(result) {
  return result.error.issues[0]?.message || 'Invalid request.';
}

async function login(req, res, next) {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: firstIssue(parsed) });
  }

  try {
    const result = await authService.login(parsed.data);

    // Same message whether the email is unknown or the password is wrong.
    if (!result) {
      return res.status(401).json({ error: 'Incorrect email or password.' });
    }

    return res.json(result);
  } catch (err) {
    return next(err);
  }
}

/** Administrators create accounts; there is no public sign-up. */
async function createUser(req, res, next) {
  const parsed = createUserSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: firstIssue(parsed) });
  }

  try {
    const user = await authService.createUser(parsed.data);
    return res.status(201).json({ user });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'An account with that email already exists.' });
    }
    return next(err);
  }
}

/** Who am I? Used by the frontend to restore a session on load. */
async function me(req, res) {
  return res.json({ user: req.user });
}

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Your current password is required.'),
  newPassword: z.string().min(8, 'The new password must be at least 8 characters.'),
});

/**
 * Changing your own password. There is no endpoint for changing anyone
 * else's: an administrator who has lost access to an account creates a
 * replacement rather than quietly taking over an existing one.
 */
async function changePassword(req, res, next) {
  const parsed = changePasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: firstIssue(parsed) });
  }

  const { currentPassword, newPassword } = parsed.data;

  try {
    const result = await authService.changePassword(req.user.id, currentPassword, newPassword);

    if (!result.ok) {
      if (result.reason === 'wrong_password') {
        return res.status(401).json({ error: 'Your current password is not correct.' });
      }
      if (result.reason === 'unchanged') {
        return res.status(400).json({ error: 'The new password must be different.' });
      }
      return res.status(404).json({ error: 'Account not found.' });
    }

    // A fresh token, because the change just invalidated the old one.
    return res.json({ user: result.user, token: result.token });
  } catch (err) {
    return next(err);
  }
}

module.exports = { login, createUser, me, changePassword };
