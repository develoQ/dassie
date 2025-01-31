import { createLogger } from "@dassie/lib-logger"
import type { EffectContext } from "@dassie/lib-reactive"

import { configSignal } from "../config"
import { signerService } from "../crypto/signer"
import { compareKeysToArray, compareSetOfKeys } from "../utils/compare-sets"
import { peerNodeInfo, signedPeerNodeInfo } from "./peer-schema"
import { nodeTableStore } from "./stores/node-table"
import { peerTableStore } from "./stores/peer-table"

const logger = createLogger("das:node:maintain-own-node-table-entry")

export const maintainOwnNodeTableEntry = async (sig: EffectContext) => {
  const { nodeId, url } = sig.getKeys(configSignal, ["nodeId", "url"])
  const signer = sig.get(signerService)

  if (!signer) return

  // Get the current peers and re-run the effect iff the IDs of the peers change.
  const peers = sig.get(
    peerTableStore,
    (peerTable) => peerTable,
    compareSetOfKeys
  )

  const ownNodeTableEntry = sig.get(nodeTableStore, (nodeTable) =>
    nodeTable.get(nodeId)
  )

  if (
    ownNodeTableEntry == null ||
    !compareKeysToArray(peers, ownNodeTableEntry.neighbors)
  ) {
    const sequence = BigInt(Date.now())
    const peerIds = [...peers.values()].map((peer) => peer.nodeId)
    const publicKey = await signer.getPublicKey()

    const peerNodeInfoResult = peerNodeInfo.serialize({
      nodeId: nodeId,
      nodeKey: publicKey,
      url,
      sequence,
      entries: peerIds.map((peerId) => ({
        neighbor: { nodeId: peerId },
      })),
    })

    if (!peerNodeInfoResult.success) {
      logger.warn("Failed to serialize link state update signed portion", {
        error: peerNodeInfoResult.error,
      })
      return
    }

    const signature = await signer.signWithDassieKey(peerNodeInfoResult.value)
    const message = signedPeerNodeInfo.serialize({
      signed: peerNodeInfoResult.value,
      signature,
    })

    if (!message.success) {
      logger.warn("Failed to serialize link state update message", {
        error: message.error,
      })
      return
    }

    if (ownNodeTableEntry === undefined) {
      logger.debug("creating own node table entry", {
        sequence,
        neighbors: peerIds.join(","),
      })
      sig.use(nodeTableStore).addNode({
        nodeId: nodeId,
        neighbors: peerIds,
        nodeKey: publicKey,
        sequence,
        scheduledRetransmitTime: Date.now(),
        updateReceivedCounter: 0,
        lastLinkStateUpdate: message.value,
      })
    } else {
      logger.debug("updating own node table entry", {
        sequence,
        neighbors: peerIds.join(","),
      })
      sig.use(nodeTableStore).updateNode(nodeId, {
        neighbors: peerIds,
        sequence,
        scheduledRetransmitTime: Date.now(),
        updateReceivedCounter: 0,
        lastLinkStateUpdate: message.value,
      })
    }
  }
}
