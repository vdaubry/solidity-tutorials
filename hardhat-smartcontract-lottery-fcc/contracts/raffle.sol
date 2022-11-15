// SPDX-License-Identifier: MIT

pragma solidity ^0.8.7;

import "@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol";
import "@chainlink/contracts/src/v0.8/VRFConsumerBaseV2.sol";
import "@chainlink/contracts/src/v0.8/interfaces/KeeperCompatibleInterface.sol";
import "hardhat/console.sol";

error Raffle__NotEnoughEthEnteredError();
error Raffle__TransfertFailedError();
error Raffle__RaffleNotOpenError();
error Raffle__upkeepNotReady();

contract Raffle is VRFConsumerBaseV2, KeeperCompatibleInterface {
    enum RaffleState {
        OPEN,
        CALCULATING
    }

    uint256 private immutable i_entranceFee;
    address payable[] private s_players;
    VRFCoordinatorV2Interface private immutable i_vrfCoordinator;
    bytes32 private immutable i_gasLane;
    uint64 private immutable i_subscriptionId;
    uint32 private immutable i_callbackGasLimit;
    uint32 private constant NUM_CONFIRMATIONS = 1;
    uint16 private constant REQUEST_CONFIRMATIONS = 3;

    address private s_currentWinner;
    RaffleState private s_raffleState;
    uint256 private s_lastRaffleTimestamp;
    uint256 private immutable i_interval;

    event RaffleEntered(address indexed player);
    event RequestraffleWinner(uint256 indexed RequestId);
    event WinnerPicked(address indexed winner);

    constructor(
        address vrfCoordinatorV2,
        uint64 subscriptionId,
        bytes32 gasLane,
        uint256 interval,
        uint256 _entranceFee,
        uint32 callbackGasLimit
    ) VRFConsumerBaseV2(vrfCoordinatorV2) {
        i_entranceFee = _entranceFee;
        i_vrfCoordinator = VRFCoordinatorV2Interface(vrfCoordinatorV2);
        i_gasLane = gasLane;
        i_subscriptionId = subscriptionId;
        i_callbackGasLimit = callbackGasLimit;

        s_raffleState = RaffleState.OPEN;
        s_lastRaffleTimestamp = block.timestamp;
        i_interval = interval;
    }

    function enterRaffle() public payable {
        if (msg.value < i_entranceFee) {
            revert Raffle__NotEnoughEthEnteredError();
        }
        if (s_raffleState != RaffleState.OPEN) {
            revert Raffle__RaffleNotOpenError();
        }

        s_players.push(payable(msg.sender));

        emit RaffleEntered(msg.sender);
    }

    function checkUpkeep(
        bytes memory /* checkData */ // memory instead of calldata to we can call it with string (cf checkUpkeep(""))
    )
        public
        override
        returns (
            bool upKeepNeeded,
            bytes memory /* performData */
        )
    {
        // needs to be public for this contract + other contract to be allowed to call it
        bool isOpen = (s_raffleState == RaffleState.OPEN);
        bool timeHasPassed = (block.timestamp - s_lastRaffleTimestamp) > i_interval;
        bool hasPlayers = s_players.length > 0;
        bool hasBalance = address(this).balance > 0;
        upKeepNeeded = isOpen && timeHasPassed && hasPlayers && hasBalance;
    }

    function performUpkeep(
        bytes calldata /* performData */
    ) external override {
        // external because any other smart contract (i.e: chainlink) is allowed to call it
        (bool upkeepNeeded, ) = checkUpkeep("");
        if (!upkeepNeeded) {
            revert Raffle__upkeepNotReady();
        }

        s_raffleState = RaffleState.CALCULATING;
        uint256 requestId = i_vrfCoordinator.requestRandomWords(
            i_gasLane,
            i_subscriptionId,
            REQUEST_CONFIRMATIONS,
            i_callbackGasLimit,
            NUM_CONFIRMATIONS
        );

        // This is redundant and should be removed : use the event 'RandomWordsRequested' from chainlink VRFCoordinatorV2 instead
        emit RequestraffleWinner(requestId);
    }

    function fulfillRandomWords(
        uint256, /*requestId*/ // unused parameter, we comment it
        uint256[] memory randomWords
    ) internal override {
        uint256 indexOfWinner = randomWords[0] % s_players.length;
        address payable winner = s_players[indexOfWinner];
        s_currentWinner = winner;

        (bool success, ) = winner.call{value: address(this).balance}("");
        if (!success) {
            revert Raffle__TransfertFailedError();
        }

        s_players = new address payable[](0);
        s_raffleState = RaffleState.OPEN;
        s_lastRaffleTimestamp = block.timestamp;

        emit WinnerPicked(winner);
    }

    function getEntranceFee() public view returns (uint256) {
        return i_entranceFee;
    }

    function getPlayer(uint256 index) public view returns (address) {
        return s_players[index];
    }

    function getCurrentWinner() public view returns (address) {
        return s_currentWinner;
    }

    function getRaffleState() public view returns (RaffleState) {
        return s_raffleState;
    }

    function getInterval() public view returns (uint256) {
        return i_interval;
    }

    function getCoordinator() public view returns (VRFCoordinatorV2Interface) {
        return i_vrfCoordinator;
    }

    function getLastRaffleTimestamp() public view returns (uint256) {
        return s_lastRaffleTimestamp;
    }
}
