import { strict as assert } from  'assert'
import { Token } from "@uniswap/sdk-core"

/**
 * All are on mainnet
 */
 export const UniswapChain = {
    V3_L1: 'V3_L1',
    V3_POLYGON: 'V3_POLYGON',
    V3_OPTIMISM: 'V3_OPTIMISM',
    V3_ARBITRUM: 'V3_ARBITRUM',

    V2_L1: 'V2_L1',
}

const StableCoins = ['DAI', 'USDC']

export function isAStableCoin(token: Token) {
    return StableCoins.includes(token.symbol!)
}
