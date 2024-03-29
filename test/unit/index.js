'use strict';

const test = require('ava');
const util = require('util');
const retryLib = require('../../index');

// Promise.delay without bluebird
const delay = (time) => new Promise((resolve) => setTimeout(resolve, time));

const retryify = retryLib({
  retries: 2,
  initialDelay: 0,
  timeout: 5, // ms
  factor: 1.5,
});

// MUST GET 100% COVERAGE (ノ._.)ノ
retryLib();

test('function passed to setup function', function(t) {
  const err = t.throws(() => retryLib(() => 1), {
    instanceOf: TypeError,
  });
  t.is(err.message, 'options object expected but was passed a function');
});

test('no times, standard fn', async function(t) {
  const addABC = retryify(
    {retries: 1},
    function(a, b, c) {
      return a + b + c;
    },
  );

  const sum = await addABC(1, 2, 3);
  t.is(sum, 6);
});

test('no times, promise fn', async function(t) {
  const addABC = retryify(
    {retries: 0},
    function(a, b, c) {
      return delay(5).then(function() {
        return a + b + c;
      });
    },
  );

  const sum = await addABC(1, 2, 3);
  t.is(sum, 6);
});

test('once, error on first call, standard fn', async function(t) {
  let retries = 1;

  const addFail = retryify(
    {retries},
    function(a, b, c) {
      if (retries > 0) {
        retries -= 1;
        throw new Error('Oh no! The promise failed :0');
      } else {
        return a + b + c;
      }
    },
  );

  const sum = await addFail(1, 2, 3);
  t.is(sum, 6);
});

test('once, error on first call, promise fn', async function(t) {
  let retries = 1;

  const addFail = retryify(
    {retries},
    function(a, b, c) {
      return delay(5).then(function() {
        if (retries > 0) {
          retries -= 1;
          throw new Error('Oh no! The promise failed :0');
        } else {
          return a + b + c;
        }
      });
    },
  );

  const sum = await addFail(1, 2, 3);
  t.is(sum, 6);
});

test('twice, error on first call, promise fn', async function(t) {
  let retries = 2;

  const addFail = retryify(
    {retries},
    function(a, b, c) {
      return delay(5).then(function() {
        if (retries > 0) {
          retries -= 1;
          throw new Error('Oh no! The promise failed :0');
        } else {
          return a + b + c;
        }
      });
    },
  );

  const sum = await addFail(1, 2, 3);
  t.is(sum, 6);
});

test('always error, promise fn', async function(t) {
  const retries = 2;

  const fail = retryify(
    {retries},
    function() {
      return delay(5).then(function() {
        throw new Error('Fail!');
      });
    },
  );

  const err = await t.throwsAsync(fail());
  t.is(err.message, 'Fail!');
});

test('retries but never error, promise fn', async function(t) {
  const addABC = retryify(
    {retries: 3},
    function(a, b, c) {
      return delay(5).then(function() {
        return a + b + c;
      });
    },
  );

  const sum = await addABC(1, 2, 3);
  t.is(sum, 6);
});

test('promise fn with `this` bound', async function(t) {
  function Foo() {
    this.foo = 'this is a foo';
  }

  Foo.prototype.fooer = retryify(function(a, b, c) {
    t.is(this.foo, 'this is a foo');
    return delay(5).then(() => [this.foo, a, b, c].join(' '));
  });

  const aFoo = new Foo();

  const foo = await aFoo.fooer(1, 2, 3);
  t.is(foo, 'this is a foo 1 2 3');
});

test("error doesn't match user defined error", async function(t) {
  function FooError() {
    this.name = 'FooError';
    this.message = 'This is a FooError';
  }
  util.inherits(FooError, Error);

  function BarError() {
    this.name = 'BarError';
    this.message = 'This is a BarError';
  }
  util.inherits(BarError, Error);

  function BazError() {
    this.name = 'BazError';
    this.message = 'This is a BazError';
  }
  util.inherits(BazError, Error);

  let count = 0;

  const fail = retryify(
    {
      shouldRetry(caught) {
        return caught instanceof BazError;
      },
    },
    function() {
      return delay(5).then(function() {
        count += 1;
        throw new FooError();
      });
    },
  );

  await t.throwsAsync(fail(), {
    instanceOf: FooError,
  });
  t.is(count, 1);
});

test('log should get called on retry', async function(t) {
  let wasCalled = false;

  const mockLog = function() {
    wasCalled = true;
  };

  const fail = retryify(
    {
      log: mockLog,
    },
    function throws() {
      return delay(5).then(function() {
        throw new Error();
      });
    },
  );

  t.false(wasCalled, 'mockLog should not be called at this point.');
  await t.throwsAsync(fail());
  t.true(wasCalled, 'mockLog should get called at some point.');
});

/**
 * Test state before and after initialDelay
 *
 * Time(seconds):        0s .  .  .  1s .  .  .  2s .  .  .  3s
 * areWeThereYet:        f                 t
 * Testing checkpoints:  *     *     *  *      *
 */

test('initial delay', async function(t) {
  const options = {
    retries: 0,
    initialDelay: 1500,
  };

  let areWeThereYet = false;

  const weArrived = () => {
    areWeThereYet = true;
  };

  retryify(options, weArrived)();

  t.false(areWeThereYet); // 0 sec

  await delay(500); // 0.5 sec
  t.false(areWeThereYet);

  await delay(500); // 1 sec
  t.false(areWeThereYet);

  await delay(250); // 1.25 sec
  t.false(areWeThereYet);

  // After 1.5 seconds, we are finally there
  await delay(500); // 1.75
  t.true(areWeThereYet);

});
