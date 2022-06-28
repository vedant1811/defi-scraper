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
const ethers_1 = require("ethers");
const sdk_core_1 = require("@uniswap/sdk-core");
const sdk_1 = require("@uniswap/sdk");
const typeorm_1 = require("typeorm");
require("reflect-metadata");
const common_1 = require("./common");
const uniswap_1 = require("./uniswap");
const Price_1 = require("./db/Price");
function initDb() {
    return __awaiter(this, void 0, void 0, function* () {
        process.env.TZ = 'UTC'; // because JS implicily converts to local timezone. Sigh! More on https://stackoverflow.com/a/17545854/1396264
        const appDataSource = new typeorm_1.DataSource({
            type: 'postgres',
            host: 'localhost',
            port: 5432,
            username: 'amm_scraper',
            password: 'password',
            database: 'amm_scraper',
            entities: [Price_1.Price],
            synchronize: true,
            migrations: [],
            logging: false,
        });
        yield appDataSource.initialize();
        console.log('db initialized!!!');
        return appDataSource;
    });
}
function scrape() {
    return __awaiter(this, void 0, void 0, function* () {
        const dataSource = yield initDb();
        // Chain IDs are from https://docs.uniswap.org/protocol/reference/deployments
        (0, uniswap_1.storePriceHistoryInDb)({
            dataSource,
            key: common_1.UniswapChain.V3_L1,
            provider: new ethers_1.providers.InfuraProvider('homestead', '<ENTER YOUR KEY>'),
            poolAddress: '0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640',
            tokenA: new sdk_core_1.Token(sdk_1.ChainId.MAINNET, '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', 6, 'USDC', 'USD Coin'),
            tokenB: new sdk_core_1.Token(sdk_1.ChainId.MAINNET, '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2', 18, 'WETH', 'Wrapped Ether'),
        });
        // storePriceHistoryInDb({
        //     dataSource,
        //     key: UniswapChain.V3_OPTIMISM,
        //     provider: new providers.JsonRpcProvider('https://opt-mainnet.g.alchemy.com/v2/<ENTER YOUR KEY>'),
        //     poolAddress: '0x85149247691df622eaf1a8bd0cafd40bc45154a9', // https://info.uniswap.org/#/optimism/pools/0x85149247691df622eaf1a8bd0cafd40bc45154a9
        //     tokenA: new Token(10, '0x4200000000000000000000000000000000000006', 18, 'WETH', 'Wrapped Ether'),
        //     tokenB: new Token(10, '0x7f5c764cbc14f9669b88837ca1490cca17c31607', 6, 'USDC', 'USD Coin'),
        // })
        // storePriceHistoryInDb({
        //     dataSource,
        //     key: UniswapChain.V3_POLYGON,
        //     provider: new providers.JsonRpcProvider('https://polygon-mainnet.g.alchemy.com/v2/<ENTER YOUR KEY>'),
        //     poolAddress: '0x45dda9cb7c25131df268515131f647d726f50608', // https://info.uniswap.org/#/polygon/pools/0x45dda9cb7c25131df268515131f647d726f50608
        //     tokenA: new Token(137, '0x2791bca1f2de4661ed88a30c99a7a9449aa84174', 6, 'USDC', 'USD Coin'),
        //     tokenB: new Token(137, '0x7ceb23fd6bc0add59e62ac25578270cff1b9f619', 18, 'WETH', 'Wrapped Ether'),
        // })
        // storePriceHistoryInDb({
        //     dataSource,
        //     key: UniswapChain.V3_ARBITRUM,
        //     provider: new providers.InfuraProvider('arbitrum', '<ENTER YOUR KEY>'),
        //     poolAddress: '0x45dda9cb7c25131df268515131f647d726f50608', // https://info.uniswap.org/#/arbitrum/pools/0xc31e54c7a869b9fcbecc14363cf510d1c41fa443
        //     tokenA: new Token(42161, '0x82af49447d8a07e3bd95bd0d56f35241523fbab1', 18, 'WETH', 'Wrapped Ether'),
        //     tokenB: new Token(42161, '0xff970a61a04b1ca14834a43f5de4533ebddb5cc8', 6, 'USDC', 'USD Coin'),
        // })
    });
}
scrape();
