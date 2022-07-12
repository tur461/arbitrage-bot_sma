require('dotenv').config();

const { exit } = require('./utils');
// const Utils = require('../build/contracts/Utils.json');
const Arbitrager = require('../build/contracts/Arbitrager.json');
const IRouter = require('@uniswap/v2-periphery/build/IUniswapV2Router02.json')
const ERC20PresetMinterPauser = require('@openzeppelin/contracts/build/contracts/ERC20PresetMinterPauser.json');
const { ADDRESS, VAL, CHAIN } = require('./constants');
const { getContract, switchChain } = require('./mweb3');

const MINTED = process.env.MINTED;
const DEPLOYED = process.env.DEPLOYED;
const DO_LIQ_1 = process.env.DO_LIQ_1;
const DO_LIQ_2 = process.env.DO_LIQ_2;

const MINT_AMOUNT = 1e6;
const tokenContractParams = [
    ERC20PresetMinterPauser.abi,
    '',
    {data:ERC20PresetMinterPauser.bytecode}
];

let arbitrager;
let web3, myAccount; 
let uRouter, sRouter; 
let token0, token1;

function initVars() {
    console.log('init variables for ethereum..');
    token0 = getContract(tokenContractParams);
    token1 = getContract(tokenContractParams);
    uRouter = getContract([IRouter.abi, ADDRESS.UNI_ROUTER]);
    sRouter = getContract([IRouter.abi, ADDRESS.SUSHI_ROUTER]);
    arbitrager = getContract([
        Arbitrager.abi,
        '',
        {data:Arbitrager.bytecode}
    ]);
    // utils = getContract([
    //     Utils.abi,
    //     '',
    //     {data:Utils.bytecode}
    // ]);
}

async function addLiquidity(a0, a1, a2, a3) {
    const dat = await deployOnEthereum();
    await addLiquidityOnUniSwap({a2, a3}, dat);
    await addLiquidityOnSushiSwap({a0, a1}, dat);
    console.log('add liquidity on all dexes completed!');
}

async function deployOnEthereum() {
    initVars();
    console.log('Deployment on Ethereum..');
    
    let gasLimit, receipt, aux, mintAmount;
    if(DEPLOYED == 1) {
        // utils.options.address = ADDRESS.UTILS;
        token0.options.address = ADDRESS.TOKEN0;
        token1.options.address = ADDRESS.TOKEN1;
        arbitrager.options.address = ADDRESS.ARBTRG;
    } else {
        //deploying token0
        gasLimit = await token0.deploy({arguments: [VAL.TKN0_NAME, VAL.TKN0_SYM]}).estimateGas({from: myAccount})
        receipt = await token0.deploy({arguments: [VAL.TKN0_NAME, VAL.TKN0_SYM]}).send({from: myAccount})
        token0.options.address = receipt._address
    
        // deploying token1
        gasLimit = await token1.deploy({arguments: [VAL.TKN1_NAME, VAL.TKN1_SYM]}).estimateGas({from: myAccount})
        receipt = await token1.deploy({arguments: [VAL.TKN1_NAME, VAL.TKN1_SYM]}).send({from: myAccount})
        token1.options.address = receipt._address
    }

    if (token0.options.address > token1.options.address) { 
        aux = token0; token0 = token1; token1 = aux; 
    }
    
    //prints
    const token0Name = await token0.methods.name().call()
    const token0Symbol = await token0.methods.symbol().call()
    const token1Name = await token1.methods.name().call()
    const token1Symbol = await token1.methods.symbol().call()
    console.log('token 0:', token0Symbol, token0.options.address);
    console.log('token 1:', token1Symbol, token1.options.address);
    console.log(
        `\n${token0Name} (${token0Symbol}) {token0}\n`+
        `Deployed at ${token0.options.address}\n\n`+
        `${token1Name} (${token1Symbol}) {token1}\n`+
        `Deployed at ${ token1.options.address}\n`
        )

    mintAmount = web3.utils.toWei(web3.utils.toBN(MINT_AMOUNT))
    
    if(MINTED == 0) {
        //minting token0
        gasLimit = await token0.methods.mint(myAccount, mintAmount).estimateGas({from: myAccount})
        await token0.methods.mint(myAccount, mintAmount).send({from: myAccount})
        
        // minting token1
        gasLimit = await token1.methods.mint(myAccount, mintAmount).estimateGas({from: myAccount})
        await token1.methods.mint(myAccount, mintAmount).send({from: myAccount})
    }
    
    console.log(`${web3.utils.fromWei(mintAmount)} ${token0Symbol} minted`)
    console.log(`${web3.utils.fromWei(mintAmount)} ${token1Symbol} minted\n`);

    if(DEPLOYED == 0) {
        gasLimit = await arbitrager.deploy({arguments: [ADDRESS.SUSHI_FACTORY, ADDRESS.UNI_ROUTER]}).estimateGas({from: myAccount})
        receipt = await arbitrager.deploy({arguments: [ADDRESS.SUSHI_FACTORY, ADDRESS.UNI_ROUTER]}).send({from: myAccount})
        arbitrager.options.address = receipt._address
        
        // gasLimit = await utils.deploy().estimateGas({from: myAccount})
        // receipt = await utils.deploy().send({from: myAccount})
        // utils.options.address = receipt._address
        
    }
    
    console.log(`Arbitrager contract deployed at ${arbitrager.options.address}\n`);
    // console.log(`Utils contract deployed at ${utils.options.address}\n`);
    
    return {token0Symbol, token1Symbol};
}

