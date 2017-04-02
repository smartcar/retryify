'use strict';

const test = require('ava');
const util = require('util');
const Promise = require('bluebird');
const retryLib = require('../index');

const retryify = retryLib({
  retries: 2,
  timeout: 5, // ms
  factor: 1.5,
});

// MUST GET 100% COVERAGE (ノ._.)ノ
retryLib();

test('function passed to setup function', function(t) {

  const err = t.throws(() => retryLib(() => 1), TypeError);
  t.is(err.message, 'options object expected but was passed a function');

});

test('no times, standard fn', async function(t) {
  const addABC = retryify(function(a, b, c) {
    return a + b + c;
  }, {retries: 0});

  const sum = await addABC(1, 2, 3);
  t.is(sum, 6);
});

test('no times, promise fn', async function(t) {
  const addABC = retryify(function(a, b, c) {
    return Promise.delay(5).then(function() {
      return a + b + c;
    });
  }, {retries: 0});

  const sum = await addABC(1, 2, 3);
  t.is(sum, 6);
});

test('once, error on first call, standard fn', async function(t) {
  var retries = 1;

  const addFail = retryify(function(a, b, c) {
    if (retries > 0) {
      retries -= 1;
      throw new Error('Oh no! The promise failed :0');
    } else {
      return a + b + c;
    }
  }, {retries});

  const sum = await addFail(1, 2, 3);
  t.is(sum, 6);
});

test('once, error on first call, promise fn', async function(t) {
  var retries = 1;

  const addFail = retryify(function(a, b, c) {
    return Promise.delay(5).then(function() {
      if (retries > 0) {
        retries -= 1;
        throw new Error('Oh no! The promise failed :0');
      } else {
        return a + b + c;
      }
    });
  }, {retries});

  const sum = await addFail(1, 2, 3);
  t.is(sum, 6);
});

test('twice, error on first call, promise fn', async function(t) {
  var retries = 2;

  const addFail = retryify(function(a, b, c) {
    return Promise.delay(5).then(function() {
      if (retries > 0) {
        retries -= 1;
        throw new Error('Oh no! The promise failed :0');
      } else {
        return a + b + c;
      }
    });
  }, {retries});

  const sum = await addFail(1, 2, 3);
  t.is(sum, 6);
});

test('always error, promise fn', async function(t) {
  var retries = 2;

  const fail = retryify(function() {
    return Promise.delay(5).then(function() {
      throw new Error('Fail!');
    });
  }, {retries});

  const err = await t.throws(fail());
  t.is(err.message, 'Fail!');
});

test('retries but never error, promise fn', async function(t) {
  const addABC = retryify(function(a, b, c) {
    return Promise.delay(5).then(function() {
      return a + b + c;
    });
  }, {retries: 3});

  const sum = await addABC(1, 2, 3);
  t.is(sum, 6);
});

test('promise fn with `this` bound', async function(t) {
  function Foo() {
    this.foo = 'this is a foo';
  }

  Foo.prototype.fooer = retryify(function(a, b, c) {
    t.is(this.foo, 'this is a foo');
    return Promise.delay(5).bind(this).then(function() {
      return [this.foo, a, b, c].join(' ');
    });
  });

  const aFoo = new Foo();

  const foo = await aFoo.fooer(1, 2, 3);
  t.is(foo, 'this is a foo 1 2 3');
});

test('error doesn\'t match user defined error', async function(t) {
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

  var count = 0;

  const fail = retryify({
    errors: [BarError, BazError],
  }, function() {
    return Promise.delay(5).then(function() {
      count += 1;
      throw new FooError();
    });
  });

  await t.throws(fail(), FooError);
  t.is(count, 1);
});

test('log should get called on retry', async function(t) {
  var wasCalled = false;

  const mockLog = function() {
    wasCalled = true;
  };

  const fail = retryify({
    log: mockLog,
  }, function throws() {
    return Promise.delay(5).then(function() {
      throw new Error();
    });
  });

  t.false(wasCalled, 'mockLog should not be called at this point.');
  await t.throws(fail());
  t.true(wasCalled, 'mockLog should get called at some point.');
});
