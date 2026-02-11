# QuorumGovernance API Documentation

Complete API reference for the QuorumGovernance smart contract.

---

## Table of Contents

1. [State Variables](#state-variables)
2. [Agent Management](#agent-management)
3. [Proposal Management](#proposal-management)
4. [Voting Functions](#voting-functions)
5. [Query Functions](#query-functions)
6. [Configuration Functions](#configuration-functions)
7. [Events](#events)
8. [Data Structures](#data-structures)

---

## State Variables

### `owner`
```solidity
address public owner
```
Contract owner with administrative privileges.

### `quorumBasisPoints`
```solidity
uint256 public quorumBasisPoints
```
Quorum threshold in basis points (e.g., 4000 = 40%). Range: 0-10000.

### `votingDelay`
```solidity
uint256 public votingDelay
```
Number of blocks before voting begins after proposal creation.

### `votingPeriod`
```solidity
uint256 public votingPeriod
```
Number of blocks voting remains active.

### `totalVotingPower`
```solidity
uint256 public totalVotingPower
```
Sum of all active agents' voting power.

### `proposalCount`
```solidity
uint256 public proposalCount
```
Total number of proposals created.

---

## Agent Management

### `registerAgent`
```solidity
function registerAgent(
    address agentAddress,
    uint256 votingPower,
    string memory metadata
) external onlyOwner
```

Registers a new agent in the governance system.

**Parameters:**
- `agentAddress`: Ethereum address of the agent
- `votingPower`: Voting weight for this agent (must be > 0)
- `metadata`: IPFS hash or identifier for agent metadata

**Requirements:**
- Caller must be owner
- Agent address cannot be zero
- Voting power must be > 0
- Agent must not already be registered

**Emits:** `AgentRegistered(agentAddress, votingPower, metadata)`

**Example:**
```javascript
await governance.registerAgent(
    "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
    100,
    "ipfs://QmAgentProfile"
);
```

---

### `verifyAgent`
```solidity
function verifyAgent(address agentAddress) external onlyOwner
```

Verifies a registered agent, allowing them to vote and create proposals.

**Parameters:**
- `agentAddress`: Address of the agent to verify

**Requirements:**
- Caller must be owner
- Agent must be registered
- Agent must not already be verified

**Emits:** `AgentVerified(agentAddress)`

**Example:**
```javascript
await governance.verifyAgent("0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb");
```

---

### `deactivateAgent`
```solidity
function deactivateAgent(address agentAddress) external onlyOwner
```

Deactivates an agent, preventing them from voting or creating proposals.

**Parameters:**
- `agentAddress`: Address of the agent to deactivate

**Requirements:**
- Caller must be owner
- Agent must be registered and verified

**Effects:**
- Agent's voting power is removed from `totalVotingPower`
- Agent cannot vote or create proposals while deactivated

**Emits:** `AgentDeactivated(agentAddress)`

**Example:**
```javascript
await governance.deactivateAgent("0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb");
```

---

### `reactivateAgent`
```solidity
function reactivateAgent(address agentAddress) external onlyOwner
```

Reactivates a previously deactivated agent.

**Parameters:**
- `agentAddress`: Address of the agent to reactivate

**Requirements:**
- Caller must be owner
- Agent must be registered and verified
- Agent must be inactive

**Effects:**
- Agent's voting power is added back to `totalVotingPower`
- Agent can vote and create proposals again

**Emits:** `AgentReactivated(agentAddress)`

**Example:**
```javascript
await governance.reactivateAgent("0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb");
```

---

### `updateVotingPower`
```solidity
function updateVotingPower(
    address agentAddress,
    uint256 newVotingPower
) external onlyOwner
```

Updates an agent's voting power.

**Parameters:**
- `agentAddress`: Address of the agent
- `newVotingPower`: New voting power value (must be > 0)

**Requirements:**
- Caller must be owner
- Agent must be registered and verified
- New voting power must be > 0

**Effects:**
- Updates `totalVotingPower` accordingly
- Affects all future votes, not past ones

**Emits:** `VotingPowerUpdated(agentAddress, oldPower, newPower)`

**Example:**
```javascript
await governance.updateVotingPower(
    "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
    200
);
```

---

## Proposal Management

### `createProposal`
```solidity
function createProposal(
    address target,
    uint256 value,
    bytes memory calldataParam,
    string memory description
) external onlyVerifiedAgent returns (uint256)
```

Creates a new governance proposal.

**Parameters:**
- `target`: Target contract address for execution
- `value`: ETH value to send with execution (in wei)
- `calldataParam`: Encoded function call data
- `description`: Human-readable proposal description

**Returns:**
- `uint256`: Proposal ID

**Requirements:**
- Caller must be verified and active agent

**Effects:**
- Creates proposal in Pending state
- Voting starts after `votingDelay` blocks
- Voting ends after `votingDelay + votingPeriod` blocks

**Emits:** `ProposalCreated(proposalId, proposer, target, value, description, startBlock, endBlock)`

**Example:**
```javascript
const target = "0x...";
const value = 0;
const calldata = ethers.interface.encodeFunctionData("transfer", [recipient, amount]);
const description = "Transfer 100 tokens to treasury";

const tx = await governance.connect(agent).createProposal(
    target,
    value,
    calldata,
    description
);
const receipt = await tx.wait();
const proposalId = receipt.events[0].args.proposalId;
```

---

### `executeProposal`
```solidity
function executeProposal(uint256 proposalId) external returns (bytes memory)
```

Executes a succeeded proposal.

**Parameters:**
- `proposalId`: ID of the proposal to execute

**Returns:**
- `bytes`: Return data from the executed call

**Requirements:**
- Proposal must be in Succeeded state
- Voting period must have ended
- Quorum must be reached
- FOR votes must exceed AGAINST votes

**Effects:**
- Proposal state changes to Executed
- Target contract function is called with specified parameters

**Emits:** `ProposalExecuted(proposalId)`

**Example:**
```javascript
await governance.executeProposal(1);
```

---

### `cancelProposal`
```solidity
function cancelProposal(uint256 proposalId) external
```

Cancels a proposal before execution.

**Parameters:**
- `proposalId`: ID of the proposal to cancel

**Requirements:**
- Caller must be proposal creator or contract owner
- Proposal must not be already executed

**Effects:**
- Proposal state changes to Canceled
- Proposal cannot be executed

**Emits:** `ProposalCanceled(proposalId)`

**Example:**
```javascript
await governance.connect(proposer).cancelProposal(1);
```

---

## Voting Functions

### `castVote`
```solidity
function castVote(uint256 proposalId, uint8 support) external onlyVerifiedAgent
```

Casts a vote on an active proposal.

**Parameters:**
- `proposalId`: ID of the proposal
- `support`: Vote choice
  - `0` = Against
  - `1` = For
  - `2` = Abstain

**Requirements:**
- Caller must be verified and active agent
- Proposal must be in Active state
- Current block must be within voting period
- Agent must not have already voted on this proposal

**Effects:**
- Records vote with agent's voting power
- Updates proposal vote tallies

**Emits:** `VoteCast(voter, proposalId, support, votes, timestamp)`

**Example:**
```javascript
// Vote FOR
await governance.connect(agent).castVote(proposalId, 1);

// Vote AGAINST
await governance.connect(agent).castVote(proposalId, 0);

// Vote ABSTAIN
await governance.connect(agent).castVote(proposalId, 2);
```

---

## Query Functions

### `state`
```solidity
function state(uint256 proposalId) public view returns (ProposalState)
```

Returns the current state of a proposal.

**Parameters:**
- `proposalId`: ID of the proposal

**Returns:**
- `ProposalState` enum:
  - `0` = Pending (before voting starts)
  - `1` = Active (voting in progress)
  - `2` = Succeeded (passed and ready to execute)
  - `3` = Defeated (failed to pass)
  - `4` = Executed (successfully executed)
  - `5` = Canceled (canceled by proposer/owner)

**Example:**
```javascript
const proposalState = await governance.state(1);
// 0=Pending, 1=Active, 2=Succeeded, 3=Defeated, 4=Executed, 5=Canceled
```

---

### `hasReachedQuorum`
```solidity
function hasReachedQuorum(uint256 proposalId) public view returns (bool)
```

Checks if a proposal has reached the required quorum.

**Parameters:**
- `proposalId`: ID of the proposal

**Returns:**
- `bool`: True if quorum reached, false otherwise

**Calculation:**
- Quorum = (totalVotingPower × quorumBasisPoints) / 10000
- Total votes = forVotes + againstVotes + abstainVotes
- Returns true if total votes >= quorum

**Example:**
```javascript
const reached = await governance.hasReachedQuorum(1);
console.log(`Quorum reached: ${reached}`);
```

---

### `quorum`
```solidity
function quorum() public view returns (uint256)
```

Returns the current quorum threshold in absolute votes.

**Returns:**
- `uint256`: Number of votes needed for quorum

**Calculation:**
- `(totalVotingPower × quorumBasisPoints) / 10000`

**Example:**
```javascript
const quorumVotes = await governance.quorum();
console.log(`Need ${quorumVotes} votes for quorum`);
```

---

### `getVotingResults`
```solidity
function getVotingResults(uint256 proposalId) external view returns (
    uint256 forVotes,
    uint256 againstVotes,
    uint256 abstainVotes,
    uint256 totalVotes
)
```

Returns detailed voting results for a proposal.

**Parameters:**
- `proposalId`: ID of the proposal

**Returns:**
- `forVotes`: Total votes in favor
- `againstVotes`: Total votes against
- `abstainVotes`: Total abstain votes
- `totalVotes`: Sum of all votes

**Example:**
```javascript
const [forVotes, againstVotes, abstainVotes, totalVotes] = 
    await governance.getVotingResults(1);

console.log(`For: ${forVotes}`);
console.log(`Against: ${againstVotes}`);
console.log(`Abstain: ${abstainVotes}`);
console.log(`Total: ${totalVotes}`);
```

---

### `getProposalInfo`
```solidity
function getProposalInfo(uint256 proposalId) external view returns (
    address proposer,
    address target,
    uint256 value,
    bytes32 calldataHash,
    string memory description,
    uint256 startBlock,
    uint256 endBlock
)
```

Returns detailed information about a proposal.

**Parameters:**
- `proposalId`: ID of the proposal

**Returns:**
- `proposer`: Address that created the proposal
- `target`: Target contract address
- `value`: ETH value to send
- `calldataHash`: Keccak256 hash of calldata
- `description`: Proposal description
- `startBlock`: Block when voting starts
- `endBlock`: Block when voting ends

**Example:**
```javascript
const info = await governance.getProposalInfo(1);
console.log(`Proposer: ${info.proposer}`);
console.log(`Description: ${info.description}`);
console.log(`Voting: blocks ${info.startBlock} - ${info.endBlock}`);
```

---

### `getReceipt`
```solidity
function getReceipt(
    uint256 proposalId,
    address voter
) external view returns (Receipt memory)
```

Returns voting receipt for an agent on a proposal.

**Parameters:**
- `proposalId`: ID of the proposal
- `voter`: Address of the voter

**Returns:**
- `Receipt` struct:
  - `hasVoted`: Whether agent has voted
  - `support`: Vote choice (0=Against, 1=For, 2=Abstain)
  - `votes`: Number of votes cast
  - `timestamp`: Block timestamp of vote

**Example:**
```javascript
const receipt = await governance.getReceipt(1, agentAddress);
if (receipt.hasVoted) {
    console.log(`Voted: ${receipt.support} with ${receipt.votes} votes`);
} else {
    console.log("Has not voted");
}
```

---

### `getAgentInfo`
```solidity
function getAgentInfo(address agentAddress) external view returns (
    bool isRegistered,
    bool isVerified,
    bool isActive,
    uint256 votingPower,
    string memory metadata
)
```

Returns information about an agent.

**Parameters:**
- `agentAddress`: Address of the agent

**Returns:**
- `isRegistered`: Whether agent is registered
- `isVerified`: Whether agent is verified
- `isActive`: Whether agent is active
- `votingPower`: Agent's voting power
- `metadata`: Agent metadata (IPFS hash or identifier)

**Example:**
```javascript
const info = await governance.getAgentInfo(agentAddress);
console.log(`Registered: ${info.isRegistered}`);
console.log(`Verified: ${info.isVerified}`);
console.log(`Active: ${info.isActive}`);
console.log(`Voting Power: ${info.votingPower}`);
```

---

## Configuration Functions

### `updateQuorum`
```solidity
function updateQuorum(uint256 newQuorum) external onlyOwner
```

Updates the quorum threshold.

**Parameters:**
- `newQuorum`: New quorum in basis points (0-10000)

**Requirements:**
- Caller must be owner
- New quorum must be <= 10000

**Emits:** `QuorumUpdated(oldQuorum, newQuorum)`

**Example:**
```javascript
// Set quorum to 50%
await governance.updateQuorum(5000);
```

---

### `updateVotingDelay`
```solidity
function updateVotingDelay(uint256 newDelay) external onlyOwner
```

Updates the voting delay period.

**Parameters:**
- `newDelay`: New delay in blocks

**Requirements:**
- Caller must be owner

**Emits:** `VotingDelayUpdated(oldDelay, newDelay)`

**Example:**
```javascript
// Set delay to 10 blocks
await governance.updateVotingDelay(10);
```

---

### `updateVotingPeriod`
```solidity
function updateVotingPeriod(uint256 newPeriod) external onlyOwner
```

Updates the voting period duration.

**Parameters:**
- `newPeriod`: New period in blocks (must be > 0)

**Requirements:**
- Caller must be owner
- New period must be > 0

**Emits:** `VotingPeriodUpdated(oldPeriod, newPeriod)`

**Example:**
```javascript
// Set period to 200 blocks
await governance.updateVotingPeriod(200);
```

---

## Events

### `AgentRegistered`
```solidity
event AgentRegistered(
    address indexed agentAddress,
    uint256 votingPower,
    string metadata
)
```
Emitted when a new agent is registered.

---

### `AgentVerified`
```solidity
event AgentVerified(address indexed agentAddress)
```
Emitted when an agent is verified.

---

### `AgentDeactivated`
```solidity
event AgentDeactivated(address indexed agentAddress)
```
Emitted when an agent is deactivated.

---

### `AgentReactivated`
```solidity
event AgentReactivated(address indexed agentAddress)
```
Emitted when an agent is reactivated.

---

### `VotingPowerUpdated`
```solidity
event VotingPowerUpdated(
    address indexed agentAddress,
    uint256 oldPower,
    uint256 newPower
)
```
Emitted when an agent's voting power is updated.

---

### `ProposalCreated`
```solidity
event ProposalCreated(
    uint256 indexed proposalId,
    address indexed proposer,
    address target,
    uint256 value,
    string description,
    uint256 startBlock,
    uint256 endBlock
)
```
Emitted when a new proposal is created.

---

### `VoteCast`
```solidity
event VoteCast(
    address indexed voter,
    uint256 indexed proposalId,
    uint8 support,
    uint256 votes,
    uint256 timestamp
)
```
Emitted when a vote is cast.

---

### `ProposalExecuted`
```solidity
event ProposalExecuted(uint256 indexed proposalId)
```
Emitted when a proposal is successfully executed.

---

### `ProposalCanceled`
```solidity
event ProposalCanceled(uint256 indexed proposalId)
```
Emitted when a proposal is canceled.

---

### `QuorumUpdated`
```solidity
event QuorumUpdated(uint256 oldQuorum, uint256 newQuorum)
```
Emitted when quorum threshold is updated.

---

### `VotingDelayUpdated`
```solidity
event VotingDelayUpdated(uint256 oldDelay, uint256 newDelay)
```
Emitted when voting delay is updated.

---

### `VotingPeriodUpdated`
```solidity
event VotingPeriodUpdated(uint256 oldPeriod, uint256 newPeriod)
```
Emitted when voting period is updated.

---

## Data Structures

### `Agent` Struct
```solidity
struct Agent {
    bool isRegistered;    // Whether agent is registered
    bool isVerified;      // Whether agent is verified
    bool isActive;        // Whether agent is currently active
    uint256 votingPower;  // Voting weight
    string metadata;      // IPFS hash or identifier
}
```

---

### `Proposal` Struct
```solidity
struct Proposal {
    address proposer;        // Creator of proposal
    address target;          // Target contract
    uint256 value;           // ETH value to send
    bytes32 calldataHash;    // Hash of calldata
    string description;      // Human-readable description
    uint256 startBlock;      // Voting start block
    uint256 endBlock;        // Voting end block
    uint256 forVotes;        // Total FOR votes
    uint256 againstVotes;    // Total AGAINST votes
    uint256 abstainVotes;    // Total ABSTAIN votes
    bool executed;           // Whether executed
    bool canceled;           // Whether canceled
}
```

---

### `Receipt` Struct
```solidity
struct Receipt {
    bool hasVoted;      // Whether agent has voted
    uint8 support;      // Vote choice (0=Against, 1=For, 2=Abstain)
    uint256 votes;      // Number of votes cast
    uint256 timestamp;  // Block timestamp of vote
}
```

---

### `ProposalState` Enum
```solidity
enum ProposalState {
    Pending,    // 0 - Before voting starts
    Active,     // 1 - Voting in progress
    Succeeded,  // 2 - Passed, ready to execute
    Defeated,   // 3 - Failed to pass
    Executed,   // 4 - Successfully executed
    Canceled    // 5 - Canceled before execution
}
```

---

## Integration Guide

### Basic Workflow

1. **Deploy Contract**
   ```javascript
   const governance = await QuorumGovernance.deploy(4000, 1, 100);
   ```

2. **Register Agents**
   ```javascript
   await governance.registerAgent(agent1, 100, "ipfs://...");
   await governance.verifyAgent(agent1);
   ```

3. **Create Proposal**
   ```javascript
   const tx = await governance.connect(agent1).createProposal(
       target, value, calldata, description
   );
   ```

4. **Vote on Proposal**
   ```javascript
   await governance.connect(agent1).castVote(proposalId, 1); // FOR
   await governance.connect(agent2).castVote(proposalId, 0); // AGAINST
   ```

5. **Execute Proposal**
   ```javascript
   await governance.executeProposal(proposalId);
   ```

### Error Handling

Always check proposal state before operations:
```javascript
const currentState = await governance.state(proposalId);
if (currentState === 1) { // Active
    await governance.connect(agent).castVote(proposalId, 1);
} else if (currentState === 2) { // Succeeded
    await governance.executeProposal(proposalId);
}
```

### Event Monitoring

Listen for events to track governance activity:
```javascript
governance.on("ProposalCreated", (proposalId, proposer, target, value, description) => {
    console.log(`New proposal ${proposalId}: ${description}`);
});

governance.on("VoteCast", (voter, proposalId, support, votes) => {
    console.log(`${voter} voted ${support} with ${votes} votes on proposal ${proposalId}`);
});
```

---

## Gas Optimization Tips

1. **Batch Operations**: Register and verify multiple agents in a single transaction block
2. **Vote Early**: Cast votes early in the voting period to avoid gas spikes
3. **Use Events**: Monitor events instead of polling contract state
4. **Calldata Optimization**: Use shorter descriptions and metadata when possible

---

## Security Considerations

1. **Owner Key Management**: Secure the owner private key (controls agent registration)
2. **Agent Verification**: Only verify trusted agents
3. **Proposal Review**: Review proposals before voting
4. **Execution Timing**: Execute proposals promptly after success to prevent state changes
5. **Quorum Settings**: Set appropriate quorum to prevent governance attacks

---

## Support

For questions or issues:
- GitHub Issues: [repository link]
- Documentation: [docs link]
- Community: [discord/forum link]
