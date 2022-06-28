import { ethers, providers, Contract } from 'ethers'
import { Pool } from '@uniswap/v3-sdk'
import { abi as IUniswapV3PoolABI } from '@uniswap/v3-core/artifacts/contracts/interfaces/IUniswapV3Pool.sol/IUniswapV3Pool.json'

import { strict as assert } from  'assert'
import { Token } from '@uniswap/sdk-core'
import { DataSource } from 'typeorm'
import { Price } from './db/Price'
import { isAStableCoin } from './common'


export interface ChainImmutables {
    dataSource: DataSource
    /**
     * One of {@link common.UniswapChain}
     */
    key: string,
    provider: providers.Provider,
    poolAddress: string,
    tokenA: Token,
    tokenB: Token,
}

interface PoolImmutables {
    factory: string
    token0: string
    token1: string
    fee: number
    tickSpacing: number
    maxLiquidityPerTick: ethers.BigNumber
}

interface PoolState {
    liquidity: ethers.BigNumber
    sqrtPriceX96: ethers.BigNumber
    tick: number
    observationIndex: number
    observationCardinality: number
    observationCardinalityNext: number
    feeProtocol: number
    unlocked: boolean
}

async function getPoolImmutables(poolContract: Contract) {
    const [factory, token0, token1, fee, tickSpacing, maxLiquidityPerTick] = await Promise.all([
        poolContract.factory(),
        poolContract.token0(),
        poolContract.token1(),
        poolContract.fee(),
        poolContract.tickSpacing(),
        poolContract.maxLiquidityPerTick(),
    ])

    return {
        factory,
        token0,
        token1,
        fee,
        tickSpacing,
        maxLiquidityPerTick,
    } as PoolImmutables
}

async function getPoolState(poolContract: Contract, blockTag: providers.BlockTag = 'latest') {
    const [liquidity, slot] = await Promise.all([poolContract.liquidity({ blockTag:blockTag }), poolContract.slot0({ blockTag:blockTag })])

    const poolState: PoolState = {
        liquidity,
        sqrtPriceX96: slot[0],
        tick: slot[1],
        observationIndex: slot[2],
        observationCardinality: slot[3],
        observationCardinalityNext: slot[4],
        feeProtocol: slot[5],
        unlocked: slot[6],
    }

    return poolState
}

export async function fetchSpotPrice(provider: providers.Provider, poolAddress: string, tokenA: Token, tokenB: Token) {
    const poolContract = new Contract(poolAddress, IUniswapV3PoolABI, provider)
    const immutables = await getPoolImmutables(poolContract)
    const network = await provider.getNetwork()

    assert.strictEqual(tokenA.address, immutables.token0)
    assert.strictEqual(tokenB.address, immutables.token1)

    console.log(`listening to new blocks for ${poolAddress}`)
    provider.on("block", async (blockNumber: number) => {
        // Emitted on every block change
        const block = await provider.getBlock(blockNumber)
        console.log(`new block ${network.name} - ${block.number} @ ${block.timestamp}`)

        // const pendingBlock = await provider.getBlock('pending')
        // console.log(`pending block - ${pendingBlock.number} @ ${pendingBlock.timestamp}`)

        const state = await getPoolState(poolContract)

        const pool = new Pool(
            tokenA,
            tokenB,
            immutables.fee,
            state.sqrtPriceX96.toString(),
            state.liquidity.toString(),
            state.tick
        )

        console.log(`${pool.token0Price.toFixed(6)}, ${pool.token1Price.toFixed(6)}`)

        // console.log(poolExample)
    })
}

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
async function loadBlockAndStoreInDb(chainImmutables: ChainImmutables, poolContract: Contract, immutables: PoolImmutables, blockNumber: number) {
    const priceRepository = chainImmutables.dataSource.getRepository(Price)
    const priceEntry = await priceRepository.findOneBy({
        chain: chainImmutables.key,
        poolAddress: chainImmutables.poolAddress,
        blockNumber: blockNumber,
    })

    if (priceEntry != null) {
        console.log(`Price exists: ${priceEntry.chain}, ${priceEntry.blockNumber}. Skipping!`)
        return // entry is already present in DB. Stop scraping from here.
    }

    console.log(`Saving Price: ${chainImmutables.key}, ${blockNumber}...`)

    try {
        const [state, block] = await Promise.all([getPoolState(poolContract, blockNumber), chainImmutables.provider.getBlock(blockNumber)])

        const pool = new Pool(
            chainImmutables.tokenA,
            chainImmutables.tokenB,
            immutables.fee,
            state.sqrtPriceX96.toString(),
            state.liquidity.toString(),
            state.tick
        )


        const newPrice = new Price()
        newPrice.chain = chainImmutables.key
        newPrice.poolAddress = chainImmutables.poolAddress
        newPrice.blockNumber = blockNumber
        if (isAStableCoin(chainImmutables.tokenB)) {
            newPrice.tokenSymbol = chainImmutables.tokenA.symbol!
            newPrice.baseTokenSymbol = chainImmutables.tokenB.symbol!
            newPrice.tokenPrice = pool.token0Price.toFixed(6)
        } else if (isAStableCoin(chainImmutables.tokenA)) {
            newPrice.tokenSymbol = chainImmutables.tokenB.symbol!
            newPrice.baseTokenSymbol = chainImmutables.tokenA.symbol!
            newPrice.tokenPrice = pool.token1Price.toFixed(6)
        } else
            throw new Error(`Neither is a stable coin: ${chainImmutables}`)

        newPrice.blockTimestamp = new Date(block.timestamp * 1000)

        await priceRepository.save(newPrice)
        const hoursAgo = (Math.floor(new Date().getTime() / 1000) - block.timestamp) / 60 / 60
        console.log(`${chainImmutables.key} saved till ${hoursAgo} hrs ago!!: \t\t ${blockNumber} @ ${block.timestamp}: ${pool.token0Price.toFixed(6)}, ${pool.token1Price.toFixed(6)}`)
        await loadBlockAndStoreInDb(chainImmutables, poolContract, immutables, blockNumber - 1)
    } catch (error) {
        console.error(error)
        await loadBlockAndStoreInDb(chainImmutables, poolContract, immutables, blockNumber)
    }
}

export async function storePriceHistoryInDb(chainImmutables: ChainImmutables) {
    const poolContract = new Contract(chainImmutables.poolAddress, IUniswapV3PoolABI, chainImmutables.provider)
    const immutables = await getPoolImmutables(poolContract)

    assert.strictEqual(chainImmutables.tokenA.address, immutables.token0)
    assert.strictEqual(chainImmutables.tokenB.address, immutables.token1)

    const latestBlock = await chainImmutables.provider.getBlock('latest')
    console.log(`loading blocks for ${chainImmutables.poolAddress} from ${latestBlock.number}`)

    await loadBlockAndStoreInDb(chainImmutables, poolContract, immutables, latestBlock.number)
}
