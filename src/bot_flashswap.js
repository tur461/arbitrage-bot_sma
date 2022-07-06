require('dotenv').config()//for importing parameters
require('colors')//for console output
const Web3 = require('web3');
const { CHAIN, ABI, ADDRESS } = require('./constants');
const { switchChain, getContract } = require('./mweb3');
const { isAddr, exit } = require('./utils');

const isLocal = process.env.IS_LOCAL;

const priceToken0 = process.env.PRICE_TOKEN0
const priceToken1 = process.env.PRICE_TOKEN1
const privateKey = process.env.PRIVATE_KEY
const validPeriod = process.env.VALID_PERIOD


let web3, myAccount;

let utils;
let token0, token1;
let uRouter, sRouter; 
let uFactory, sFactory; 

let tkn0Sym, tkn1Sym;
let tkn0Name, tkn1Name; 
let sPair, uPair0, uPair1; 

// must be called at first!
async function init() {
    console.log('trying to get web3 instance..');

    const d = await switchChain(isLocal == 1 ? CHAIN.LOCAL : CHAIN.ETHEREUM, !0);
    web3 = d.web3;
    myAccount = d.myAccount;
    if(!d.web3) throw new Error('error getting web3 instance!');

    console.log('web3 instance received.');
}

async function initVars() {
    console.log('trying to initialize variables..');

    let tkn0Addr = ADDRESS.TOKEN0, tkn1Addr = ADDRESS.TOKEN1, addr;
     // on uniswap pairs, tokens are sort by address, T0<T1
    if (tkn0Addr > tkn1Addr) { // swap addresses if true!
        const aux = tkn0Addr; 
        tkn0Addr = tkn1Addr; 
        tkn1Addr = aux;
    }

    token0 = getContract([ABI.I_ERC20, tkn0Addr]);
    token1 = getContract([ABI.I_ERC20, tkn1Addr]);
    utils = getContract([ABI.UTILS,  ADDRESS.UTILS]);
    uRouter = getContract([ABI.I_ROUTER, ADDRESS.UNI_ROUTER]);
    sRouter = getContract([ABI.I_ROUTER, ADDRESS.SUSHI_ROUTER]);
    uFactory = getContract([ABI.I_FACTORY, ADDRESS.UNI_FACTORY]);
    sFactory = getContract([ABI.I_FACTORY, ADDRESS.SUSHI_FACTORY]);

    tkn0Name = await token0.methods.name().call();
    tkn0Sym = await token0.methods.symbol().call();
    tkn1Name = await token1.methods.name().call();
    tkn1Sym = await token1.methods.symbol().call();

    addr = await uFactory.methods.getPair(ADDRESS.ETH, ADDRESS.DAI).call();
    uPair0 = isAddr(addr) ? getContract([ABI.I_PAIR, addr]) : null;
    if(!uPair0) throw new Error('pair doesn\'t exist! eth-dai');

    addr = await uFactory.methods.getPair(token0.options.address, token1.options.address).call();
    uPair1 = isAddr(addr) ? getContract([ABI.I_PAIR, addr]) : null;
    if(!uPair1) throw new Error(`pair doesn\'t exist! ${tkn0Sym}-${tkn1Sym} on uniSwap`);

    addr = await sFactory.methods.getPair(token0.options.address, token1.options.address).call();
    sPair = isAddr(addr) ? getContract([ABI.I_PAIR, addr]) : null;
    if(!sPair) throw new Error(`pair doesn\'t exist! ${tkn0Sym}-${tkn1Sym} on sushiSwap`);
    
    console.log('variable initialization done.');
}

(async _ => {
    try {
        await init();
        await initVars();
        startBot();
    } catch(e) {
        console.log('Error:', e);
        exit();
    }
})();

