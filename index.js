/**
 * Quickly and easily wrap functions to make them retry when they fail. Uses
 * bluebird promises for maximum convenience!
 *
 * ### Installation
 *
 *     $ npm install --save smartcar/retry
 *
 *
 * @module retry
 *
 * @example
 * // create a new retry wrapper with some custom options set.
 * var retry = require('retry')({
 *   retries: 5,
 *   timeout: 1000,
 *   factor: 2,
 *   errors: [RequestError],
 * });
 *
 * // promisified request library
 * var request = require('request-promise');
 *
 * // get will now retry each time it catches a RequestError, it retries 5
 * // times, or the request finally resolves successfully.
 * var get = retry(function(url) {
 *   return request(url);
 * });
 *
 * // send the request, but retry if it fails.
 * get('http://google.com')
 *   .then(...)
 *   .catch(...);
 *
 */

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
 * @param {Options} [options] Optional configuration object
 * @param {Number} [options.retries=3] Number of times to retry a wrapped
 *   function
 * @param {Number} [options.timeout=300] Amount of time to wait between retries
 * @param {Number} [options.factor=2] The exponential factor to scale the
 *   timeout by every retry iteration. For example: with a factor of 2 and a
 *   timeout of 100 ms, the first retry will fire after 100 ms, the second
 *   after 200 ms, the third after 400 ms, etc.... The formula used to
 *   calculate the delay between each retry:
 *   ```timeout * Math.pow(factor, attempts)```
 * @param {(Error|Error[])} [options.errors=Error] A single Error or an
 *   array Errors that trigger a retry when caught
 *
 * @return {Function} {@link retryWrapper} A decorator function that wraps a
 *   a function to turn it into a retry-enabled function.
 */
var retry = function(options) {
  var _options = options || {};
  _options.retries = getOpt(_options.retries, 3);
  _options.timeout = getOpt(_options.timeout, 300);
  _options.factor = getOpt(_options.factor, 2);
  _options.errors = getOpt(_options.errors, Error);

  /**
   * Retry function decorator. Allows configuration on a function by function
   * basis.
   *
   * @param {Object} [innerOptions] Optional configuration object. Same
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

    if (!(errors instanceof Array)) {
      errors = [errors];
    }

    // Wrapper function. Returned in place of the passed in function
    var doRetry = function() {
      var args = arguments;

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

  return retryWrapper;
};

module.exports = retry;