async function addLiquidityOnUniSwap({a2, a3}, {token0Symbol, token1Symbol}) {
    console.log('AddLiquidity on uniswap..');
    const deadline = Math.round(Date.now() / 1000) + 60 * 60;
    let amount0 = a2, amount1 = a3;
    //on uniswap
    amount0 = web3.utils.toWei(web3.utils.toBN(amount0),'ether')
    amount1 = web3.utils.toWei(web3.utils.toBN(amount1),'ether')
    
    if(DO_LIQ_1 == 1) await addLiquidityOnChain(amount0, amount1, uRouter);

    console.log(
        `UniSwap ${token0Symbol}/${token1Symbol} pair created\n`+
        `Reserves: ${web3.utils.fromWei(amount0)} ${token0Symbol} | ${web3.utils.fromWei(amount1)} ${token1Symbol}\n`+
        `Price: ${(amount0/amount1).toFixed(2)} ${token0Symbol}/${token1Symbol}\n`
        )
}

async function addLiquidityOnSushiSwap({a0, a1}, {token0Symbol, token1Symbol}) {
    console.log('AddLiquidity on SushiSwap..');
    let amount0 = a0, amount1 = a1;
    amount0 = web3.utils.toWei(web3.utils.toBN(amount0),'ether')
    amount1 = web3.utils.toWei(web3.utils.toBN(amount1),'ether')
    
    if(DO_LIQ_2 == 1) await addLiquidityOnChain(amount0, amount1, sRouter);
    
    console.log(
        `SaitamaSwap ${token0Symbol}/${token1Symbol} pair created\n`+
        `Reserves: ${web3.utils.fromWei(amount0)} ${token0Symbol} | ${web3.utils.fromWei(amount1)} ${token1Symbol}\n`+
        `Price: ${(amount0/amount1).toFixed(2)} ${token0Symbol}/${token1Symbol}\n`
        )
}

async function addLiquidityOnChain(amount0, amount1, router) {
    gasLimit = await token0.methods.approve(router.options.address,amount0).estimateGas({from: myAccount})
    await token0.methods.approve(router.options.address,amount0).send({from: myAccount})
    
    gasLimit = await token1.methods.approve(router.options.address,amount1).estimateGas({from: myAccount})
    await token1.methods.approve(router.options.address,amount1).send({from: myAccount})
    const deadline = Math.round(Date.now() / 1000) + 60 * 60;
    gasLimit = await router.methods.addLiquidity(
        token0.options.address,
        token1.options.address,
        amount0,
        amount1,
        0,
        0,
        myAccount,
        deadline
    ).estimateGas({from: myAccount})
    
    await router.methods.addLiquidity(
        token0.options.address,
        token1.options.address,
        amount0,
        amount1,
        0,
        0,
        myAccount,
        deadline
    ).send({from: myAccount,gas:gasLimit})
}

const amounts = 
process.argv[2] == '-a' ? 
// case A: token1 cheaper on SushiSwap
[10e2, 5e2, 1e4, 10e4] :
process.argv[2] == '-b' ? 
// case B: token1 cheaper on UniSwap
[1e2, 10e2, 3e4, 10e4] : 
exit();

(async _ => {
    const d = await switchChain(CHAIN.ETHEREUM);
    web3 = d.web3;
    myAccount = d.myAccount;
    await addLiquidity(...amounts);
    exit();
})();

