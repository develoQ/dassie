import { createConnection } from "ilp-protocol-stream"

import { createLogger } from "@dassie/lib-logger"
import { EffectContext, createStore } from "@dassie/lib-reactive"

import { resolvePaymentPointer } from "../utils/resolve-payment-pointer"
import { createPlugin } from "./utils/create-plugin"

const logger = createLogger("das:node:send-spsp-payments")

export interface OutgoingSpspPayment {
  id: string
  destination: string
  totalAmount: bigint
  sentAmount: bigint
}

export const spspPaymentQueueStore = () =>
  createStore([] as OutgoingSpspPayment[], {
    addPayment: (payment: OutgoingSpspPayment) => (state) =>
      [...state, payment],
    // eslint-disable-next-line unicorn/consistent-function-scoping
    shift: () => (state) => state.slice(1),
  })

export const sendSpspPayments = async (sig: EffectContext) => {
  const nextPayment = sig.get(spspPaymentQueueStore, (queue) => queue[0])

  if (nextPayment) {
    const { id, destination, totalAmount, sentAmount } = nextPayment

    logger.debug("initiating payment", {
      id,
      to: destination,
      amount: totalAmount,
    })

    const {
      destination_account: destinationAccount,
      shared_secret: sharedSecret,
    } = await resolvePaymentPointer(destination)

    logger.debug("resolved payment pointer", {
      id,
      destinationAccount,
    })

    const { plugin } = sig.run(createPlugin)

    const connection = await createConnection({
      plugin,
      destinationAccount,
      sharedSecret: Buffer.from(sharedSecret, "base64"),
    })

    logger.debug("created STREAM connection", { id })

    const stream = connection.createStream()

    stream.setSendMax(String(totalAmount - sentAmount))

    stream.on("outgoing_money", (amountString: string) => {
      const amount = BigInt(amountString)
      logger.debug("sent money", { id, amount })

      if (sentAmount + amount >= totalAmount) {
        logger.debug("payment complete", { id })
        connection.end().catch((error: unknown) => {
          logger.error("error ending connection", { id, error })
        })
        sig.use(spspPaymentQueueStore).shift()
      }

      // TODO: should record/update sent amount
    })
  }
}
