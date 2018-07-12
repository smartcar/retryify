'use strict';

var Promise = require('bluebird');

/**
 * Return _default if a field is undefined or null.
 *
 * @private
 */
var getOpt = function(option, _default) {
  if (option === undefined || option === null) {
    return _default;
  } else {
    return option;
  }
};

/**
 * Check if the thrown error matches a user provided error.
 *
 * @private
 */
var isMatchingError = function(err, userErrors) {
  for (var i = 0; i < userErrors.length; i++) {
    if (err instanceof userErrors[i]) {
      return true;
    }
  }

  return false;
};

// Declare ahead. retryRec and onError are mutually recursive.
var retryRec;

/**
 * Called if the wrapped function throws an error
 *
 * @private
 *
 * @param {Object} context the context the wrapped function is called in
 * @param {Error} err the error caught while evaluating the wrapped function
 *
 * @return {Promise} a delayed Promise that retries the wrapped function if a
 *   matching error is found. Otherwise, a rejected Promise.
 */
var onError = function(context, err) {
  if (!isMatchingError(err, context.errors)) {
    // doens't match any user errors. reject the error down the chain
    return Promise.reject(err);
  }

  var delay = context.timeout * Math.pow(context.factor, context.attempts);

  // update the retry state
  context.attempts += 1;

  const name = context.fnName ? context.fnName : '<Anonymous>';
  // eslint-disable-next-line max-len
  const msg = `retrying function ${name} in ${delay} ms : attempts: ${
    context.attempts
  }`;

  context.log(msg);

  // Try the wrapped function again in `context.timeout` milliseconds
  return Promise.delay(delay).then(function() {
    return retryRec(context);
  });
};

/**
 * Recursively evalutates the wrapped function until it throws a
 * non-matching error, resolves, or runs out of retry attempts.
 *
 * @private
 *
 * @param {Object} context the context the wrapped function is called in
 * @param {Function} context.fn the wrapped function
 * @param {...*} context.args the arguments the wrapped function was called with
 * @param {*} context.fnThis the `this` originally bound to `fn`
 * @param {Number} context.attempts # of attempts made to retry the function
 * @param {Number} context.retries # of times to retry the wrapped function
 * @param {Number} context.timeout time to wait between retries (in ms)
 * @param {Number} context.factor the exponential scaling factor
 * @param {Error[]} context.errors errors that when caught, trigger a retry
 *
 * @return {Promise} a Promise for whatever the wrapped function eventually
 *   resolves to.
 */
retryRec = function(context) {
  var result;

  // Base case: last attempt
  if (context.attempts === context.retries) {
    result = context.fn.apply(context.fnThis, context.args);
    return Promise.resolve(result);
  } else {
    // try the function. if we catch anything, wait, then retry
    result = context.fn.apply(context.fnThis, context.args);
    return Promise.resolve(result).catch(function(err) {
      return onError(context, err);
    });
  }
};

/**
 * @typedef Options
 * @type {Object}
 * @property {Number} [options.retries=3] Number of times to retry a wrapped
 *   function
 * @property {Number} [options.timeout=300] Amount of time to wait between
 * retries
 * @property {Number} [options.factor=2] The exponential factor to scale the
 *   timeout by every retry iteration. For example: with a factor of 2 and a
 *   timeout of 100 ms, the first retry will fire after 100 ms, the second
 *   after 200 ms, the third after 400 ms, etc.... The formula used to
 *   calculate the delay between each retry:
 *   ```timeout * Math.pow(factor, attempts)```
 * @property {(Error|Error[])} [options.errors=Error] A single Error or an
 *   array Errors that trigger a retry when caught
 * @property {Function} [options.log] Logging function that takes a message as
 */

/**
 * Retry module setup function. Takes an options object that configures the
 * default retry options.
 *
 * @param {Options} [options] Optional configuration object
 * @throws TypeError when function is passed instead of options object.
 * To use retryify it first must be "constructed" by passing in an options
 * object and the returned function is what is supposed to take the function
 * to retry.
 *
 * @return {Function} {@link retryWrapper} A decorator function that wraps a
 *   a function to turn it into a retry-enabled function.
 */
var retryify = function(options) {
  if (typeof options === 'function') {
    throw new TypeError('options object expected but was passed a function');
  }

  var _options = options || {};
  _options.retries = getOpt(_options.retries, 3);
  _options.timeout = getOpt(_options.timeout, 300);
  _options.factor = getOpt(_options.factor, 2);
  _options.errors = getOpt(_options.errors, Error);
  _options.log = getOpt(_options.log, function() {
    /* empty */
  });

  /**
   * retryify function decorator. Allows configuration on a function by function
   * basis.
   *
   * @param {Options} [innerOptions] Optional configuration object. Same
   *   format as above.
   * @param {Function} fn The function to wrap. Will retry the function if any
   *   matching errors are caught.
   *
   * @return {Function} The wrapped function.
   */
  var retryWrapper = function(innerOptions, fn) {
    if (innerOptions instanceof Function) {
      fn = innerOptions;
      innerOptions = null;
    }

    var _innerOptions = innerOptions || {};

    var retries = getOpt(_innerOptions.retries, _options.retries);
    var timeout = getOpt(_innerOptions.timeout, _options.timeout);
    var factor = getOpt(_innerOptions.factor, _options.factor);
    var errors = getOpt(_innerOptions.errors, _options.errors);
    var log = getOpt(_innerOptions.log, _options.log);

    if (!(errors instanceof Array)) {
      errors = [errors];
    }

    // Wrapper function. Returned in place of the passed in function
    var doRetry = function() {
      // do an inline copy to avoid leaking the arguments object.
      // https://github.com/petkaantonov/bluebird/wiki/Optimization-killers#32-leaking-arguments
      var args = new Array(arguments.length);
      for (var i = 0; i < args.length; ++i) {
        args[i] = arguments[i]; // eslint-disable-line prefer-rest-params
      }

      var context = {
        fn: Promise.method(fn),
        fnName: fn.name,
        // Make sure `this` is preserved when executing the wrapped function
        fnThis: getOpt(this, null),
        args,
        attempts: 0,
        retries,
        timeout,
        factor,
        errors,
        log,
      };

      return retryRec(context);
    };

    return doRetry;
  };

  return retryWrapper;
};

module.exports = retryify;
