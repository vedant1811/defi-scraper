"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.storePriceHistoryInDb = exports.fetchSpotPrice = void 0;
const ethers_1 = require("ethers");
const v3_sdk_1 = require("@uniswap/v3-sdk");
const IUniswapV3Pool_json_1 = require("@uniswap/v3-core/artifacts/contracts/interfaces/IUniswapV3Pool.sol/IUniswapV3Pool.json");
const assert_1 = require("assert");
const Price_1 = require("./db/Price");
const common_1 = require("./common");
function getPoolImmutables(poolContract) {
    return __awaiter(this, void 0, void 0, function* () {
        const [factory, token0, token1, fee, tickSpacing, maxLiquidityPerTick] = yield Promise.all([
            poolContract.factory(),
            poolContract.token0(),
            poolContract.token1(),
            poolContract.fee(),
            poolContract.tickSpacing(),
            poolContract.maxLiquidityPerTick(),
        ]);
        return {
            factory,
            token0,
            token1,
            fee,
            tickSpacing,
            maxLiquidityPerTick,
        };
    });
}
function getPoolState(poolContract, blockTag = 'latest') {
    return __awaiter(this, void 0, void 0, function* () {
        const [liquidity, slot] = yield Promise.all([poolContract.liquidity({ blockTag: blockTag }), poolContract.slot0({ blockTag: blockTag })]);
        const poolState = {
            liquidity,
            sqrtPriceX96: slot[0],
            tick: slot[1],
            observationIndex: slot[2],
            observationCardinality: slot[3],
            observationCardinalityNext: slot[4],
            feeProtocol: slot[5],
            unlocked: slot[6],
        };
        return poolState;
    });
}
function fetchSpotPrice(provider, poolAddress, tokenA, tokenB) {
    return __awaiter(this, void 0, void 0, function* () {
        const poolContract = new ethers_1.Contract(poolAddress, IUniswapV3Pool_json_1.abi, provider);
        const immutables = yield getPoolImmutables(poolContract);
        const network = yield provider.getNetwork();
        assert_1.strict.strictEqual(tokenA.address, immutables.token0);
        assert_1.strict.strictEqual(tokenB.address, immutables.token1);
        console.log(`listening to new blocks for ${poolAddress}`);
        provider.on("block", (blockNumber) => __awaiter(this, void 0, void 0, function* () {
            // Emitted on every block change
            const block = yield provider.getBlock(blockNumber);
            console.log(`new block ${network.name} - ${block.number} @ ${block.timestamp}`);
            // const pendingBlock = await provider.getBlock('pending')
            // console.log(`pending block - ${pendingBlock.number} @ ${pendingBlock.timestamp}`)
            const state = yield getPoolState(poolContract);
            const pool = new v3_sdk_1.Pool(tokenA, tokenB, immutables.fee, state.sqrtPriceX96.toString(), state.liquidity.toString(), state.tick);
            console.log(`${pool.token0Price.toFixed(6)}, ${pool.token1Price.toFixed(6)}`);
            // console.log(poolExample)
        }));
    });
}
exports.fetchSpotPrice = fetchSpotPrice;
/**
 * Will run recursively backwards until the last saved block is reached
 *
 * Idempotent: checks DB for blockNumber- skips if an entry is present
 *
 *
 * @param chainImmutables
 * @param poolContract
 * @param immutables
 * @param blockNumber
 */
function loadBlockAndStoreInDb(chainImmutables, poolContract, immutables, blockNumber) {
    return __awaiter(this, void 0, void 0, function* () {
        const priceRepository = chainImmutables.dataSource.getRepository(Price_1.Price);
        const priceEntry = yield priceRepository.findOneBy({
            chain: chainImmutables.key,
            poolAddress: chainImmutables.poolAddress,
            blockNumber: blockNumber,
        });
        if (priceEntry != null) {
            console.log(`Price exists: ${priceEntry.chain}, ${priceEntry.blockNumber}. Skipping!`);
            return; // entry is already present in DB
        }
        console.log(`Saving Price: ${chainImmutables.key}, ${blockNumber}...`);
        try {
            const [state, block] = yield Promise.all([getPoolState(poolContract, blockNumber), chainImmutables.provider.getBlock(blockNumber)]);
            const pool = new v3_sdk_1.Pool(chainImmutables.tokenA, chainImmutables.tokenB, immutables.fee, state.sqrtPriceX96.toString(), state.liquidity.toString(), state.tick);
            const newPrice = new Price_1.Price();
            newPrice.chain = chainImmutables.key;
            newPrice.poolAddress = chainImmutables.poolAddress;
            newPrice.blockNumber = blockNumber;
            if ((0, common_1.isAStableCoin)(chainImmutables.tokenB)) {
                newPrice.tokenSymbol = chainImmutables.tokenA.symbol;
                newPrice.baseTokenSymbol = chainImmutables.tokenB.symbol;
                newPrice.tokenPrice = pool.token0Price.toFixed(6);
            }
            else if ((0, common_1.isAStableCoin)(chainImmutables.tokenA)) {
                newPrice.tokenSymbol = chainImmutables.tokenB.symbol;
                newPrice.baseTokenSymbol = chainImmutables.tokenA.symbol;
                newPrice.tokenPrice = pool.token1Price.toFixed(6);
            }
            else
                throw new Error(`Neither is a stable coin: ${chainImmutables}`);
            newPrice.blockTimestamp = new Date(block.timestamp * 1000);
            yield priceRepository.save(newPrice);
            const hoursAgo = (Math.floor(new Date().getTime() / 1000) - block.timestamp) / 60 / 60;
            console.log(`${chainImmutables.key} saved till ${hoursAgo} hrs ago!!: \t\t ${blockNumber} @ ${block.timestamp}: ${pool.token0Price.toFixed(6)}, ${pool.token1Price.toFixed(6)}`);
            yield loadBlockAndStoreInDb(chainImmutables, poolContract, immutables, blockNumber - 1);
        }
        catch (error) {
            console.error(error);
            // retry after 1s
            // await new Promise(r => setTimeout(r, 1000))
            yield loadBlockAndStoreInDb(chainImmutables, poolContract, immutables, blockNumber);
        }
    });
}
function storePriceHistoryInDb(chainImmutables) {
    return __awaiter(this, void 0, void 0, function* () {
        const poolContract = new ethers_1.Contract(chainImmutables.poolAddress, IUniswapV3Pool_json_1.abi, chainImmutables.provider);
        const immutables = yield getPoolImmutables(poolContract);
        assert_1.strict.strictEqual(chainImmutables.tokenA.address, immutables.token0);
        assert_1.strict.strictEqual(chainImmutables.tokenB.address, immutables.token1);
        // const latestBlock = await chainImmutables.provider.getBlock('latest')
        // console.log(`loading blocks for ${chainImmutables.poolAddress} from ${latestBlock.number}`)
        // const startDate = Math.floor(Date.now() / 1000) - (7 * 24 * 60 * 60) // seconds since epoc (not ms)
        // const batchSize = 10
        // console.log(`startDate: ${startDate}`)
        // var i = latestBlock.number
        // setInterval(() => {
        //     loadBlockAndStoreInDb(chainImmutables, poolContract, immutables, i)
        //     i--
        // }, 100)
        yield loadBlockAndStoreInDb(chainImmutables, poolContract, immutables, 15022602);
    });
}
exports.storePriceHistoryInDb = storePriceHistoryInDb;
