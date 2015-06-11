<a name="module_retry"></a>
## retry
Quickly and easily wrap functions to make them retry when they fail. Uses
bluebird promises for maximum convenience!

### Installation

    $ npm install --save smartcar/retry

**Example**  
```js
// create a new retry wrapper with some custom options set.
var retry = require('retry')({
  retries: 5,
  timeout: 1000,
  factor: 2,
  errors: [RequestError],
});

// promisified request library
var request = require('request-promise');

// get will now retry each time it catches a RequestError, it retries 5
// times, or the request finally resolves successfully.
var get = retry(function(url) {
  return request(url);
});

// send the request, but retry if it fails.
get('http://google.com')
  .then(...)
  .catch(...);
```

* [retry](#module_retry)
  * [~retry([options])](#module_retry..retry) ⇒ <code>function</code>
    * [~retryWrapper(fn, [innerOptions])](#module_retry..retry..retryWrapper) ⇒ <code>function</code>

<a name="module_retry..retry"></a>
### retry~retry([options]) ⇒ <code>function</code>
Retry module setup function. Takes an options object that configures the
default retry options.

**Kind**: inner method of <code>[retry](#module_retry)</code>  
**Returns**: <code>function</code> - [retryWrapper](retryWrapper) A decorator function that wraps a
  a function to turn it into a retry-enabled function.  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [options] | <code>Options</code> |  | Optional configuration object |
| [options.retries] | <code>Number</code> | <code>3</code> | Number of times to retry a wrapped   function |
| [options.timeout] | <code>Number</code> | <code>300</code> | Amount of time to wait between retries |
| [options.factor] | <code>Number</code> | <code>2</code> | The exponential factor to scale the   timeout by every retry iteration. For example: with a factor of 2 and a   timeout of 100 ms, the first retry will fire after 100 ms, the second   after 200 ms, the third after 400 ms, etc.... The formula used to   calculate the delay between each retry:   ```timeout * Math.pow(factor, attempts)``` |
| [options.errors] | <code>Array.&lt;Error&gt;</code> | <code>[Error]</code> | An array of user provided errors   that trigger a retry when caught |

<a name="module_retry..retry..retryWrapper"></a>
#### retry~retryWrapper(fn, [innerOptions]) ⇒ <code>function</code>
Retry function decorator. Allows configuration on a function by function
basis.

**Kind**: inner method of <code>[retry](#module_retry..retry)</code>  
**Returns**: <code>function</code> - The wrapped function.  

| Param | Type | Description |
| --- | --- | --- |
| fn | <code>function</code> | The function to wrap. Will retry the function if any   matching errors are caught. |
| [innerOptions] | <code>Object</code> | Optional configuration object. Same   format as above. |

