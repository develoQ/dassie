import type { Effect, EffectContext } from "../effect"
import type { SignalFactory } from "../signal"
import { LifecycleScope } from "./lifecycle-scope"

interface EffectCache<TReturn> {
  returnPromise: Promise<TReturn>
  lifecycleScope: LifecycleScope
}

export const createArrayEffect = <TElement, TReturn>(
  arrayTopicFactory: SignalFactory<readonly TElement[]>,
  effect: Effect<TElement, TReturn>,
  parentEffectName: string
) => {
  return function keepArrayEffectsCache(sig: EffectContext) {
    const runningEffects = new Map<TElement, EffectCache<TReturn>>()

    sig.onCleanup(async () => {
      const disposerPromises: Promise<void>[] = []
      for (const cache of runningEffects.values()) {
        const result = cache.lifecycleScope.dispose()
        if (typeof result.then === "function") disposerPromises.push(result)
      }
      runningEffects.clear()
      await Promise.all(disposerPromises)
    })

    return sig.run(function handleArrayChanges(sig: EffectContext) {
      const arrayValue = sig.get(arrayTopicFactory)

      const asSet = new Set(arrayValue)

      const removed = new Set<TElement>()

      for (const element of runningEffects.keys()) {
        if (!asSet.has(element)) {
          removed.add(element)
        }
      }

      const disposalPromises = Array.from({ length: removed.size })

      let index = 0
      for (const element of removed) {
        const effectCache = runningEffects.get(element)
        disposalPromises[index++] = effectCache!.lifecycleScope.dispose()
        runningEffects.delete(element)
      }

      const disposalPromise = Promise.all(disposalPromises)

      const results: Promise<TReturn>[] = arrayValue.map((element, index) => {
        if (runningEffects.has(element)) {
          return runningEffects.get(element)!.returnPromise
        }

        const lifecycleScope = new LifecycleScope()

        const returnPromise = disposalPromise.then(() => {
          return sig.run(effect, element, {
            parentLifecycleScope: lifecycleScope,
            additionalDebugData: {
              topic: arrayTopicFactory.name,
              index,
              parentEffect: parentEffectName,
            },
          })
        })

        runningEffects.set(element, {
          returnPromise,
          lifecycleScope,
        })

        return returnPromise
      })

      return results
    })
  }
}

interface IndexedEffectCache<TElement, TReturn> extends EffectCache<TReturn> {
  element: TElement
}

export const createIndexedArrayEffect = <TElement, TReturn>(
  arrayTopicFactory: SignalFactory<readonly TElement[]>,
  effect: Effect<readonly [element: TElement, index: number], TReturn>,
  parentEffectName: string
) => {
  return function keepArrayEffectsCache(sig: EffectContext) {
    let runningEffects: IndexedEffectCache<TElement, TReturn>[] = []

    sig.onCleanup(async () => {
      const disposerPromises: Promise<void>[] = []
      for (const cache of runningEffects.values()) {
        const result = cache.lifecycleScope.dispose()
        if (typeof result.then === "function") disposerPromises.push(result)
      }
      runningEffects = []
      await Promise.all(disposerPromises)
    })

    return sig.run(function handleArrayChanges(sig: EffectContext) {
      const arrayValue = sig.get(arrayTopicFactory)

      const maxIndex = Math.max(runningEffects.length, arrayValue.length) - 1

      const disposalPromises: Promise<void>[] = []

      for (let index = 0; index <= maxIndex; index++) {
        const effectCache = runningEffects[index]
        if (effectCache && effectCache.element !== arrayValue[index]) {
          disposalPromises.push(effectCache.lifecycleScope.dispose())
          // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
          delete runningEffects[index]
        }
      }

      const disposalPromise = Promise.all(disposalPromises)

      const results: Promise<TReturn>[] = arrayValue.map((element, index) => {
        const cache = runningEffects[index]
        if (cache) {
          return cache.returnPromise
        }

        const lifecycleScope = new LifecycleScope()

        const returnPromise = disposalPromise.then(() => {
          return sig.run(effect, [element, index] as const, {
            parentLifecycleScope: lifecycleScope,
            additionalDebugData: {
              topic: arrayTopicFactory.name,
              index,
              parentEffect: parentEffectName,
            },
          })
        })

        runningEffects[index] = {
          element,
          returnPromise,
          lifecycleScope,
        }

        return returnPromise
      })

      return results
    })
  }
}
