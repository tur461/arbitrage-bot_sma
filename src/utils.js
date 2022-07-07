const { ADDRESS } = require("./constants");

const xpand  = v => v.toLocaleString('fullwide', {useGrouping: !1});

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
    const N = (K * priceNum / priceDen) * (1 + 0.003);
    const lSide = Math.sqrt(N);
    const rSide = (aToB ? reserveA : reserveB) * (1 + 0.003);
    const amtIn = lSide - rSide;
    return lSide < rSide ? [!1, 0] : [aToB, xpand(amtIn)];
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