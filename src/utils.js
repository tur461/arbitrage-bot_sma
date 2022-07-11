const { ADDRESS } = require("./constants");

const toStd  = v => v.toLocaleString('fullwide', {useGrouping: !1});

function computeProfitMaximizingTrade(
    trueTknPriceA, 
    trueTknPriceB, 
    reserveA, 
    reserveB
) {
    const M = reserveA * trueTknPriceB / reserveB;
    const aToB = trueTknPriceA > M;
    
    const priceNum = aToB ? trueTknPriceA : trueTknPriceB; 
    const priceDen = aToB ? trueTknPriceB : trueTknPriceA;
    
    const K = reserveA * reserveB;
    const N = (K * priceNum / priceDen) * (1 + 0.003); // increased by 0.3% uniswap fee
    
    const lSide = Math.sqrt(N);
    const rSide = (aToB ? reserveA : reserveB) * (1 + 0.003); // increased by 0.3% uniswap fee
    const amtIn = lSide - rSide;

    return lSide < rSide ? [!1, 0] : [aToB, toStd(amtIn)];
}

function isAddr(addr) {
    if(
        addr &&
        addr.length && 
        addr.length === 42 && 
        addr.substring(0,2) === '0x' && 
        addr !== ADDRESS.ZERO
    ) return !0;
    return !1;
}

function exit() {
    console.log('terminating the process / thread peacefully..');
    process.exit(0);
}

module.exports = {
    exit,
    isAddr,
    computeProfitMaximizingTrade,
}