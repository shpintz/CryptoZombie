/* eslint-disable @typescript-eslint/camelcase */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-use-before-define */
import React, { useEffect, useState } from 'react';
import Web3 from 'web3';
import { ToastContainer, toast } from 'react-toastify';
import './app.scss';
import 'react-toastify/dist/ReactToastify.css';

import { ZombieFactoryWrapper } from '../lib/contracts/ZombieFactoryWrapper';

import { PolyjuiceHttpProvider } from '@polyjuice-provider/web3';
import { CONFIG } from '../config';

import { AddressTranslator } from 'nervos-godwoken-integration';

// erc 20
import * as CompiledContractArtifact from '../../build/contracts/ERC20.json';

async function createWeb3() {
    // Modern dapp browsers...
    if ((window as any).ethereum) {
        const godwokenRpcUrl = CONFIG.WEB3_PROVIDER_URL;
        const providerConfig = {
            rollupTypeHash: CONFIG.ROLLUP_TYPE_HASH,
            ethAccountLockCodeHash: CONFIG.ETH_ACCOUNT_LOCK_CODE_HASH,
            web3Url: godwokenRpcUrl
        };
        const provider = new PolyjuiceHttpProvider(godwokenRpcUrl, providerConfig);
        const web3 = new Web3(provider || Web3.givenProvider);


        try {
            // Request account access if needed
            await (window as any).ethereum.enable();
        } catch (error) {
            // User denied account access...
        }

        return web3;
    }

    console.log('Non-Ethereum browser detected. You should consider trying MetaMask!');
    return null;
}

