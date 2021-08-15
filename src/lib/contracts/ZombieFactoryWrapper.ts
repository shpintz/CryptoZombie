import Web3 from 'web3';
import * as ZombieFactoryJSON from '../../../build/contracts/ZombieFactory.json';
import { ZombieFactory } from '../../types/ZombieFactory';

const DEFAULT_SEND_OPTIONS = {
    gas: 6000000
};

export class ZombieFactoryWrapper {
    web3: Web3;

    contract: ZombieFactory;

    address: string;

    constructor(web3: Web3) {
        this.web3 = web3;
        this.contract = new web3.eth.Contract(ZombieFactoryJSON.abi as any) as any;
    }

    get isDeployed() {
        return Boolean(this.address);
    }


    async getListZombies(address: string) {
        const totalNft = await this.contract.methods.getZombieLength().call({ from: address });
        console.log(totalNft);
        const arrNFT = new Array(Number(totalNft)).fill(0).map((_, index) => index);

        const data = await Promise.all(
            arrNFT.map(_nftId =>
                this.contract.methods.getZombie((_nftId).toString()).call({
                    from: address
                })
            )
        );
        
        return data;
    }


    async createRandomZombie(name: string, imgURL: string, fromAddress: string) {

        const tx = await this.contract.methods.createRandomZombie(name, imgURL).send({
            ...DEFAULT_SEND_OPTIONS,
            from: fromAddress,
            // value
        });
        
        return tx;
    }
    

    async deploy(fromAddress: string) {
        const deployTx = await (this.contract
            .deploy({
                data: ZombieFactoryJSON.bytecode,
                arguments: []
            })
            .send({
                ...DEFAULT_SEND_OPTIONS,
                from: fromAddress,
                to: '0x0000000000000000000000000000000000000000'
            } as any) as any);

        this.useDeployed(deployTx.contractAddress);

        return deployTx.transactionHash;
    }

    useDeployed(contractAddress: string) {
        this.address = contractAddress;
        this.contract.options.address = contractAddress;
    }
}