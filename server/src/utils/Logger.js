/**
 * Structured logger for ApolloGame server.
 * Outputs JSON-formatted logs with level, module, and timestamp.
 */
const LOG_LEVELS = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 };
const CURRENT_LEVEL = LOG_LEVELS[process.env.LOG_LEVEL || 'DEBUG'];

function _log(level, module, message, data = null) {
  if (LOG_LEVELS[level] < CURRENT_LEVEL) return;
  const entry = {
    ts: new Date().toISOString(),
    level,
    module,
    msg: message,
  };
  if (data !== null && data !== undefined) {
    entry.data = data;
  }
  const fn = level === 'ERROR' ? console.error : level === 'WARN' ? console.warn : console.log;
  fn(JSON.stringify(entry));
}

function createLogger(module) {
  return {
    debug: (msg, data) => _log('DEBUG', module, msg, data),
    info: (msg, data) => _log('INFO', module, msg, data),
    warn: (msg, data) => _log('WARN', module, msg, data),
    error: (msg, data) => _log('ERROR', module, msg, data),
  };
}

module.exports = { createLogger };
