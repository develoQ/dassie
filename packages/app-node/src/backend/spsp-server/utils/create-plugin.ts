import { nanoid } from "nanoid"

import type { EffectContext } from "@dassie/lib-reactive"

import { configSignal } from "../../config"
import { ilpRoutingTableSignal } from "../../ilp-connector/signals/ilp-routing-table"
import { incomingIlpPacketBuffer } from "../../ilp-connector/topics/incoming-ilp-packet"

let nextRequestId = 1

const outstandingRequests = new Map<number, (data: Buffer) => void>()

export const createPlugin = (sig: EffectContext) => {
  const nodeIlpAddress = sig.get(configSignal, (config) => config.ilpAddress)
  const ilpClientMap = sig.use(ilpRoutingTableSignal)

  let ilpAddress: string
  do {
    ilpAddress = `${nodeIlpAddress}.${nanoid(6)}`
  } while (ilpClientMap.read().get(ilpAddress))

  let connected = false
  let currentHandler: ((data: Buffer) => Promise<Buffer>) | undefined

  return {
    ilpAddress,
    plugin: {
      connect: () => {
        if (connected) return Promise.resolve()

        sig
          .use(ilpRoutingTableSignal)
          .read()
          .set(ilpAddress, {
            prefix: ilpAddress,
            type: "spsp",
            sendPacket: async ({ packet, requestId }) => {
              const existingRequest = outstandingRequests.get(requestId)
              if (existingRequest) {
                existingRequest(Buffer.from(packet))
                outstandingRequests.delete(requestId)
                return
              }

              if (!currentHandler) {
                throw new Error("No handler registered")
              }

              const response = await currentHandler(Buffer.from(packet))

              sig.use(incomingIlpPacketBuffer).emit({
                packet: response,
                source: ilpAddress,
                requestId,
              })
            },
          })

        connected = true

        return Promise.resolve()
      },
      disconnect: () => {
        if (!connected) return Promise.resolve()

        sig.use(ilpRoutingTableSignal).read().delete(ilpAddress)

        connected = false

        return Promise.resolve()
      },
      isConnected: () => {
        return connected
      },
      sendData: (data: Buffer) => {
        const resultPromise = new Promise<Buffer>((resolve) => {
          const requestId = nextRequestId++
          outstandingRequests.set(requestId, resolve)
          sig.use(incomingIlpPacketBuffer).emit({
            packet: data,
            source: ilpAddress,
            requestId,
          })
        })

        return resultPromise
      },
      registerDataHandler: (handler: (data: Buffer) => Promise<Buffer>) => {
        if (currentHandler) {
          throw new Error("Cannot register multiple handlers")
        }

        currentHandler = handler
      },
      deregisterDataHandler: () => {
        currentHandler = undefined
      },
    },
  }
}
