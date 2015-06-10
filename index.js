'use strict';

var Promise = require('bluebird');

/**
 * Return _default if a field is undefined or null.
 */
var getOpt = function(option, _default) {
  if (option === undefined || option === null) {
    return _default;
  } else {
    return option;
  }
};

/**
 * Return a shallow array copy of `array`
 */
var copyArray = function(array) {
  var len = array.length;
  var copy = [];

  for (var i = 0; i < len; i++) {
    copy[i] = array[i];
  }

  return copy;
};

/**
 * Check if the thrown error matches a user provided error.
 */
var isMatchingError = function(err, userErrors) {
  for (var i = 0; i < userErrors.length; i++) {
    if (err instanceof userErrors[i]) {
      return true;
    }
  }

  return false;
};

var retryRec;

/**
 * Called if the wrapped function throws an error
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

  // Try the wrapped function again in `context.timeout` milliseconds
  return Promise.delay(delay).then(function() {
    return retryRec(context);
  });
};

/**
 * Recursively evalutates the wrapped function until it throws a
 * non-matching error, resolves, or runs out of retry attempts.
 *
 * @param {Object} context the context the wrapped function is called in
 * @param {Function} context.fn the wrapped function
 * @param {*[]} context.args the arguments the wrapped function was called with
 * @param {*} context.fnThis the `this` originally bound to `fn`
 * @param {Number} context.attempts # of attempts made to retry the function
 * @param {Number} context.retries # of times to retry the wrapped function
 * @param {Number} context.timeout time to wait between retries (in milliseconds)
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
    // wrap the function eval in a try catch to deal with synchronous functions
    try {
      result = context.fn.apply(context.fnThis, context.args);
    } catch (err) {
      return onError(context, err);
    }

    return Promise.resolve(result).catch(function(err) {
      return onError(context, err);
    });
  }
};

/**
 * Retry module setup function. Takes an options object that configures the
 * default retry options.
 *
 * @param {Options} [options] Configuration object
 * @param {Number} [options.retries=3] # of times to retry a wrapped function
 * @param {Number} [options.timeout=300] amount of time to wait between retries
 * @param {Number} [options.factor=2] the exponential factor to scale the
 *   timeout by every retry iteration. For example: with a factor of 2 and a
 *   timeout of 100 ms, the first retry will fire after 100 ms, the second
 *   after 200 ms, the third after 400 ms, etc.... The formula used to
 *   calculate the delay between each retry:
 *   ```timeout * Math.pow(factor, attempts)```
 * @param {Error[]} [options.errors=[Error]] an array of user provided errors
 *   that trigger a retry when caught
 *
 * @return {Function} A decorator function to wrap a function you want to retry
 */
var retryModule = function(options) {
  var _options = options || {};
  _options.retries = getOpt(_options.retries, 3);
  _options.timeout = getOpt(_options.timeout, 300);
  _options.factor = getOpt(_options.factor, 2);
  _options.errors = getOpt(_options.errors, [Error]);

  /**
   * Retry function decorator. Allows configuration on a function by function
   * basis.
   */
  var retryFn = function(fn, _innerOptions) {
    var innerOptions = _innerOptions || {};

    var retries = getOpt(innerOptions.retries, _options.retries);
    var timeout = getOpt(innerOptions.timeout, _options.timeout);
    var factor = getOpt(innerOptions.factor, _options.factor);
    var errors = getOpt(innerOptions.errors, _options.errors);

    // Wrapper function. Returned in place of the passed in function
    var doRetry = function() {
      var args = copyArray(arguments);

      var context = {
        fn: fn,
        args: args,
        // Make sure `this` is preserved when executing the wrapped function
        fnThis: getOpt(this, null),
        attempts: 0,
        retries: retries,
        timeout: timeout,
        factor: factor,
        errors: errors,
      };

      return retryRec(context);
    };

    return doRetry;
  };

  return retryFn;
};

module.exports = retryModule;