function startBot() {
    console.log('trying to start the bot..');
    
    //listening for incoming new blocks
    const newBlockEvent = web3.eth.subscribe('newBlockHeaders');
    
    newBlockEvent.on('data', onDataHandler);
    newBlockEvent.on('error', err => console.log('## block data error:', err));
    newBlockEvent.on('connected',_ => console.log('\nBot waiting for new blocks..!\n'));

    console.log('bot started.');
}

async function onDataHandler(blockHeader) {
    console.log('data received. block #', blockHeader.number);

    try {

        let uReserves, uReserve0, uReserve1, sReserves, sReserve0, sReserve1

        //obtaining eth price from uniswap, pretty accurate
        uReserves = await uPair0.methods.getReserves().call()
        uReserve0 = uReserves[0] //dai
        uReserve1 = uReserves[1] //eth
        priceEth = (uReserve0/uReserve1) //dai per eth
        // console.log('uPair0 uReserves:', uReserves);
            
        //token prices in eth, used bellow for determining if its possible to make a profit
        const priceToken0Eth = priceToken0*1/priceEth 
        const priceToken1Eth = priceToken1*1/priceEth 

        //tokens reserves on uniswap
        uReserves = await uPair1.methods.getReserves().call()
        uReserve0 = uReserves[0] //T0
        uReserve1 = uReserves[1] //T1
        // console.log('uPair1 uReserves:', uReserves, 'price:', uReserve0 / uReserve1);

        //tokens reserves on sushiswap
        sReserves = await sPair.methods.getReserves().call()
        sReserve0 = sReserves[0] //T0
        sReserve1 = sReserves[1] //T1
        // console.log('sPair sReserves:', sReserves, 'price:', sReserve0 / sReserve1);
        // const pa = sReserve0 / sReserve1;
        // const pb = aReserve1 / sReserve0;

        //compute amount that must be traded to maximize the profit and, trade direction; function provided by uniswap
        // first 2 are of A, second 2 are of B
        const result = await utils.methods.computeProfitMaximizingTrade(
            sReserve0,
            sReserve1, 
            uReserve0,
            uReserve1,
        ).call()
        console.log('computed:', result);

        const aToB = result[0] //trade direction
        const amountIn = result[1]

        // aToB means buy on A sell on B, here A is sushi and B is uni
        if (amountIn==0) {console.log(`No arbitrage opportunity on block ${blockHeader.number}\n`); return}
        
        if (aToB) { //T0->T1

            //amount of T1 received for swapping the precomputed amount of T0 on uniswap
            const amountOut = await uRouter.methods.getAmountOut(amountIn, uReserve0, uReserve1).call()
            // console.log('amountIn:', amountIn/10**18);
            // console.log('amountOut:', amountOut/10**18);
            //new reserves after trade
            const newUReserve0 = Number(uReserve0)+Number(amountIn)
            const newUReserve1 = Number(uReserve1)-Number(amountOut)
            // console.log('After Trade Reserves:\n uReserve0:', newUReserve0/10**18);
            // console.log('uReserve1:', newUReserve1/10**18);
            
            // console.log('sReserves:', sReserve0/10**18, sReserve1/10**18);
            //amount nedeed for repaying flashswap taken on sushiswap, used below
            const sAmountIn = await sRouter.methods.getAmountIn(amountIn, sReserve1, sReserve0).call()
            // console.log('flash loan repay amount on sushi:', sAmountIn);
            //sushiswap price
            const sPrice = 1/(sAmountIn/amountIn)//trade price
            // console.log('sushi price:', sPrice);
            //difference per T0 traded
            const difference =  amountOut/amountIn - 1/sPrice
            // console.log('difference:', difference);
            if (difference<=0) {console.log(`No arbitrage opportunity on block ${blockHeader.number}\n`); return}

            //total difference (difference*quantity traded)
            const totalDifference = difference*Math.round(amountIn/10**18)
            // console.log('total difference:', totalDifference);
            //time during the swap can be executed, after that it will be refused by uniswap
            const deadline = Math.round(Date.now()/1000)+validPeriod*60 
            
            //gas
            const gasNeeded = (0.3*10**6)*2 //previosly measured (line below), take to much time, overestimate 2x
            //const gasNeeded = await sPair.methods.swap(amountIn,0,addrArbitrager,abi).estimateGas()
            // console.log('gas needed:', gasNeeded);
            const gasPrice = await web3.eth.getGasPrice()
            const gasCost = Number(gasPrice)*gasNeeded/10**18
            // console.log('gas price:', gasPrice, 'gas cost:', gasCost);
            //profitable?
            const profit = (totalDifference*priceToken1Eth)-gasCost
            // console.log('profit:', profit);
            console.log(
                `Block ${blockHeader.number}`.bgBlue+`\n\n`+
                `${tkn0Name} (${tkn0Sym}) {T0} | ${tkn1Name} (${tkn1Sym}) {T1} reserves\n\n`+
                `On Uniswap\n`+
                `${tkn0Sym}: ${Math.round(uReserve0/10**18)} | ${tkn1Sym}: ${Math.round(uReserve1/10**18)}\n\n`+
                `On Sushiswap\n`+
                `${tkn0Sym}: ${Math.round(sReserve0/10**18)} | ${tkn1Sym}: ${Math.round(sReserve1/10**18)}\n\n`+
                `Swap's direction\n`+
                `${tkn0Sym} -> ${tkn1Sym}\n\n`+
                `Uniswap's pool state\n`+
                `${tkn1Sym} excess/${tkn0Sym} shortage\n\n`+
                `On Uniswap\n`+
                `Mid price before swap: ${(uReserve0/uReserve1).toFixed(2)} ${tkn0Sym}/${tkn1Sym}\n`+
                `Mid price after swap: ${(newUReserve0/newUReserve1).toFixed(2)} ${tkn0Sym}/${tkn1Sym}\n`+
                `Swap ${Math.round(amountIn/10**18)} ${tkn0Sym} for ${Math.round(amountOut/10**18)} ${tkn1Sym}\n`+
                `Trade price: ${(1/(amountOut/amountIn)).toFixed(2)} ${tkn0Sym}/${tkn1Sym} (buy price)\n\n`+
                `Sushiswap price: ${(sPrice).toFixed(2)} ${tkn0Sym}/${tkn1Sym} (sell price)\n`+
                `Difference: ${(difference).toFixed(2)} ${tkn1Sym}/${tkn0Sym}\n`+
                `Total difference: ${(totalDifference*priceToken1Eth).toFixed(5)} ETH or ${totalDifference.toFixed(2)} ${tkn1Sym}\n\n`+
                `Gas needed: ${gasNeeded/10**6}\n`+
                `Gas price: ${gasPrice/10**9} gwei\n`+
                `Gas cost: ${gasCost.toFixed(5)} ETH\n\n`+
                `${profit > 0 ? `Profit: ${profit.toFixed(5)} ETH or ${(profit*priceEth).toFixed(2)} DAI\n`.green: 
                `No profit! (gas cost higher than the total difference achievable)\n`.red}`
                )
            
            if (profit<=0) return;

            const abi = web3.eth.abi.encodeParameters(['uint256','uint256'], [sAmountIn,deadline])
            
            const tx = { //transaction
                from: myAccount, 
                to: sPair.options.address, 
                gas: gasNeeded, 
                data: sPair.methods.swap(amountIn,0,addrArbitrager,abi).encodeABI()
            }

            signedTx = await web3.eth.accounts.signTransaction(tx, privateKey);
            
            console.log('Tx pending')
            receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction)
            
            console.log(
                `Tx mined, trade executed!\n`+
                `Tx hash: ${receipt.transactionHash}\n`
                )

        } else {//T1->T0

            const amountOut = await uRouter.methods.getAmountOut(amountIn,uReserve1,uReserve0).call()
            const newUReverve0 = Number(uReserve0)-Number(amountOut)
            const newUReverve1 = Number(uReserve1)+Number(amountIn)
            const sAmountIn = await sRouter.methods.getAmountIn(amountIn,sReserve0 ,sReserve1).call()
            const sPrice = sAmountIn/amountIn
            const difference = amountOut/amountIn - sPrice

            if (difference<=0) {console.log(`No arbitrage opportunity on block ${blockHeader.number}\n`); return}

            const totalDifference = difference*Math.round(amountIn/10**18)
            const deadline = Math.round(Date.now()/1000)+validPeriod*60 
            const gasNeeded = (0.3*10**6)*2
            const gasPrice = await web3.eth.getGasPrice()
            const gasCost = Number(gasPrice)*gasNeeded/10**18
            const profit = (totalDifference*priceToken0Eth)-gasCost

            console.log(
                `Block ${blockHeader.number}`.bgBlue+`\n\n`+
                `${tkn0Name} (${tkn0Sym}) {T0} | ${tkn1Name} (${tkn1Sym}) {T1} reserves\n\n`+
                `On Uniswap\n`+
                `${tkn0Sym}: ${Math.round(uReserve0/10**18)} | ${tkn1Sym}: ${Math.round(uReserve1/10**18)}\n\n`+
                `On Sushiswap\n`+
                `${tkn0Sym}: ${Math.round(sReserve0/10**18)} | ${tkn1Sym}: ${Math.round(sReserve1/10**18)}\n\n`+
                `Swap's direction\n`+
                `${tkn1Sym} -> ${tkn0Sym}\n\n`+
                `Uniswap's pool state\n`+
                `${tkn0Sym} excess/${tkn1Sym} shortage\n\n`+
                `On Uniswap\n`+
                `Mid price before swap: ${(uReserve0/uReserve1).toFixed(2)} ${tkn0Sym}/${tkn1Sym}\n`+
                `Mid price after swap: ${(newUReverve0/newUReverve1).toFixed(2)} ${tkn0Sym}/${tkn1Sym}\n`+
                `Swap ${Math.round(amountIn/10**18)} ${tkn1Sym} for ${Math.round(amountOut/10**18)} ${tkn0Sym}\n`+
                `Trade price: ${(amountOut/amountIn).toFixed(2)} ${tkn0Sym}/${tkn1Sym} (sell price)\n\n`+
                `Sushiswap price: ${sPrice.toFixed(2)} ${tkn0Sym}/${tkn1Sym} (buy price)\n`+
                `Difference: ${(difference).toFixed(2)} ${tkn0Sym}/${tkn1Sym}\n`+
                `Total difference: ${(totalDifference*priceToken0Eth).toFixed(5)} ETH or ${totalDifference.toFixed(2)} ${tkn0Sym}\n\n`+
                `Gas needed: ${gasNeeded/10**6} M\n`+
                `Gas price: ${gasPrice/10**9} gwei\n`+
                `Gas cost: ${gasCost.toFixed(5)} ETH\n\n`+
                `${profit > 0 ? `Profit: ${profit.toFixed(5)} ETH or ${(profit*priceEth).toFixed(2)} DAI\n`.green :
                `No profit! (gas cost higher than the total difference achievable)\n`.red}`
                ) 
            
            if (profit<=0) return;

            const abi = web3.eth.abi.encodeParameters(['uint256','uint256'], [sAmountIn,deadline])
            const tx = { 
                from: myAccount, 
                to: sPair.options.address, 
                gas: gasNeeded, 
                data: sPair.methods.swap(0,amountIn,addrArbitrager,abi).encodeABI()
            }
            signedTx = await web3.eth.accounts.signTransaction(tx, privateKey);
            console.log('Tx pending')
            receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction)
            console.log(
                'Tx mined, trade executed!\n'+
                `Tx hash: ${receipt.transactionHash}\n`
                )
        
        }

    } 
    
    catch(er) {
        console.log('## Error in handling trade..');
        console.log('Error Details:', er);

    }

}




