pragma solidity ^0.4.24;

import "../node_modules/@ganache/console.log/console.sol";
import "../node_modules/openzeppelin-solidity/contracts/math/SafeMath.sol";

contract FlightSuretyData {
    using SafeMath for uint256;

    /********************************************************************************************/
    /*                                       DATA VARIABLES                                     */
    /********************************************************************************************/

    address private contractOwner; // Account used to deploy the contract
    mapping(address => bool) private authorizedContracts; // App contract(s) authorized by the data contract     
    bool private operational = true; // Blocks all state changes throughout the contract if false

    // Airlines
    struct Airline {
        bool isRegistered;
        bool isFunded;
        uint256 fundAmount;
    }
    mapping(address => Airline) private airlines;
    uint256 private registeredAirlinesCounter;

    // Flights
    struct Flight {
        bool isRegistered;
        address airline;
        string flightName;
        uint256 timestamp;
    }
    mapping(bytes32 => Flight) private flights;

    // Passengers
    struct Passenger {
        address passengerAccount;
        mapping (bytes32 => uint256) insuredFlights; // key: flight key, value: insured amount
        uint256 accountBalance; // for the Insurance payout
    }
    mapping(address => Passenger) private passengers;
    address[] private passengerAccounts;  // Only those who have paid are stored here
    uint256 insureesContributedFunds = 0;

    /********************************************************************************************/
    /*                                       EVENT DEFINITIONS                                  */
    /********************************************************************************************/

    /**
     * @dev Constructor
     *      The deploying account becomes contractOwner
     */
    constructor(address firstAirlineAddress) public {
        contractOwner = msg.sender;
        authorizedContracts[msg.sender] = true;
        airlines[firstAirlineAddress] = Airline(true, false, 0);
        registeredAirlinesCounter = registeredAirlinesCounter.add(1);
    }

    /********************************************************************************************/
    /*                                       FUNCTION MODIFIERS                                 */
    /********************************************************************************************/

    /**
     * @dev Modifier that requires the "operational" boolean variable to be "true"
     *      This is used on all state changing functions to pause the contract in
     *      the event there is an issue that needs to be fixed
     */
    modifier requireIsOperational() {
        require(operational, "Contract is currently not operational");
        _; // All modifiers require an "_" which indicates where the function body will be added
    }

    /**
     * @dev Modifier that requires the "ContractOwner" account to be the function caller
     */
    modifier requireContractOwner() {
        require(msg.sender == contractOwner, "Caller is not contract owner");
        _;
    }

    /**
     * @dev Modifier that requires the function caller to be authorized
     */
    modifier requireAuthorizedCaller() {
        require(authorizedContracts[msg.sender] == true, "Caller is not authorized to call this contract");
        _;
    }

    /********************************************************************************************/
    /*                                       UTILITY FUNCTIONS                                  */
    /********************************************************************************************/

    /**
     * @dev Get operating status of contract
     *
     * @return A bool that is the current operating status
     */
    function isOperational() public view returns (bool) {
        return operational;
    }

    /**
     * @dev Sets contract operations on/off
     *
     * When operational mode is disabled, all write transactions except for this one will fail
     */
    function setOperatingStatus(bool mode) external requireContractOwner {
        operational = mode;
    }

    function authorizeCaller(address caller) external requireContractOwner {
        authorizedContracts[caller] = true;
    }

    function deauthorizeCaller(address caller) external requireContractOwner {
        authorizedContracts[caller] = false;
    }

    function isAirlineRegistered(address airline) public view returns(bool) {
        return airlines[airline].isRegistered;
    }

    function isAirlineFunded(address airline) public view returns(bool) {
        return airlines[airline].fundAmount > 0;
    }

    function getNumberOfRegisteredAirlines() external view returns(uint256) {
    return registeredAirlinesCounter;
    }

    function getFunds(address airline) public view returns(uint256) {
        return airlines[airline].fundAmount;
    }

    function isFlightRegistered(bytes32 key) public view returns(bool) {
        return flights[key ].isRegistered;
    }

    function isPassengerInsured(address passengerAccount, bytes32 flightKey) public view returns(bool) {
        return passengers[passengerAccount].insuredFlights[flightKey] > 0;
    }

    function getPassengerPayment(address passengerAccount, bytes32 flightKey) public view returns(uint256) {
        return passengers[passengerAccount].insuredFlights[flightKey];
    }

    function getPassengerBalance(address passengerAccount) public view returns(uint256) {
        return passengers[passengerAccount].accountBalance;
    }

    /********************************************************************************************/
    /*                                     SMART CONTRACT FUNCTIONS                             */
    /********************************************************************************************/

    /**
     * @dev Add an airline to the registration queue
     *      Can only be called from FlightSuretyApp contract
     *
     */
    function registerAirline(address newAirline) requireIsOperational requireAuthorizedCaller external {
        // require(airlines[msg.sender].isFunded, "Registering airline is not funded");
        airlines[newAirline] = Airline(true, false, 0);
        registeredAirlinesCounter = registeredAirlinesCounter.add(1);
    }

        /**
     * @dev Register a future flight for insuring.
     *
     */
    function registerFlight(address airline, string flightName, uint256 timestamp) requireIsOperational external {
        bytes32 key = getFlightKey(airline, flightName, timestamp);

        flights[key] = Flight(true, airline, flightName, timestamp);
    }

    /**
     * @dev Buy insurance for a flight
     *
     */
    function buy(bytes32 flightKey, address passengerAccount, uint256 insuredAmount) requireIsOperational requireAuthorizedCaller external payable {
        require(passengers[passengerAccount].insuredFlights[flightKey] == 0, "You have already paid insurance for this flight");

        passengers[passengerAccount] = Passenger({ passengerAccount: passengerAccount, accountBalance: 0 });
        passengers[passengerAccount].insuredFlights[flightKey] = insuredAmount;
        passengerAccounts.push(passengerAccount);
        insureesContributedFunds = insureesContributedFunds.add(insuredAmount);
    }

    /**
     *  @dev Credits payouts to insurees
     */
    function creditInsurees(address airline, string flightName, uint256 timestamp, uint8 paymentPercentage) requireIsOperational requireAuthorizedCaller external {
        bytes32 flightKey = getFlightKey(airline, flightName, timestamp);
        address passengerAccount;

        for (uint256 i = 0; i < passengerAccounts.length; i++) {
            passengerAccount = passengerAccounts[i];
            passengers[passengerAccount].accountBalance = passengers[passengerAccount].insuredFlights[flightKey].mul(paymentPercentage).div(100);
        }
    }

    /**
     *  @dev Transfers eligible payout funds to insuree
     *
     */
    function pay(address insuree) requireIsOperational requireAuthorizedCaller external payable {
        require(getPassengerBalance(insuree) > 0, 'You do not have any payment due');

        uint256 insurancePayout = getPassengerBalance(insuree);        
        passengers[insuree].accountBalance = 0; // This is ok because this value gets overwritten for each flighr if gets delayed
        insuree.transfer(insurancePayout);
    }

    /**
     * @dev Initial funding for the insurance. Unless there are too many delayed flights
     *      resulting in insurance payouts, the contract should be self-sustaining
     *
     */
    // function fund(address airline) requireIsOperational requireAuthorizedCaller external payable {
    function fund(address airline, uint256 amount) requireIsOperational requireAuthorizedCaller external payable {
        airlines[airline].fundAmount = amount;
        airlines[airline].isFunded = true;
    }

    function getFlightKey(
        address airline,
        string memory flight,
        uint256 timestamp
    ) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(airline, flight, timestamp));
    }

    /**
     * @dev Fallback function for funding smart contract.
     *
     */
    // function() external payable {
    //     fund();
    // }
    function () payable external {}
}
