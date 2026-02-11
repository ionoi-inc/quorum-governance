// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title QuorumGovernance
 * @notice Governance contract with agent-based voting and verification system
 * @dev Implements proposal creation, agent voting, quorum validation, and execution
 */
contract QuorumGovernance {
    
    // ============ State Variables ============
    
    /// @notice Minimum percentage of total voting power required for quorum (basis points, e.g., 4000 = 40%)
    uint256 public quorumBasisPoints;
    
    /// @notice Voting period duration in blocks
    uint256 public votingPeriod;
    
    /// @notice Delay before voting starts after proposal creation (in blocks)
    uint256 public votingDelay;
    
    /// @notice Contract owner/admin
    address public owner;
    
    /// @notice Proposal counter
    uint256 public proposalCount;
    
    /// @notice Total registered voting power
    uint256 public totalVotingPower;
    
    // ============ Structs ============
    
    struct Agent {
        address agentAddress;
        uint256 votingPower;
        bool isActive;
        bool isVerified;
        uint256 verifiedAt;
        string metadata; // IPFS hash or identifier
    }
    
    struct Proposal {
        uint256 id;
        address proposer;
        string description;
        uint256 startBlock;
        uint256 endBlock;
        uint256 forVotes;
        uint256 againstVotes;
        uint256 abstainVotes;
        bool executed;
        bool canceled;
        ProposalState state;
        bytes callData; // Encoded function call for execution
        address targetContract; // Contract to call if proposal passes
    }
    
    struct Vote {
        bool hasVoted;
        VoteChoice choice;
        uint256 votingPower;
        uint256 timestamp;
    }
    
    enum VoteChoice {
        Against,
        For,
        Abstain
    }
    
    enum ProposalState {
        Pending,
        Active,
        Canceled,
        Defeated,
        Succeeded,
        Queued,
        Expired,
        Executed
    }
    
    // ============ Mappings ============
    
    /// @notice Agent address => Agent data
    mapping(address => Agent) public agents;
    
    /// @notice Proposal ID => Proposal data
    mapping(uint256 => Proposal) public proposals;
    
    /// @notice Proposal ID => Agent address => Vote
    mapping(uint256 => mapping(address => Vote)) public votes;
    
    /// @notice List of all agent addresses
    address[] public agentList;
    
    // ============ Events ============
    
    event AgentRegistered(address indexed agent, uint256 votingPower, string metadata);
    event AgentVerified(address indexed agent, address indexed verifier);
    event AgentDeactivated(address indexed agent);
    event VotingPowerUpdated(address indexed agent, uint256 oldPower, uint256 newPower);
    
    event ProposalCreated(
        uint256 indexed proposalId,
        address indexed proposer,
        string description,
        uint256 startBlock,
        uint256 endBlock
    );
    event VoteCast(
        address indexed voter,
        uint256 indexed proposalId,
        VoteChoice choice,
        uint256 votingPower
    );
    event ProposalExecuted(uint256 indexed proposalId);
    event ProposalCanceled(uint256 indexed proposalId);
    
    event QuorumUpdated(uint256 oldQuorum, uint256 newQuorum);
    event VotingPeriodUpdated(uint256 oldPeriod, uint256 newPeriod);
    
    // ============ Modifiers ============
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }
    
    modifier onlyActiveAgent() {
        require(agents[msg.sender].isActive, "Agent not active");
        _;
    }
    
    modifier onlyVerifiedAgent() {
        require(agents[msg.sender].isVerified, "Agent not verified");
        _;
    }
    
    // ============ Constructor ============
    
    constructor(
        uint256 _quorumBasisPoints,
        uint256 _votingPeriod,
        uint256 _votingDelay
    ) {
        require(_quorumBasisPoints <= 10000, "Quorum too high");
        require(_votingPeriod > 0, "Invalid voting period");
        
        owner = msg.sender;
        quorumBasisPoints = _quorumBasisPoints;
        votingPeriod = _votingPeriod;
        votingDelay = _votingDelay;
    }
    
    // ============ Agent Management ============
    
    /**
     * @notice Register a new agent with voting power
     * @param _agent Address of the agent
     * @param _votingPower Voting power to assign
     * @param _metadata IPFS hash or metadata identifier
     */
    function registerAgent(
        address _agent,
        uint256 _votingPower,
        string memory _metadata
    ) external onlyOwner {
        require(_agent != address(0), "Invalid address");
        require(!agents[_agent].isActive, "Agent already registered");
        require(_votingPower > 0, "Invalid voting power");
        
        agents[_agent] = Agent({
            agentAddress: _agent,
            votingPower: _votingPower,
            isActive: true,
            isVerified: false,
            verifiedAt: 0,
            metadata: _metadata
        });
        
        agentList.push(_agent);
        totalVotingPower += _votingPower;
        
        emit AgentRegistered(_agent, _votingPower, _metadata);
    }
    
    /**
     * @notice Verify an agent (could be based on off-chain verification)
     * @param _agent Address of the agent to verify
     */
    function verifyAgent(address _agent) external onlyOwner {
        require(agents[_agent].isActive, "Agent not active");
        require(!agents[_agent].isVerified, "Agent already verified");
        
        agents[_agent].isVerified = true;
        agents[_agent].verifiedAt = block.timestamp;
        
        emit AgentVerified(_agent, msg.sender);
    }
    
    /**
     * @notice Deactivate an agent
     * @param _agent Address of the agent to deactivate
     */
    function deactivateAgent(address _agent) external onlyOwner {
        require(agents[_agent].isActive, "Agent not active");
        
        agents[_agent].isActive = false;
        totalVotingPower -= agents[_agent].votingPower;
        
        emit AgentDeactivated(_agent);
    }
    
    /**
     * @notice Update agent's voting power
     * @param _agent Address of the agent
     * @param _newVotingPower New voting power
     */
    function updateVotingPower(address _agent, uint256 _newVotingPower) 
        external 
        onlyOwner 
    {
        require(agents[_agent].isActive, "Agent not active");
        require(_newVotingPower > 0, "Invalid voting power");
        
        uint256 oldPower = agents[_agent].votingPower;
        
        totalVotingPower = totalVotingPower - oldPower + _newVotingPower;
        agents[_agent].votingPower = _newVotingPower;
        
        emit VotingPowerUpdated(_agent, oldPower, _newVotingPower);
    }
    
    // ============ Proposal Management ============
    
    /**
     * @notice Create a new proposal
     * @param _description Description of the proposal
     * @param _targetContract Address of contract to call if executed
     * @param _callData Encoded function call data
     * @return proposalId ID of the created proposal
     */
    function createProposal(
        string memory _description,
        address _targetContract,
        bytes memory _callData
    ) external onlyActiveAgent onlyVerifiedAgent returns (uint256) {
        proposalCount++;
        uint256 proposalId = proposalCount;
        
        uint256 startBlock = block.number + votingDelay;
        uint256 endBlock = startBlock + votingPeriod;
        
        proposals[proposalId] = Proposal({
            id: proposalId,
            proposer: msg.sender,
            description: _description,
            startBlock: startBlock,
            endBlock: endBlock,
            forVotes: 0,
            againstVotes: 0,
            abstainVotes: 0,
            executed: false,
            canceled: false,
            state: ProposalState.Pending,
            callData: _callData,
            targetContract: _targetContract
        });
        
        emit ProposalCreated(
            proposalId,
            msg.sender,
            _description,
            startBlock,
            endBlock
        );
        
        return proposalId;
    }
    
    /**
     * @notice Cast a vote on a proposal
     * @param _proposalId ID of the proposal
     * @param _choice Vote choice (0=Against, 1=For, 2=Abstain)
     */
    function castVote(uint256 _proposalId, VoteChoice _choice) 
        external 
        onlyActiveAgent 
        onlyVerifiedAgent 
    {
        require(_proposalId > 0 && _proposalId <= proposalCount, "Invalid proposal");
        Proposal storage proposal = proposals[_proposalId];
        
        require(block.number >= proposal.startBlock, "Voting not started");
        require(block.number <= proposal.endBlock, "Voting ended");
        require(!proposal.canceled, "Proposal canceled");
        require(!votes[_proposalId][msg.sender].hasVoted, "Already voted");
        
        Agent memory agent = agents[msg.sender];
        uint256 votingPower = agent.votingPower;
        
        votes[_proposalId][msg.sender] = Vote({
            hasVoted: true,
            choice: _choice,
            votingPower: votingPower,
            timestamp: block.timestamp
        });
        
        if (_choice == VoteChoice.For) {
            proposal.forVotes += votingPower;
        } else if (_choice == VoteChoice.Against) {
            proposal.againstVotes += votingPower;
        } else {
            proposal.abstainVotes += votingPower;
        }
        
        emit VoteCast(msg.sender, _proposalId, _choice, votingPower);
    }
    
    /**
     * @notice Get the current state of a proposal
     * @param _proposalId ID of the proposal
     * @return Current state of the proposal
     */
    function getProposalState(uint256 _proposalId) 
        public 
        view 
        returns (ProposalState) 
    {
        require(_proposalId > 0 && _proposalId <= proposalCount, "Invalid proposal");
        Proposal storage proposal = proposals[_proposalId];
        
        if (proposal.canceled) {
            return ProposalState.Canceled;
        }
        
        if (proposal.executed) {
            return ProposalState.Executed;
        }
        
        if (block.number < proposal.startBlock) {
            return ProposalState.Pending;
        }
        
        if (block.number <= proposal.endBlock) {
            return ProposalState.Active;
        }
        
        // Voting ended, check if it passed
        uint256 totalVotes = proposal.forVotes + proposal.againstVotes + proposal.abstainVotes;
        uint256 quorumRequired = (totalVotingPower * quorumBasisPoints) / 10000;
        
        if (totalVotes < quorumRequired) {
            return ProposalState.Defeated;
        }
        
        if (proposal.forVotes > proposal.againstVotes) {
            return ProposalState.Succeeded;
        }
        
        return ProposalState.Defeated;
    }
    
    /**
     * @notice Execute a successful proposal
     * @param _proposalId ID of the proposal to execute
     */
    function executeProposal(uint256 _proposalId) external {
        require(_proposalId > 0 && _proposalId <= proposalCount, "Invalid proposal");
        Proposal storage proposal = proposals[_proposalId];
        
        require(getProposalState(_proposalId) == ProposalState.Succeeded, "Proposal not succeeded");
        require(!proposal.executed, "Already executed");
        
        proposal.executed = true;
        proposal.state = ProposalState.Executed;
        
        // Execute the call if target and callData are provided
        if (proposal.targetContract != address(0) && proposal.callData.length > 0) {
            (bool success, ) = proposal.targetContract.call(proposal.callData);
            require(success, "Execution failed");
        }
        
        emit ProposalExecuted(_proposalId);
    }
    
    /**
     * @notice Cancel a proposal (only by proposer or owner)
     * @param _proposalId ID of the proposal to cancel
     */
    function cancelProposal(uint256 _proposalId) external {
        require(_proposalId > 0 && _proposalId <= proposalCount, "Invalid proposal");
        Proposal storage proposal = proposals[_proposalId];
        
        require(
            msg.sender == proposal.proposer || msg.sender == owner,
            "Not authorized"
        );
        require(!proposal.executed, "Already executed");
        require(!proposal.canceled, "Already canceled");
        
        proposal.canceled = true;
        proposal.state = ProposalState.Canceled;
        
        emit ProposalCanceled(_proposalId);
    }
    
    // ============ Quorum & Voting Verification ============
    
    /**
     * @notice Check if a proposal has reached quorum
     * @param _proposalId ID of the proposal
     * @return Whether quorum has been reached
     */
    function hasReachedQuorum(uint256 _proposalId) public view returns (bool) {
        require(_proposalId > 0 && _proposalId <= proposalCount, "Invalid proposal");
        Proposal storage proposal = proposals[_proposalId];
        
        uint256 totalVotes = proposal.forVotes + proposal.againstVotes + proposal.abstainVotes;
        uint256 quorumRequired = (totalVotingPower * quorumBasisPoints) / 10000;
        
        return totalVotes >= quorumRequired;
    }
    
    /**
     * @notice Get detailed voting results for a proposal
     * @param _proposalId ID of the proposal
     * @return forVotes Against votes, For votes, Abstain votes, Total votes, Quorum reached
     */
    function getVotingResults(uint256 _proposalId) 
        external 
        view 
        returns (
            uint256 forVotes,
            uint256 againstVotes,
            uint256 abstainVotes,
            uint256 totalVotes,
            bool quorumReached
        ) 
    {
        require(_proposalId > 0 && _proposalId <= proposalCount, "Invalid proposal");
        Proposal storage proposal = proposals[_proposalId];
        
        forVotes = proposal.forVotes;
        againstVotes = proposal.againstVotes;
        abstainVotes = proposal.abstainVotes;
        totalVotes = forVotes + againstVotes + abstainVotes;
        quorumReached = hasReachedQuorum(_proposalId);
    }
    
    // ============ Admin Functions ============
    
    /**
     * @notice Update quorum requirement
     * @param _newQuorumBasisPoints New quorum in basis points
     */
    function updateQuorum(uint256 _newQuorumBasisPoints) external onlyOwner {
        require(_newQuorumBasisPoints <= 10000, "Quorum too high");
        uint256 oldQuorum = quorumBasisPoints;
        quorumBasisPoints = _newQuorumBasisPoints;
        emit QuorumUpdated(oldQuorum, _newQuorumBasisPoints);
    }
    
    /**
     * @notice Update voting period
     * @param _newVotingPeriod New voting period in blocks
     */
    function updateVotingPeriod(uint256 _newVotingPeriod) external onlyOwner {
        require(_newVotingPeriod > 0, "Invalid voting period");
        uint256 oldPeriod = votingPeriod;
        votingPeriod = _newVotingPeriod;
        emit VotingPeriodUpdated(oldPeriod, _newVotingPeriod);
    }
    
    /**
     * @notice Update voting delay
     * @param _newVotingDelay New voting delay in blocks
     */
    function updateVotingDelay(uint256 _newVotingDelay) external onlyOwner {
        votingDelay = _newVotingDelay;
    }
    
    /**
     * @notice Transfer ownership
     * @param _newOwner Address of new owner
     */
    function transferOwnership(address _newOwner) external onlyOwner {
        require(_newOwner != address(0), "Invalid address");
        owner = _newOwner;
    }
    
    // ============ View Functions ============
    
    /**
     * @notice Get agent information
     * @param _agent Address of the agent
     * @return Agent struct data
     */
    function getAgent(address _agent) external view returns (Agent memory) {
        return agents[_agent];
    }
    
    /**
     * @notice Get all registered agents
     * @return Array of agent addresses
     */
    function getAllAgents() external view returns (address[] memory) {
        return agentList;
    }
    
    /**
     * @notice Get number of active verified agents
     * @return Count of active verified agents
     */
    function getActiveVerifiedAgentCount() external view returns (uint256) {
        uint256 count = 0;
        for (uint256 i = 0; i < agentList.length; i++) {
            if (agents[agentList[i]].isActive && agents[agentList[i]].isVerified) {
                count++;
            }
        }
        return count;
    }
    
    /**
     * @notice Check if an address has voted on a proposal
     * @param _proposalId ID of the proposal
     * @param _voter Address to check
     * @return Whether the address has voted
     */
    function hasVoted(uint256 _proposalId, address _voter) 
        external 
        view 
        returns (bool) 
    {
        return votes[_proposalId][_voter].hasVoted;
    }
    
    /**
     * @notice Get vote details for an agent on a proposal
     * @param _proposalId ID of the proposal
     * @param _voter Address of the voter
     * @return Vote struct data
     */
    function getVote(uint256 _proposalId, address _voter) 
        external 
        view 
        returns (Vote memory) 
    {
        return votes[_proposalId][_voter];
    }
}
