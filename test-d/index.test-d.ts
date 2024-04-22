import {expectError, expectType} from 'tsd'
import retryify from '../index.js'

const fn = <T>(v: T): T => v
const wrapper = retryify({
  log: console.log,
  shouldRetry: (err: Error) => err.message === 'foo',
  initialDelay: 100,
  timeout: 200,
  retries: 2,
  factor: 1.5,
})
expectType<typeof fn>(wrapper(fn))
expectType<typeof fn>(wrapper({
  retries: 3,
  factor: 2,
}, fn))

expectError(retryify({ retries: '3' }))
