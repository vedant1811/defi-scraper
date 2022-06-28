"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isAStableCoin = exports.UniswapChain = void 0;
/**
 * All are on mainnet
 */
exports.UniswapChain = {
    V3_L1: 'V3_L1',
    V3_POLYGON: 'V3_POLYGON',
    V3_OPTIMISM: 'V3_OPTIMISM',
    V3_ARBITRUM: 'V3_ARBITRUM',
    V2_L1: 'V2_L1',
};
const StableCoins = ['DAI', 'USDC'];
function isAStableCoin(token) {
    return StableCoins.includes(token.symbol);
}
exports.isAStableCoin = isAStableCoin;
