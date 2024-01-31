pragma solidity ^0.4.24;

import "../node_modules/openzeppelin-solidity/contracts/math/SafeMath.sol";
import "../node_modules/@ganache/console.log/console.sol";

/************************************************** */
/* FlightSurety Smart Contract                      */
/************************************************** */
contract FlightSuretyApp {
    using SafeMath for uint256; // Allow SafeMath functions to be called for all uint256 types (similar to "prototype" in Javascript)

    FlightSuretyData flightSuretyData;

    /********************************************************************************************/
    /*                                       DATA VARIABLES                                     */
    /********************************************************************************************/

    uint256 public AIRLINE_REGISTRATION_FEE = 10 ether;
    uint256 private CONSENSUS_THRESHOLD = 4; // Max number of airlines without consensus rule
    uint256 MAX_INSURANCE_AMOUNT = 1 ether;

    mapping(address => mapping(address => bool)) private votersPerAirline; // Nested mapping for Airline => Voters
    mapping(address => uint256) private votesPerAirline; // Nested mapping for Airline => Votes

    // Flight status codees
    uint8 private constant STATUS_CODE_UNKNOWN = 0;
    uint8 private constant STATUS_CODE_ON_TIME = 10;
    uint8 private constant STATUS_CODE_LATE_AIRLINE = 20;
    uint8 private constant STATUS_CODE_LATE_WEATHER = 30;
    uint8 private constant STATUS_CODE_LATE_TECHNICAL = 40;
    uint8 private constant STATUS_CODE_LATE_OTHER = 50;

    uint8 private constant INSURANCE_PAYOUT_PERCENTAGE = 150;

    address private contractOwner; // Account used to deploy the contract
    bool private operational = true; 

    /********************************************************************************************/
    /*                                       FUNCTION MODIFIERS                                 */
    /********************************************************************************************/

    /**
     * @dev Modifier that requires the "operational" boolean variable to be "true"
     *      This is used on all state changing functions to pause the contract in
     *      the event there is an issue that needs to be fixed
     */
    modifier requireIsOperational() {
        // Modify to call data contract's status
        require(true, "Contract is currently not operational");
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
     * @dev Modifier that requires the airline to be registered
     */
     modifier requireAirlineRegistered() {
         require(isAirlineRegistered(msg.sender), "This airline is not registered");
         _;
     }

    /**
     * @dev Modifier that requires the airline to be funded
     */
    modifier requireAirlineFunded() {
        require(isAirlineFunded(msg.sender), "The registering airline is not funded");
        _;
    }

    /**
     * @dev Modifier that requires the flight to be registered
     */
    modifier requireFlightRegistered(bytes32 key) {
         require(isFlightRegistered(key), "The flight must be registered");
         _;
     }

    /********************************************************************************************/
    /*                                       CONSTRUCTOR                                        */
    /********************************************************************************************/

    /**
     * @dev Contract constructor
     *
     */
    constructor(address dataContractAddress) public {
        contractOwner = msg.sender;
        flightSuretyData = FlightSuretyData(dataContractAddress);
    }

    /********************************************************************************************/
    /*                                       UTILITY FUNCTIONS                                  */
    /********************************************************************************************/

    function isOperational() public view returns(bool) {
        return operational; // Modify to call data contract's status
    }

     function setOperationalStatus(bool mode) requireContractOwner external {
        require(operational != mode, "The contract is already set to this mode");
        operational = mode;
    }

    function isAirlineRegistered(address airline) public returns(bool) {
        return flightSuretyData.isAirlineRegistered(airline);
    }

    function isAirlineFunded(address airline) public returns(bool) {
        return flightSuretyData.isAirlineFunded(airline);
    }

    function isFlightRegistered(bytes32 key) public returns(bool) {
        return flightSuretyData.isFlightRegistered(key);
    }

    /********************************************************************************************/
    /*                                     SMART CONTRACT FUNCTIONS                             */
    /********************************************************************************************/

    /**
     * @dev Add an airline to the registration queue
     *
     */
    function registerAirline(address newAirline)
        requireIsOperational
        requireAirlineRegistered
        requireAirlineFunded
        external
        returns (bool success, uint256 votes)
    {
        uint256 numberOfRegisteredAirlines = flightSuretyData.getNumberOfRegisteredAirlines();

        if (numberOfRegisteredAirlines < CONSENSUS_THRESHOLD) {
            flightSuretyData.registerAirline(newAirline);
            return (success, 0);        
        } else {
            require(!votersPerAirline[newAirline][msg.sender], "You have already voted to register this airline.");
            votersPerAirline[newAirline][msg.sender] = true;
            votesPerAirline[newAirline] = votesPerAirline[newAirline].add(1);

            votes = votesPerAirline[newAirline];
            if (votes >= numberOfRegisteredAirlines.mul(50).div(100)) { // Concensus of 50% was achieved
                flightSuretyData.registerAirline(newAirline);
                return (true, votes); 
            }
        }
    }

    /**
     * @dev Register a future flight for insuring.
     *
     */
    function registerFlight(address airline, string flightName, uint256 timestamp) requireIsOperational external {
        flightSuretyData.registerFlight(airline, flightName, timestamp);
    }

    /**
     * @dev Called after oracle has updated flight status
     *
     */
    function processFlightStatus(
        address airline,
        string memory flight,
        uint256 timestamp,
        uint8 statusCode
    ) requireIsOperational internal {
        if (statusCode == STATUS_CODE_LATE_AIRLINE) {
            flightSuretyData.creditInsurees(airline, flight, timestamp, INSURANCE_PAYOUT_PERCENTAGE);
        }    
    }

    // Generate a request for oracles to fetch flight information
    // and using a randomly generate index
    function fetchFlightStatus(
        address airline,
        string flight,
        uint256 timestamp
    ) requireIsOperational requireFlightRegistered(getFlightKey(airline, flight, timestamp)) external {
        uint8 index = getRandomIndex(msg.sender);

        // Generate a unique key for storing the request
        bytes32 key = keccak256(
            abi.encodePacked(index, airline, flight, timestamp)
        );
        oracleResponses[key] = ResponseInfo({
            requester: msg.sender,
            isOpen: true
        });

        emit OracleRequest(index, airline, flight, timestamp);
    }

    /**
     * @dev Initial funding for the insurance. Unless there are too many delayed flights
     *      resulting in insurance payouts, the contract should be self-sustaining
     *
     */
    function fund() requireIsOperational external payable {
        flightSuretyData.fund.value(msg.value)(msg.sender, AIRLINE_REGISTRATION_FEE);
    }

    /**
     * @dev Passenger can buy insurance but has to pay up 1 ether for any flight
     *
     */
     function buy(string flightName, address airlineAddress, uint256 timestamp) requireIsOperational requireFlightRegistered(getFlightKey(airlineAddress, flightName, timestamp)) external payable {
        require(msg.value <= MAX_INSURANCE_AMOUNT, "Insurance payment should be 1 ether or less.");

        bytes32 flightKey = getFlightKey(airlineAddress, flightName, timestamp);
        flightSuretyData.buy(flightKey, msg.sender, msg.value);
     }

    /**
     * @dev Insuree can withdraw payment that has credited to their account.
     *
     */
    function withdraw(address payee) requireIsOperational external payable{
        flightSuretyData.pay(payee);
    }

    //=============================================================
    // region ORACLE MANAGEMENT

    // Incremented to add pseudo-randomness at various points
    uint8 private nonce = 0;

    // Fee to be paid when registering oracle
    uint256 public constant REGISTRATION_FEE = 1 ether;

    // Number of oracles that must respond for valid status
    uint256 private constant MIN_RESPONSES = 3;

    struct Oracle {
        bool isRegistered;
        uint8[3] indexes;
    }

    // Track all registered oracles
    mapping(address => Oracle) private oracles;

    // Model for responses from oracles
    struct ResponseInfo {
        address requester; // Account that requested status
        bool isOpen; // If open, oracle responses are accepted
        mapping(uint8 => address[]) responses; // Mapping key is the status code reported
        // This lets us group responses and identify
        // the response that majority of the oracles
    }

    // Track all oracle responses
    // Key = hash(index, airline, flight, timestamp)
    mapping(bytes32 => ResponseInfo) private oracleResponses;

    // Event fired each time an oracle submits a response
    event FlightStatusInfo(
        address airline,
        string flight,
        uint256 timestamp,
        uint8 status
    );

    event OracleReport(
        address airline,
        string flight,
        uint256 timestamp,
        uint8 status
    );

    // Event fired when flight status request is submitted
    // Oracles track this and if they have a matching index
    // they fetch data and submit a response
    event OracleRequest(
        uint8 index,
        address airline,
        string flight,
        uint256 timestamp
    );

    // Register an oracle with the contract
    function registerOracle() external payable {
        // Require registration fee
        require(msg.value >= REGISTRATION_FEE, "Registration fee is required");

        uint8[3] memory indexes = generateIndexes(msg.sender);

        oracles[msg.sender] = Oracle({isRegistered: true, indexes: indexes});
    }

    function getMyIndexes() external view returns (uint8[3]) {
        require(oracles[msg.sender].isRegistered, "Not registered as an oracle");

        return oracles[msg.sender].indexes;
    }
 
    // Called by an oracle when a response is available to an outstanding request.
    // For the response to be accepted, there must be a pending request that is open
    // and matches one of the three Indexes randomly assigned to the oracle at the
    // time of registration (i.e. uninvited oracles are not welcome)
    function submitOracleResponse(
        uint8 index,
        address airline,
        string flight,
        uint256 timestamp,
        uint8 statusCode
    ) external {
        require(
            (oracles[msg.sender].indexes[0] == index) ||
                (oracles[msg.sender].indexes[1] == index) ||
                (oracles[msg.sender].indexes[2] == index),
            "Index does not match oracle request"
        );

        bytes32 key = keccak256(abi.encodePacked(index, airline, flight, timestamp));

        require(oracleResponses[key].isOpen, "Response submission is closed OR flight/timestamp do not match oracle request");

        oracleResponses[key].responses[statusCode].push(msg.sender);

        // Information isn't considered verified until at least MIN_RESPONSES
        // oracles respond with the *** same *** information
        emit OracleReport(airline, flight, timestamp, statusCode);
        if (oracleResponses[key].responses[statusCode].length >= MIN_RESPONSES) {
            emit FlightStatusInfo(airline, flight, timestamp, statusCode);

            // Close to prevent further responses as the minimum responses was reached
            oracleResponses[key].isOpen = false;

            // Handle flight status as appropriate
            processFlightStatus(airline, flight, timestamp, statusCode);
        }
    }

    function getFlightKey(
        address airline,
        string flight,
        uint256 timestamp
    ) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(airline, flight, timestamp));
    }

    // Returns array of three non-duplicating integers from 0-9
    function generateIndexes(address account) internal returns (uint8[3]) {
        uint8[3] memory indexes;
        indexes[0] = getRandomIndex(account);

        indexes[1] = indexes[0];
        while (indexes[1] == indexes[0]) {
            indexes[1] = getRandomIndex(account);
        }

        indexes[2] = indexes[1];
        while ((indexes[2] == indexes[0]) || (indexes[2] == indexes[1])) {
            indexes[2] = getRandomIndex(account);
        }

        return indexes;
    }

    // Returns array of three non-duplicating integers from 0-9
    function getRandomIndex(address account) internal returns (uint8) {
        uint8 maxValue = 10;

        // Pseudo random number...the incrementing nonce adds variation
        uint8 random = uint8(
            uint256(
                keccak256(
                    abi.encodePacked(blockhash(block.number - nonce++), account)
                )
            ) % maxValue
        );

        if (nonce > 250) {
            nonce = 0; // Can only fetch blockhashes for last 256 blocks so we adapt
        }

        return random;
    }

    // endregion
}



  /****************************************************************************************/
  /* FlightSuretyData interface                                                              */
  /****************************************************************************************/
contract FlightSuretyData {
    uint8 public airlineRegisteredCounter;

    function isOperational() external returns(bool);
    function isAirlineRegistered(address airline) external returns(bool);
    function isFlightRegistered(bytes32 key) external returns(bool);
    function isAirlineFunded(address airline) external returns(bool);
    function registerAirline(address airline) external;
    function registerFlight(address airline, string flightName, uint256 timestamp) external;
    function getNumberOfRegisteredAirlines() external returns (uint256);
    function buy(bytes32 flightKey, address passengerAddress, uint256 insuredAmount) external payable;
    function creditInsurees(address airline, string flightName, uint256 timestamp, uint8 paymentPercentage) external;
    function pay(address insuree) external payable;
    function fund(address airline, uint256 amount) external payable;
}