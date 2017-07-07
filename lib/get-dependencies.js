'use strict';
const spawn = require('./spawn');
const createOptions = require('./create-options');
const child_process = require('child_process');
const path = require('path');

function getDependencies(context, next) {
  if (context.module.clone_repo == null) {
    return next(null, context);
  }

  const options =
    createOptions(
      path.join(context.path, context.module.name), context);
  context.emit('data', 'info', context.module.name + ' git:',
      'update submodules');

  // Default timeout to 10 minutes if not provided
  const timeout = setTimeout(cleanup, context.options.timeoutLength
        || 1000 * 60 * 10);

  function cleanup() {
    clearTimeout(timeout);
    bailed = true;
    context.module.flaky = true;
    context.emit('data', 'error', context.module.name + ' npm:',
        'npm-install Timed Out');
    proc.kill();
    return next(Error('Install Timed Out'));
  }

  let bailed = false;
  var proc = spawn('git', ['submodule', 'update', '--init'], options);
  proc.stderr.on('data', function (chunk) {
    context.testError.append(chunk);
    if (context.module.stripAnsi) {
      chunk = stripAnsi(chunk.toString());
      chunk = chunk.replace(/\r/g, '\n');
    }
    context.emit('data', 'warn', context.module.name + ' git:',
      chunk.toString());
  });

  proc.stdout.on('data', function (chunk) {
    context.testOutput.append(chunk);
    if (context.module.stripAnsi) {
      chunk = stripAnsi(chunk.toString());
      chunk = chunk.replace(/\r/g, '\n');
    }
    context.emit('data', 'verbose', context.module.name + ' git:',
      chunk.toString());
  });

  proc.on('error', function() {
    bailed = true;
    clearTimeout(timeout);
    return next(new Error('Fail to get submodules'));
  });

  proc.on('close', function(code) {
    if (bailed) return;
    clearTimeout(timeout);
    if (code > 0) {
      return next(Error('Fail to get submodules'));
    }
    context.emit('data', 'info', context.module.name + ' git:',
        'git submodule update finish');
    return next(null, context);
  });
}

module.exports = getDependencies;
