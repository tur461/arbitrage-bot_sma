const ADDRESS = {
    ZERO: `0x${'0'.repeat(40)}`,
    DAI: '0x6b175474e89094c44da98b954eedeac495271d0f',
    ETH: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
    UTILS: '0xBF1B50c63fA6966193EfB3922b4eF314f4e91c6E',
    ARBTRG: '0x685aEAB66438170b9A118683713B42CE95903270',
    TOKEN0: '0x6F8FEbfb48FDfF19225f9CF348A4286E5Eb61D76',
    TOKEN1: '0xE8676232Bc458ce61ba66FFCa91492D4ad90e89B',
    UNI_ROUTER: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
    UNI_FACTORY: '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f',
    SUSHI_ROUTER: '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506',
    SUSHI_FACTORY: '0xc35DADB65012eC5796536bD9864eD8773aBc74C4',
}

const VAL = {
    TKN0_SYM: 'PNA',
    TKN1_SYM: 'WTM',
    PRICE_TOKEN0: 190.2,
    PRICE_TOKEN1: 235.7,
    TKN0_NAME: 'Pineapple',
    TKN1_NAME: 'Watermelon',
}


// bsc testnet = 97
// rinkeby = 4
const CHAIN = {
    BSC: 97,
    LOCAL: 0,
    ETHEREUM: 4,
}

const ABI = {
    UTILS: require('../build/contracts/Utils.json').abi,
    I_ERC20: require('@uniswap/v2-periphery/build/IERC20.json').abi,
    I_PAIR: require('@uniswap/v2-core/build/IUniswapV2Pair.json').abi,
    I_FACTORY: require('@uniswap/v2-core/build/IUniswapV2Factory.json').abi,
    I_ROUTER: require('@uniswap/v2-periphery/build/IUniswapV2Router02.json').abi,
}

module.exports = {
    VAL,
    ABI,
    CHAIN,
    ADDRESS,
}