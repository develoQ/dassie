import { createStore } from "@dassie/lib-reactive"

import type { IndexedLogLine } from "../../backend/features/logs"

export const LOGS_SOFT_LIMIT = 10_000
export const LOGS_HARD_LIMIT = 10_100

export const logsStore = () =>
  createStore(
    { logs: [] as IndexedLogLine[] } as const,
    {
      // eslint-disable-next-line unicorn/consistent-function-scoping
      clear: () => () => ({
        logs: [],
      }),
      addLogLine:
        (logLine: IndexedLogLine) =>
        ({ logs }) => {
          logs.push(logLine)

          if (logs.length > LOGS_HARD_LIMIT) {
            logs = logs.slice(logs.length - LOGS_SOFT_LIMIT)
          }

          return { logs }
        },
    } as const
  )
