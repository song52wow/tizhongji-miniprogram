const test = require('node:test');
const assert = require('node:assert');

function restoreCacheEntry(path, entry) {
  if (entry) {
    require.cache[path] = entry;
    return;
  }
  delete require.cache[path];
}

test('App onLaunch sets up version updates before login', () => {
  const appPath = require.resolve('../src/app.js');
  const authPath = require.resolve('../src/services/auth.js');
  const updatePath = require.resolve('../src/services/update.js');
  const originalApp = global.App;
  const originalAppModule = require.cache[appPath];
  const originalAuthModule = require.cache[authPath];
  const originalUpdateModule = require.cache[updatePath];
  const calls = [];
  let appConfig;

  global.App = (config) => {
    appConfig = config;
  };
  require.cache[authPath] = {
    exports: {
      ensureLoggedIn() {
        calls.push('login');
        return Promise.resolve();
      },
    },
  };
  require.cache[updatePath] = {
    exports: {
      setupVersionUpdate() {
        calls.push('update');
      },
    },
  };
  delete require.cache[appPath];

  try {
    require(appPath);
    appConfig.onLaunch();
    assert.deepStrictEqual(calls, ['update', 'login']);
  } finally {
    global.App = originalApp;
    restoreCacheEntry(appPath, originalAppModule);
    restoreCacheEntry(authPath, originalAuthModule);
    restoreCacheEntry(updatePath, originalUpdateModule);
  }
});