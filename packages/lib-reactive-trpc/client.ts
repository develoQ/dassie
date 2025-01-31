import type { inferRouterProxyClient } from "@trpc/client"

import {
  BoundAction,
  Change,
  EffectContext,
  InferMessageType,
  Service,
  ServiceFactory,
  TopicFactory,
  createService,
  isStore,
} from "@dassie/lib-reactive"

import type { RemoteReactiveRouter } from "./server"

export type ReactiveTrpcClient<
  TExposedTopicsMap extends Record<string, TopicFactory>
> = inferRouterProxyClient<RemoteReactiveRouter<TExposedTopicsMap>>

export const createTrpcConnection = <
  TExposedTopicsMap extends Record<string, TopicFactory>
>(
  connect: (sig: EffectContext) => ReactiveTrpcClient<TExposedTopicsMap>
) => {
  return createService(connect)
}

export const createRemoteTopic = <
  TExposedTopicsMap extends Record<string, TopicFactory>,
  TTopicName extends string & keyof TExposedTopicsMap
>(
  connectionFactory: ServiceFactory<ReactiveTrpcClient<TExposedTopicsMap>>,
  topicName: TTopicName
): Service<InferMessageType<TExposedTopicsMap[TTopicName]> | undefined> => {
  const service = createService<
    InferMessageType<TExposedTopicsMap[TTopicName]> | undefined
  >((sig) => {
    const client = sig.get(connectionFactory)

    if (!client) return
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    const subscription = client.listenToTopic.subscribe(topicName, {
      onData: (event: unknown) => {
        service.write(event as InferMessageType<TExposedTopicsMap[TTopicName]>)
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)
    sig.onCleanup(() => subscription.unsubscribe())

    return undefined
  })

  return service
}

export const createRemoteSignal = <
  TExposedTopicsMap extends Record<string, TopicFactory>,
  TSignalName extends string & keyof TExposedTopicsMap,
  TInitialValue
>(
  connectionFactory: ServiceFactory<ReactiveTrpcClient<TExposedTopicsMap>>,
  storeName: TSignalName,
  initialValue: TInitialValue
): Service<
  InferMessageType<TExposedTopicsMap[TSignalName]> | TInitialValue
> => {
  const service = createService<
    InferMessageType<TExposedTopicsMap[TSignalName]> | TInitialValue
  >((sig) => {
    const client = sig.get(connectionFactory)

    if (!client) return initialValue

    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    const subscription = client.listenToTopic.subscribe(storeName, {
      onData: (event: unknown) => {
        service.write(event as InferMessageType<TExposedTopicsMap[TSignalName]>)
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)
    sig.onCleanup(() => subscription.unsubscribe())

    return initialValue
  })

  return service
}

export const createRemoteSynchronizedStore = <
  TExposedTopicsMap extends Record<string, TopicFactory>,
  TStoreName extends string & keyof TExposedTopicsMap
>(
  connectionFactory: ServiceFactory<ReactiveTrpcClient<TExposedTopicsMap>>,
  storeName: TStoreName,
  storeImplementation: TExposedTopicsMap[TStoreName]
): Service<InferMessageType<TExposedTopicsMap[TStoreName]>> => {
  const service = createService<
    InferMessageType<TExposedTopicsMap[TStoreName]>
  >((sig) => {
    const client = sig.get(connectionFactory)

    const localStore = sig.use(storeImplementation)

    if (!isStore(localStore)) {
      throw new Error("Store is not synchronizable")
    }

    if (!client)
      return localStore.read() as InferMessageType<
        TExposedTopicsMap[TStoreName]
      >

    sig.onCleanup(
      localStore.on((newValue) => {
        service.write(
          newValue as InferMessageType<TExposedTopicsMap[TStoreName]>
        )
      })
    )

    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    const subscription = client.listenToChanges.subscribe(storeName, {
      onData: (
        event:
          | { type: "initial"; data: unknown }
          | { type: "change"; data: Change }
      ) => {
        if (event.type === "initial") {
          localStore.write(event.data)
        } else {
          const action = localStore[event.data[0]] as
            | BoundAction<unknown, unknown[]>
            | undefined

          if (!action) {
            throw new Error(
              `Tried to synchronize action ${event.data[0]} which does not exist in the local implementation`
            )
          }
          action(...event.data[1])
        }
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)
    sig.onCleanup(() => subscription.unsubscribe())

    return localStore.read() as InferMessageType<TExposedTopicsMap[TStoreName]>
  })

  return service
}
