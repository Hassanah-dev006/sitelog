'use strict';

const crypto = require('crypto');
const readline = require('readline');

/**
 * Command-line parsing and hidden password entry, shared by the scripts in
 * this folder so the two cannot drift apart.
 */

const FLAGS = new Set(['ask']);

/**
 * Parses the command line, joining every word up to the next --option.
 *
 * This means `--name Hassanat Ajoke Bello` works whether or not the name was
 * quoted. Taking only the word after --name would have quietly created an
 * account called "Hassanat", which is the kind of mistake nobody notices
 * until it is on screen in front of the whole department.
 */
function parseArgs(argv) {
  const args = { site: [] };

  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (!key.startsWith('--')) continue;

    const name = key.slice(2);

    if (FLAGS.has(name)) {
      args[name] = true;
      continue;
    }

    const words = [];
    let j = i + 1;
    while (j < argv.length && !argv[j].startsWith('--')) {
      words.push(argv[j]);
      j += 1;
    }

    if (words.length === 0) {
      console.error(`Missing value for --${name}`);
      process.exit(1);
    }

    // --site repeats, and its meaning depends on the script: an id for
    // create-user, a name for create-project. Keep the raw text and let each
    // script interpret it — converting here turned "Main Site" into NaN.
    if (name === 'site') args.site.push(words.join(' '));
    else args[name] = words.join(' ');

    i = j - 1;
  }

  return args;
}

/**
 * Reads lines from stdin without echoing them.
 *
 * Lines are queued as they arrive rather than read one `question` at a time.
 * When input is piped, both lines can land before the second prompt is even
 * issued — a `question`-per-prompt approach silently drops the second and
 * leaves the caller waiting on input that already went past.
 */
function lineReader() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  // Suppress the echo so nothing typed appears on screen.
  rl._writeToOutput = () => {};

  const queue = [];
  const waiting = [];
  let closed = false;

  rl.on('line', (line) => {
    process.stdout.write('\n');
    if (waiting.length) waiting.shift()(line);
    else queue.push(line);
  });

  rl.on('close', () => {
    closed = true;
    while (waiting.length) waiting.shift()(null);
  });

  return {
    ask(prompt) {
      process.stdout.write(prompt);
      if (queue.length) return Promise.resolve(queue.shift());
      if (closed) return Promise.resolve(null);
      return new Promise((resolve) => waiting.push(resolve));
    },
    close: () => rl.close(),
  };
}

/** Prompts twice and returns the password, or null if it was not set. */
async function askPasswordTwice() {
  const reader = lineReader();

  try {
    const first = await reader.ask('  Password (not shown): ');

    if (first === null) {
      console.error('\nCancelled. Nothing was changed.');
      process.exitCode = 1;
      return null;
    }

    if (first.length < 8) {
      console.error('\nThat is shorter than 8 characters. Nothing was changed.');
      process.exitCode = 1;
      return null;
    }

    const again = await reader.ask('  Type it again:       ');

    if (again === null) {
      console.error('\nCancelled. Nothing was changed.');
      process.exitCode = 1;
      return null;
    }

    if (first !== again) {
      console.error('\nThose did not match. Nothing was changed.');
      process.exitCode = 1;
      return null;
    }

    return first;
  } finally {
    reader.close();
  }
}

/** Readable but strong: no ambiguous characters to misread over the phone. */
function generatePassword() {
  const alphabet = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(16);
  let out = '';
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return `${out.slice(0, 5)}-${out.slice(5, 10)}-${out.slice(10, 16)}`;
}

module.exports = { parseArgs, lineReader, askPasswordTwice, generatePassword };