export function App() {
    const [web3, setWeb3] = useState<Web3>(null);
    const [contract, setContract] = useState<ZombieFactoryWrapper>();
    const [accounts, setAccounts] = useState<string[]>();
    const [balance, setBalance] = useState<bigint>();
    const [existingContractIdInputValue, setExistingContractIdInputValue] = useState<string>();
    const [transactionInProgress, setTransactionInProgress] = useState(false);
    const toastId = React.useRef(null);

  
    
    // Zombie config
    const [urlName,setUrlName] = useState('');
    const [zombieName,setZombieName] = useState('');
    const [listZombies, setListZombies] = useState([]);
    
    // godwoken polyjuice
    const [polyjuiceAddress, setPolyjuiceAddress] = useState('');
    const [deployTxHash,setDeployTxHash] = useState('')

    // L1 -> l2
    const [depositAccount, setDepositAccount] = useState<string | undefined>();
    const [sudtBalance, setSudtBalance] = useState<bigint>();

    // Proxycontract
    const SUDT_PROXY_CONTRACT_ADDRESS = "0x2195AcD15Accc546eaab354c34C2e0eE5c734bd9";
    

    // Polyjuice account gets produced with etherum address
    useEffect(() => {
        if (accounts?.[0]) {
            const addressTranslator = new AddressTranslator();
            setPolyjuiceAddress(addressTranslator.ethAddressToGodwokenShortAddress(accounts?.[0]));

            // Layer deposit account gets produced with etherum address
            addressTranslator.getLayer2DepositAddress(web3,accounts?.[0]).then(_dAdr => {
                setDepositAccount(_dAdr.addressString);
                console.log(`Layer 2 Deposit Address on Layer 1: \n${_dAdr.addressString}`);
            });

        } else {
            setPolyjuiceAddress(undefined);

            setDepositAccount(undefined);
        }
    }, [accounts?.[0]]);

    // Checks-sudt-balance
    useEffect(() =>{

        if(polyjuiceAddress){
            const contract = new web3.eth.Contract(CompiledContractArtifact.abi as any, SUDT_PROXY_CONTRACT_ADDRESS);
            contract.methods.balanceOf(polyjuiceAddress).call({
                from: accounts?.[0]
            }).then((_sudtBalance : any) => setSudtBalance(BigInt(Number(_sudtBalance))));
        }
    },[polyjuiceAddress])
    


    useEffect(() => {
        if (transactionInProgress && !toastId.current) {
            toastId.current = toast.info(
                'Transaction in progress. Confirm MetaMask signing dialog and please wait...',
                {
                    position: 'top-right',
                    autoClose: false,
                    hideProgressBar: false,
                    closeOnClick: false,
                    pauseOnHover: true,
                    draggable: true,
                    progress: undefined,
                    closeButton: false
                }
            );
        } else if (!transactionInProgress && toastId.current) {
            toast.dismiss(toastId.current);
            toastId.current = null;
        }
    }, [transactionInProgress, toastId.current]);

    const account = accounts?.[0];

    // Grab list of zombies
    useEffect(() => {
        if (contract) {
            setInterval(() => {
                contract.getListZombies(account).then(setListZombies);
            }, 10000);
        }
    }, [contract]);

    async function deployContract() {
        const _contract = new ZombieFactoryWrapper(web3);

        try {
            setDeployTxHash(undefined);
            setTransactionInProgress(true);

            const transactionHash = await _contract.deploy(account);

            setDeployTxHash(transactionHash);
            setExistingContractAddress(_contract.address);
            toast(
                'Successfully deployed a smart-contract. You can now proceed to get or set the value in a smart contract.',
                { type: 'success' }
            );
        } catch (error) {
            console.error(error);
            toast('There was an error sending your transaction. Please check developer console.');
        } finally {
            setTransactionInProgress(false);
        }
    }


    async function setExistingContractAddress(contractAddress: string) {
        const _contract = new ZombieFactoryWrapper(web3);
        _contract.useDeployed(contractAddress.trim());

        setContract(_contract);
    }

    // Create Zombie Function
    async function createRandomZombie() {
        try {
            setTransactionInProgress(true);
            await contract.createRandomZombie(zombieName, urlName, account);
            
            toast(
                'Successfully Created Zombie.',
                { type: 'success' }
            );
        } catch (error) {
            console.error(error);
            toast.error('Fail to create Zombie');
        } finally {
            setTransactionInProgress(false);
        }
    }



    useEffect(() => {
        if (web3) {
            return;
        }

        (async () => {
            const _web3 = await createWeb3();
            setWeb3(_web3);

            const _accounts = [(window as any).ethereum.selectedAddress];
            setAccounts(_accounts);
            console.log({ _accounts });

            if (_accounts && _accounts[0]) {
                const _l2Balance = BigInt(await _web3.eth.getBalance(_accounts[0]));
                setBalance(_l2Balance);
            }
        })();
    });

    const LoadingIndicator = () => <span className="rotating-icon">⚙️</span>;

    return (
        <div>

            <header>
                <p>Your ETH address: <b>{accounts?.[0]}</b></p>
                <p>Your Polyjuice address: <b>{polyjuiceAddress || ' - '}</b></p>
                <p>Nervos Layer 2 balance:{' '} <b>{balance ? (balance / 10n ** 8n).toString() : <LoadingIndicator />} ETH</b></p>
                <p>Deployed contract address: <b>{contract?.address || '-'}</b></p> 
                <p>Deploy transaction hash: <b>{deployTxHash || '-'}</b></p>
            </header>
            
        
            <div className="section-one">
                <p>
                    The button below will deploy a ZombieFactory smart contract where you can store a
                    zombie. Basically like a little home hahah. After the contract is deployed you can either
                    read stored value from smart contract or set a new one. You can do that using the
                    interface below.
                </p>
                <button onClick={deployContract} disabled={!balance}>
                    Deploy contract
                </button>
                &nbsp;or&nbsp;
                <input
                    placeholder="Existing contract id"
                    onChange={e => setExistingContractIdInputValue(e.target.value)}
                />
                <button
                    disabled={!existingContractIdInputValue || !balance}
                    onClick={() => setExistingContractAddress(existingContractIdInputValue)}
                >
                    Use existing contract
                </button>
            </div>

            <div className="section-three">
                <h2>Need to deposit into layer 2?</h2>
                <p>Get your funds transfer through our force bridge where you can use those assets</p>
                <p>Your SUDT contract address: {SUDT_PROXY_CONTRACT_ADDRESS}</p>
                <a href="https://force-bridge-test.ckbapp.dev/bridge/Ethereum/Nervos?xchain-asset=0x0000000000000000000000000000000000000000" target="_blank" >Transfer Now</a>

                <div>
                    <ul>
                        <li>Layer2 Deposit Recipient: {depositAccount || ' - '}</li>
                        <li>Nervos Layer2(godwoken) sudt balance: {sudtBalance ? (sudtBalance).toString() : <LoadingIndicator />} SUDT</li>
                    </ul>
                </div>
            </div>

           
            <div className="section-two">
                <h3> Zombie NFT Factory 1.0</h3>
                <input
                    type="string"
                    placeholder="Enter Zombie url"
                    onChange={e => setUrlName(e.target.value)}
                />
                <input
                    type="string"
                    placeholder="Zombie Name"
                    onChange={e => setZombieName(e.target.value)}
                />

                <button onClick={createRandomZombie} disabled={!contract}>  
                    Create Zombie
                </button>
                <br />

                <div className="zombieFactory">
                    <h3> Zombies Gallery</h3>
                    <div className="zombies">
                         {listZombies.map(data => { 
                            return (
                                 <div className="singleZombie">
                                    <img key={data[0]} src={data[1]} style={{ width: 200, height: 200, border: '2px solid black' , borderRadius:10 }} />
                                    <div className="content">
                                        <p>Level:{data[3]} </p>
                                        <p>DNA: {data[2]}</p>
                                        <p>Name:{data[0]} </p>
                                    </div>
                                </div> 

            
                            )
                         })} 
                    </div>
                 </div>
            </div>



            <br />
                <p>Smile things will be done shortly</p>
            <br />
            <br />
            <br />
            <hr />
            <ToastContainer />
        </div>
    );
}