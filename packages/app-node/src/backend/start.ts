import { EffectContext, createReactor } from "@dassie/lib-reactive"

import { startBeaconClient } from "./beacon-client"
import { startBtpServer } from "./btp-server"
import { signerService } from "./crypto/signer"
import { startHttpServer } from "./http-server"
import { startIlpConnector } from "./ilp-connector"
import { attachLogger } from "./logger"
import { startOpenPaymentsServer } from "./open-payments"
import { speakPeerProtocol } from "./peer-protocol"
import { startSpspServer } from "./spsp-server"
import { startSubnets } from "./subnets"
import { startTrpcServer } from "./trpc-server"

export const rootEffect = async (sig: EffectContext) => {
  sig.run(sig.use(signerService).effect)
  sig.run(attachLogger)
  sig.run(startHttpServer)
  sig.run(startBtpServer)
  sig.run(startTrpcServer)
  sig.run(startIlpConnector)
  await sig.run(startSubnets)
  await sig.run(startSpspServer)
  await sig.run(startOpenPaymentsServer)

  await sig.run(speakPeerProtocol)

  sig.run(startBeaconClient)
}

export const start = () => createReactor(rootEffect)
