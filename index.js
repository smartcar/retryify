'use strict';

/**
 * Return _default if a field is undefined or null.
 *
 * @private
 */
const getOpt = function(option, _default) {
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
const isMatchingError = function(err, userErrors) {
  return userErrors.some((userError) => err instanceof userError);
};

/**
 * Evaluates the wrapped function until it throws a non-matching error,
 * resolves, or runs out of retry attempts.
 *
 * @private
 *
 * @param {Object} context the context the wrapped function is called in
 * @param {Function} context.fn the wrapped function
 * @param {...*} context.args the arguments the wrapped function was called with
 * @param {*} context.fnThis the `this` originally bound to `fn`
 * @param {Number} context.retries # of times to retry the wrapped function
 * @param {Number} context.timeout time to wait between retries (in ms)
 * @param {Number} context.factor the exponential scaling factor
 * @param {Error[]} context.errors errors that when caught, trigger a retry
 *
 * @return {Promise} a Promise for whatever the wrapped function eventually
 *   resolves to.
 */
const execute = async function(context) {
  /**
   * The first attempt of executing the function shouldn't count as a "retry"
   * since it is the initial execution. Successive executions of the function
   * should count as actual "retries".
   *
   * In order to achieve this, retries is incremented at the end of each loop
   * iteration as opposed to the beginning of each loop iteration.
   */
  let retries = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    /* eslint-disable no-await-in-loop */

    try {
      return await context.fn.apply(context.fnThis, context.args);
    } catch (err) {
      if (retries === context.retries) {
        throw err;
      }

      if (!isMatchingError(err, context.errors)) {
        throw err;
      }

      /**
       * The first execution of the function doesn't count as a retry,
       * but should count as an attempt
       */
      const attempts = retries + 1;

      /**
       * The first "delay" should be equal to "timeout", every successive delay
       * should be some multiple of timeout.
       *
       * In order to achieve this, we use "retries" as the exponent rather than
       * "attempts".
       */
      const delay = context.timeout * Math.pow(context.factor, retries);

      const msg = `retrying function ${context.fnName} in ${delay} ms : attempts: ${attempts}`;
      context.log(msg);

      await new Promise((resolve) => setTimeout(resolve, delay));

      retries += 1;
    }
    /* eslint-enable */
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
const retryify = function(options) {
  if (typeof options === 'function') {
    throw new TypeError('options object expected but was passed a function');
  }

  const _options = options || {};
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
  const retryWrapper = function(innerOptions, fn) {
    if (innerOptions instanceof Function) {
      fn = innerOptions;
      innerOptions = null;
    }

    const _innerOptions = innerOptions || {};

    const retries = getOpt(_innerOptions.retries, _options.retries);
    const timeout = getOpt(_innerOptions.timeout, _options.timeout);
    const factor = getOpt(_innerOptions.factor, _options.factor);
    let errors = getOpt(_innerOptions.errors, _options.errors);
    const log = getOpt(_innerOptions.log, _options.log);

    if (!(errors instanceof Array)) {
      errors = [errors];
    }

    // Wrapper function. Returned in place of the passed in function
    const doRetry = function(...args) {
      const context = {
        fn,
        fnName: fn.name || '<Anonymous>',
        // Make sure `this` is preserved when executing the wrapped function
        fnThis: this,
        args,
        retries,
        timeout,
        factor,
        errors,
        log,
      };

      return execute(context);
    };

    return doRetry;
  };

  return retryWrapper;
};

module.exports = retryify;
