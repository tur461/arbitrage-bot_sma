const { ADDRESS } = require("./constants");

const toStd  = v => v.toLocaleString('fullwide', {useGrouping: !1});

// dex 1 = d1 = UniSwap
// dex 2 (SushiSwap) = d2 = SushiSwap

function computeProfitMaximizingTrade(
    reserveA_dex2, 
    reserveB_dex2, 
    reserveA_dex1, 
    reserveB_dex1
) {
    const TbPV_d1 = reserveA_dex1 / reserveB_dex1;
    const TbPV_d2 = reserveA_dex2 / reserveB_dex2;
    const need2buy =  TbPV_d2 > TbPV_d1;
    console.log('reserve A dex 1 (UniSwap)', reserveA_dex1, 'reserve B dex 1 (UniSwap)', reserveB_dex1);
    console.log('reserve A dex 2 (SushiSwap)', reserveA_dex2, 'reserve B dex 2 (SushiSwap)', reserveB_dex2);
    console.log('Token 2 price value on dex 1 (UniSwap)', TbPV_d1);
    console.log('Token 2 price value on dex 2 (SushiSwap)', TbPV_d2);
    console.log('buy or sell:', need2buy ? 'BUY' : 'SELL');
    
    const reserveNumerator = need2buy ? reserveA_dex2 : reserveB_dex2; 
    const reserveDenominator = need2buy ? reserveB_dex2 : reserveA_dex2;
    
    const K = reserveA_dex1 * reserveB_dex1;
    const N = (K * reserveNumerator / reserveDenominator) * (1 + 0.003); // increased by 0.3% uniswap fee
    
    const lSide = Math.sqrt(N);
    const rSide = (need2buy ? reserveA_dex1 : reserveB_dex1) * (1 + 0.003); // increased by 0.3% uniswap fee
    const amtIn = lSide - Math.sqrt(rSide);

    return lSide < rSide ? [!1, 0] : [need2buy, toStd(amtIn)];
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