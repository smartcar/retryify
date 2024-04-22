type RetryOptions = {
  retries?: number
  initialDelay?: number
  timeout?: number
  factor?: number
  log?: (msg: string) => void
  shouldRetry?: (err: Error) => boolean
}

type Callable = (...args: any[]) => any

type RetryWrapper = {
  <T extends Callable = Callable>(fn: T): T
  <T extends Callable = Callable>(opts: RetryOptions, fn: T): T
}

declare function retryify(opts: RetryOptions): RetryWrapper

export = retryify
