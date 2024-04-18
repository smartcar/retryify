type RetryifyOptions<T> = {
  fn: T
  fnThis?: any
  retries?: number
  initialDelay?: number
  timeout?: number
  factor?: number
  log?: (msg: string) => void
  shouldRetry?: (err: Error) => boolean
}

type Callable = (...args: any[]) => any

declare function retryify<T extends Callable = Callable>(opts: RetryifyOptions<T>): Promise<ReturnType<T>>

export = retryify
