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
 * Evaluates the wrapped function until it throws a non-matching error,
 * resolves, or runs out of retry attempts.
 *
 * @private
 *
 * @param {Object} context the context the wrapped function is called in
 * @param {Function} context.fn the wrapped function
 * @param {*} context.fnThis the `this` originally bound to `fn`
 * @param {Number} context.retries # of times to retry the wrapped function
 * @param {Number} context.initialDelay time to wait before making attempts
 * @param {Number} context.timeout time to wait between retries (in ms)
 * @param {Number} context.factor the exponential scaling factor
 * @param {Function} context.shouldRetry - Invoked with the thrown error,
 * retryify will retry if this method returns true.
 * @param {Function} context.log logging function that takes a message as input
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
   *
   * Setting an `initialDelay` pauses execution before the loop
   */
  let retries = 0;

  // Initial Delay
  if (context.initialDelay !== 0) {
    await new Promise((resolve) => setTimeout(resolve, context.initialDelay));
  }

  // eslint-disable-next-line no-constant-condition
  while (true) {
    /* eslint-disable no-await-in-loop */

    try {
      return await context.fn.apply(context.fnThis, context.args);
    } catch (err) {
      if (retries === context.retries) {
        throw err;
      }

      if (!context.shouldRetry(err)) {
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

      /* eslint-disable-next-line max-len*/
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
 * @property {Number} [options.initialDelay=0] Amount of time (ms) to wait before
 * any function attempts
 * @property {Number} [options.timeout=300] Amount of time (ms) to wait between
 * retries
 * @property {Number} [options.factor=2] The exponential factor to scale the
 *   timeout by every retry iteration. For example: with a factor of 2 and a
 *   timeout of 100 ms, the first retry will fire after 100 ms, the second
 *   after 200 ms, the third after 400 ms, etc.... The formula used to
 *   calculate the delay between each retry:
 *   ```timeout * Math.pow(factor, attempts)```
 * @property {Function} [options.shouldRetry=() => true] - Invoked with the
 * thrown error, retryify will retry if this method returns true.
 * @property {Function} [options.log] Logging function that takes a message as input
 */

/**
 * Retry module setup function. Takes an options object that configures the
 * default retry options.
 *
 * @param {Options} [options={}] Optional configuration object
 * @throws TypeError when function is passed instead of options object.
 * To use retryify it first must be "constructed" by passing in an options
 * object and the returned function is what is supposed to take the function
 * to retry.
 *
 * @return {Function} {@link retryWrapper} A decorator function that wraps a
 *   a function to turn it into a retry-enabled function.
 */
const retryify = function(options = {}) {
  if (typeof options === 'function') {
    throw new TypeError('options object expected but was passed a function');
  }

  options.retries = getOpt(options.retries, 3);
  options.initialDelay = getOpt(options.initialDelay, 0);
  options.timeout = getOpt(options.timeout, 300);
  options.factor = getOpt(options.factor, 2);
  options.log = getOpt(options.log, function() {
    /* empty */
  });
  options.shouldRetry = getOpt(options.shouldRetry, () => true);

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
      innerOptions = {};
    }

    const retries = getOpt(innerOptions.retries, options.retries);
    const initialDelay = getOpt(
      innerOptions.initialDelay,
      options.initialDelay,
    );
    const timeout = getOpt(innerOptions.timeout, options.timeout);
    const factor = getOpt(innerOptions.factor, options.factor);
    const log = getOpt(innerOptions.log, options.log);
    const shouldRetry = getOpt(innerOptions.shouldRetry, options.shouldRetry);

    // Wrapper function. Returned in place of the passed in function
    const doRetry = function(...args) {
      const context = {
        fn,
        fnName: fn.name || '<Anonymous>',
        // Make sure `this` is preserved when executing the wrapped function
        fnThis: this,
        args,
        retries,
        initialDelay,
        timeout,
        factor,
        shouldRetry,
        log,
      };

      return execute(context);
    };

    return doRetry;
  };

  return retryWrapper;
};

retryify.retryify = retryify;

module.exports = retryify;
