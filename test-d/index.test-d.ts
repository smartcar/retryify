import {expectError, expectType} from 'tsd'
import retryify from '../index.js'

const fn = <T>(v: T): T => v
expectType<Promise<ReturnType<typeof fn>>>(retryify({ fn }))
expectType<Promise<ReturnType<typeof fn>>>(retryify({
  fn,
  log: console.log,
  shouldRetry: (err: Error) => err.message === 'foo',
  initialDelay: 100,
  timeout: 200,
  retries: 2,
  factor: 1.5,
}))

expectError(retryify({ retries: 3 }))
expectError(retryify({ retries: '3', fn }))
