const { ADDRESS } = require("./constants");

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
}