require('dotenv').config();
const Web3 = require('web3');
const { CHAIN } = require("./constants");
const HDWalletProvider = require("@truffle/hdwallet-provider");

const NMC = process.env.MNEMONIC;  
const pvtKey = process.env.PRIVATE_KEY;
const infuraToken = process.env.INFURA_TOKEN;
const moralisToken = process.env.MORALIS_TOKEN;

const LOCAL_URL = 'http://localhost:8545';
const LOCAL_URL_WS = 'http://localhost:8545';
const BSC_URL = `https://speedy-nodes-nyc.moralis.io/${moralisToken}/bsc/testnet`;
const BSC_URL_WS = `wss://speedy-nodes-nyc.moralis.io/${moralisToken}/bsc/testnet/ws`;
const ETHEREUM_URL = `https://speedy-nodes-nyc.moralis.io/${moralisToken}/eth/rinkeby`;
const ETHEREUM_URL_WS = `wss://speedy-nodes-nyc.moralis.io/${moralisToken}/eth/rinkeby/ws`;

let web3=null, myAccount='0x', chainId=-1, accObj=null;

const getContract = p => new web3.eth.Contract(...p);

async function switchChain(chain, isWS) {
    console.log(`Switching chain to ${chain}..`);
    let provider=null, url=null;
    switch(chain) {
        case CHAIN.BSC: url = isWS ? BSC_URL_WS : BSC_URL; break;
        case CHAIN.LOCAL: url = isWS ? LOCAL_URL_WS : LOCAL_URL; break;
        case CHAIN.ETHEREUM: url = isWS ? ETHEREUM_URL_WS : ETHEREUM_URL; break;
        default: url = console.log('Err: Switching to an invalid chain!');
    }
    if(url) {
        provider = isWS ? 
        new Web3.providers.WebsocketProvider(url) :
        new HDWalletProvider(NMC, url);
        web3 = new Web3(provider);
        myAccount = (await web3.eth.getAccounts())[0];
        if(!myAccount) {
            accObj = await web3.eth.accounts.privateKeyToAccount(pvtKey);
            myAccount = accObj.address;
        }
        chainId = await web3.eth.getChainId();
        console.log(
            'account:', myAccount, 
            'chainId:', chainId
        );
    } else {web3 = null; myAccount='0x'; chainId=-1}
    return {web3, myAccount, chainId};
}

module.exports = {
    getContract,
    switchChain,
}