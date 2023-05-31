const Lottery = artifacts.require("Lottery");
const assertRevert = require('./assertRevert');
const expectEvent = require('./expectEvent');

contract('Lottery', function([deployer, user1, user2]){
    let lottery;
    let betAmount = 5 * 10 ** 15;
    let betAmountBN = new web3.utils.BN('5000000000000000');
    let bet_block_interval = 3;

    beforeEach(async () => {
        lottery = await Lottery.new();
    })

    it('getPot should return current pot', async () => {
        let pot = await lottery.getPot();
        assert.equal(pot, 0)
    })

    describe('Bet', function() {
        it('should fail when the bet money is not 0.005 ETH', async () => {
            // Fail transaction
            // transaction object : { chainId, value, to, from, gas(Limit), gasPrice }
            await assertRevert(lottery.bet('0xab', {from : user1, value : 4000000000000000}))
        })
        it('should put the bet to the bet queue with 1 bet', async () => {
            // bet
            let receipt = await lottery.bet('0xab', {from : user1, value : betAmount})
            // console.log(receipt);
            
            let pot = await lottery.getPot();
            assert.equal(pot, 0);

            // check contract balance == 0.005
            let contractBalance = await web3.eth.getBalance(lottery.address);
            assert.equal(contractBalance, betAmount);

            // check bet info
            let currentBlockNumber = await web3.eth.getBlockNumber();

            let bet = await lottery.getBetInfo(0);
            assert.equal(bet.answerBlockNumber, currentBlockNumber + bet_block_interval);
            assert.equal(bet.bettor, user1);
            assert.equal(bet.challenges, '0xab');

            // check log
            await expectEvent.inLogs(receipt.logs, 'BET');

        })
    })

    describe('isMatch', function() {
        let blockHash = '0x948063becaf0cca37e41eed2ad2998573a2dc1ab0e1b59d1e36666008cf5b309'
        it('should be BettingResult.Win when two characters match', async () => {
            let matchingResult = await lottery.isMatch('0x94', blockHash);
            assert.equal(matchingResult, 1);
        })
        it('should be BettingResult.Fail when two characters dismatch', async () => {
            let matchingResult = await lottery.isMatch('0xab', blockHash);
            assert.equal(matchingResult, 0);
        })
        it('should be BettingResult.Draw when one characters match', async () => {
            let matchingResult = await lottery.isMatch('0x9b', blockHash);
            assert.equal(matchingResult, 2);

            matchingResult = await lottery.isMatch('0xa4', blockHash);
            assert.equal(matchingResult, 2);
        })
    })

    describe('Distribute', function() {
        describe('When the answer is checkable', function () {
            it('should give the user the pot when the answer matches', async () => {
                await lottery.setAnswerForTest('0x948063becaf0cca37e41eed2ad2998573a2dc1ab0e1b59d1e36666008cf5b309', {from:deployer})

                await lottery.betAndDistribute('0xab', {from:user2, value:betAmount})   // 1 -> 4 block
                await lottery.betAndDistribute('0xab', {from:user2, value:betAmount})   // 2 -> 5 block
                await lottery.betAndDistribute('0x94', {from:user1, value:betAmount})   // 3 -> 6 block
                await lottery.betAndDistribute('0xab', {from:user2, value:betAmount})   // 4 -> 7 block
                await lottery.betAndDistribute('0xab', {from:user2, value:betAmount})   // 5 -> 8 block
                await lottery.betAndDistribute('0xab', {from:user2, value:betAmount})   // 6 -> 9 block

                let potBefore = await lottery.getPot(); // 0.01 ETH
                let user1BalanceBefore = await web3.eth.getBalance(user1);

                let receipt7 = await lottery.betAndDistribute('0xab', {from:user2, value:betAmount})   // 7 -> 10 block    transfer pot money to user 1

                let potAfter = await lottery.getPot();  // 0
                let user1BalanceAfter = await web3.eth.getBalance(user1);   // before + 0.015 ETH

                // change of pot
                assert.equal(potBefore.toString(), new web3.utils.BN('10000000000000000').toString())
                assert.equal(potAfter.toString(), new web3.utils.BN('0').toString())

                // change of user1 balance
                user1BalanceBefore = new web3.utils.BN(user1BalanceBefore)
                assert.equal(user1BalanceBefore.add(potBefore).add(betAmountBN).toString(), new web3.utils.BN(user1BalanceAfter).toString())
            })

            it('should give the user the amount he bet when as single character matches', async () => {
                await lottery.setAnswerForTest('0x948063becaf0cca37e41eed2ad2998573a2dc1ab0e1b59d1e36666008cf5b309', {from:deployer})

                await lottery.betAndDistribute('0xab', {from:user2, value:betAmount})   // 1 -> 4 block
                await lottery.betAndDistribute('0xab', {from:user2, value:betAmount})   // 2 -> 5 block
                await lottery.betAndDistribute('0x9b', {from:user1, value:betAmount})   // 3 -> 6 block
                await lottery.betAndDistribute('0xab', {from:user2, value:betAmount})   // 4 -> 7 block
                await lottery.betAndDistribute('0xab', {from:user2, value:betAmount})   // 5 -> 8 block
                await lottery.betAndDistribute('0xab', {from:user2, value:betAmount})   // 6 -> 9 block

                let potBefore = await lottery.getPot(); // 0.01 ETH
                let user1BalanceBefore = await web3.eth.getBalance(user1);

                let receipt7 = await lottery.betAndDistribute('0xab', {from:user2, value:betAmount})   // 7 -> 10 block    transfer pot money to user 1

                let potAfter = await lottery.getPot();  // 0.01 ETH
                let user1BalanceAfter = await web3.eth.getBalance(user1);   // before + 0.005 ETH

                // change of pot
                assert.equal(potBefore.toString(), potAfter.toString());

                // change of user1 balance
                user1BalanceBefore = new web3.utils.BN(user1BalanceBefore)
                assert.equal(user1BalanceBefore.add(betAmountBN).toString(), new web3.utils.BN(user1BalanceAfter).toString())
            })

            it('should get the eth of user when the answer does not match at all', async () => {
                await lottery.setAnswerForTest('0x948063becaf0cca37e41eed2ad2998573a2dc1ab0e1b59d1e36666008cf5b309', {from:deployer})

                await lottery.betAndDistribute('0xab', {from:user2, value:betAmount})   // 1 -> 4 block
                await lottery.betAndDistribute('0xab', {from:user2, value:betAmount})   // 2 -> 5 block
                await lottery.betAndDistribute('0xef', {from:user1, value:betAmount})   // 3 -> 6 block
                await lottery.betAndDistribute('0xab', {from:user2, value:betAmount})   // 4 -> 7 block
                await lottery.betAndDistribute('0xab', {from:user2, value:betAmount})   // 5 -> 8 block
                await lottery.betAndDistribute('0xab', {from:user2, value:betAmount})   // 6 -> 9 block

                let potBefore = await lottery.getPot(); // 0.01 ETH
                let user1BalanceBefore = await web3.eth.getBalance(user1);

                let receipt7 = await lottery.betAndDistribute('0xab', {from:user2, value:betAmount})   // 7 -> 10 block    transfer pot money to user 1

                let potAfter = await lottery.getPot();  // 0.015 ETH
                let user1BalanceAfter = await web3.eth.getBalance(user1);   // before

                // change of pot
                assert.equal(potBefore.add(betAmountBN).toString(), potAfter.toString());

                // change of user1 balance
                user1BalanceBefore = new web3.utils.BN(user1BalanceBefore)
                assert.equal(user1BalanceBefore.toString(), new web3.utils.BN(user1BalanceAfter).toString())
            })
        })
        describe('When the answer is not revealed(Not Mined)', function() {

        })

        describe('When the answer is not revealed(Block limit is passed)', function() {

        })
    })


});
