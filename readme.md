# retryify [![NPM version][npm-image]][npm-url] [![Build Status][ci-image]][ci-url] [![Coverage Status][coverage-image]][coverage-url] [![Greenkeeper][gk-image]][gk-url]

Quickly and easily wrap functions to make them retry when they fail. Uses
bluebird promises for maximum convenience!

## Installation

```bash
$ npm install retryify
```

## Example
```js
// create a new retryify wrapper with some options set.
const retryify = require('retryify')({
  retries: 5,
  timeout: 1000,
  factor: 2,
  errors: [RequestError, StatusCodeError],
  log: function(msg) { console.log(msg); },
});

// promisified request library
const request = require('request-promise');

// get will now retry each time it catches a RequestError or a
// StatusCodeError, it retries 5 times, or the request finally resolves
// successfully.
const get = retryify(function(url) {
  return request(url);
});

// or, add some custom options for this specific function
const post = retryify({
  retries: 10
}, function(url, data) {
  return request({
    uri: url,
    method: 'POST',
  });
});

// send the request, but retry if it fails.
get('http://google.com')
  .then(...)
  .catch(...);
```

<a name="retryify"></a>

## retryify([options]) ⇒ <code>function</code>
Retry module setup function. Takes an options object that configures the
default retry options.

**Kind**: global function
<br>**Returns**: <code>function</code> - [retryWrapper](retryWrapper) A decorator function that wraps a
  a function to turn it into a retry-enabled function.
<br>**Throws**:

- TypeError when function is passed instead of options object.
To use retryify it first must be "constructed" by passing in an options
object and the returned function is what is supposed to take the function
to retry.


| Param | Type | Description |
| --- | --- | --- |
| [options] | [<code>Options</code>](#Options) | Optional configuration object |

<a name="retryify..retryWrapper"></a>

### retryify~retryWrapper([innerOptions], fn) ⇒ <code>function</code>
retryify function decorator. Allows configuration on a function by function
basis.

**Kind**: inner method of [<code>retryify</code>](#retryify)
<br>**Returns**: <code>function</code> - The wrapped function.

| Param | Type | Description |
| --- | --- | --- |
| [innerOptions] | [<code>Options</code>](#Options) | Optional configuration object. Same   format as above. |
| fn | <code>function</code> | The function to wrap. Will retry the function if any   matching errors are caught. |

<a name="Options"></a>

## Options : <code>Object</code>
**Kind**: global typedef
<br>**Properties**

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| [options.retries] | <code>Number</code> | <code>3</code> | Number of times to retry a wrapped   function |
| [options.timeout] | <code>Number</code> | <code>300</code> | Amount of time to wait between retries |
| [options.factor] | <code>Number</code> | <code>2</code> | The exponential factor to scale the   timeout by every retry iteration. For example: with a factor of 2 and a   timeout of 100 ms, the first retry will fire after 100 ms, the second   after 200 ms, the third after 400 ms, etc.... The formula used to   calculate the delay between each retry:   ```timeout * Math.pow(factor, attempts)``` |
| [options.errors] | <code>Error</code> \| <code>Array.&lt;Error&gt;</code> | <code>Error</code> | A single Error or an   array Errors that trigger a retry when caught |
| [options.log] | <code>function</code> |  | Logging function that takes a message as |


[npm-url]: https://www.npmjs.com/package/retryify
[npm-image]: https://img.shields.io/npm/v/retryify.svg?style=flat-square

[ci-url]: https://travis-ci.com/smartcar/retryify
[ci-image]: https://img.shields.io/travis/com/smartcar/retryify/master.svg?style=flat-square

[coverage-url]: https://codecov.io/gh/smartcar/retryify
[coverage-image]: https://img.shields.io/codecov/c/github/smartcar/retryify/master.svg?style=flat-square

[gk-url]: https://greenkeeper.io
[gk-image]: https://badges.greenkeeper.io/smartcar/retryify.svg?style=flat-square
