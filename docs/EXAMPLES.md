# QuorumGovernance Examples & Workflows

Practical examples and common usage patterns for the QuorumGovernance system.

---

## Table of Contents

1. [Complete Workflow Example](#complete-workflow-example)
2. [Common Use Cases](#common-use-cases)
3. [Integration Patterns](#integration-patterns)
4. [Workflow Diagrams](#workflow-diagrams)
5. [Advanced Scenarios](#advanced-scenarios)

---

## Complete Workflow Example

### Scenario: Treasury Fund Allocation

A DAO wants to allocate 10 ETH from the treasury to fund a development project.

#### Step 1: Deploy and Setup

```javascript
const { ethers } = require("hardhat");

async function setup() {
  // Deploy governance
  const QuorumGovernance = await ethers.getContractFactory("QuorumGovernance");
  const governance = await QuorumGovernance.deploy(
    4000,  // 40% quorum
    10,    // 10 block delay
    100    // 100 block voting period
  );
  await governance.waitForDeployment();
  
  console.log("Governance deployed to:", await governance.getAddress());
  
  // Setup agents
  const [owner, agent1, agent2, agent3, agent4] = await ethers.getSigners();
  
  // Register 4 agents with different voting weights
  await governance.registerAgent(agent1.address, 100, "ipfs://agent1-profile");
  await governance.registerAgent(agent2.address, 150, "ipfs://agent2-profile");
  await governance.registerAgent(agent3.address, 75, "ipfs://agent3-profile");
  await governance.registerAgent(agent4.address, 75, "ipfs://agent4-profile");
  
  // Verify all agents
  await governance.verifyAgent(agent1.address);
  await governance.verifyAgent(agent2.address);
  await governance.verifyAgent(agent3.address);
  await governance.verifyAgent(agent4.address);
  
  // Total voting power: 400
  // Quorum: 160 votes (40%)
  
  return { governance, owner, agent1, agent2, agent3, agent4 };
}
```

#### Step 2: Create Treasury Transfer Proposal

```javascript
async function createTreasuryProposal(governance, agent1, treasury) {
  // Encode transfer function call
  const treasuryInterface = new ethers.Interface([
    "function transfer(address recipient, uint256 amount)"
  ]);
  
  const recipient = "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb";
  const amount = ethers.parseEther("10"); // 10 ETH
  
  const calldata = treasuryInterface.encodeFunctionData("transfer", [
    recipient,
    amount
  ]);
  
  const description = "Allocate 10 ETH to development team for Q1 2024 milestones";
  
  // Create proposal
  const tx = await governance.connect(agent1).createProposal(
    treasury.address,  // Target: Treasury contract
    0,                 // Value: 0 (not sending ETH to governance)
    calldata,
    description
  );
  
  const receipt = await tx.wait();
  const event = receipt.logs.find(log => {
    try {
      return governance.interface.parseLog(log).name === "ProposalCreated";
    } catch {
      return false;
    }
  });
  
  const proposalId = governance.interface.parseLog(event).args.proposalId;
  console.log(`Proposal ${proposalId} created:`, description);
  
  return proposalId;
}
```

#### Step 3: Monitor Proposal State

```javascript
async function monitorProposal(governance, proposalId) {
  const proposal = await governance.proposals(proposalId);
  const currentBlock = await ethers.provider.getBlockNumber();
  
  console.log("\n=== Proposal Status ===");
  console.log("Current Block:", currentBlock);
  console.log("Voting Starts:", proposal.startBlock.toString());
  console.log("Voting Ends:", proposal.endBlock.toString());
  
  const state = await governance.state(proposalId);
  const stateNames = ["Pending", "Active", "Succeeded", "Defeated", "Executed", "Canceled"];
  console.log("State:", stateNames[state]);
  
  // Get voting results
  const [forVotes, againstVotes, abstainVotes, totalVotes] = 
    await governance.getVotingResults(proposalId);
  
  console.log("\n=== Voting Results ===");
  console.log("For:", forVotes.toString());
  console.log("Against:", againstVotes.toString());
  console.log("Abstain:", abstainVotes.toString());
  console.log("Total:", totalVotes.toString());
  
  const quorum = await governance.quorum();
  const hasQuorum = await governance.hasReachedQuorum(proposalId);
  console.log(`Quorum: ${quorum} votes needed, ${hasQuorum ? "REACHED" : "NOT REACHED"}`);
}
```

#### Step 4: Cast Votes

```javascript
async function conductVoting(governance, proposalId, agents) {
  const { agent1, agent2, agent3, agent4 } = agents;
  
  // Wait for voting to start
  const proposal = await governance.proposals(proposalId);
  await ethers.provider.send("evm_mine", [proposal.startBlock.toString()]);
  
  console.log("\n=== Voting Phase ===");
  
  // Agent1 (100 votes): Vote FOR
  await governance.connect(agent1).castVote(proposalId, 1);
  console.log("Agent1 voted FOR (100 votes)");
  
  // Agent2 (150 votes): Vote FOR
  await governance.connect(agent2).castVote(proposalId, 1);
  console.log("Agent2 voted FOR (150 votes)");
  
  // Agent3 (75 votes): Vote AGAINST
  await governance.connect(agent3).castVote(proposalId, 0);
  console.log("Agent3 voted AGAINST (75 votes)");
  
  // Agent4 (75 votes): Vote ABSTAIN
  await governance.connect(agent4).castVote(proposalId, 2);
  console.log("Agent4 voted ABSTAIN (75 votes)");
  
  console.log("\nVoting complete!");
  console.log("Results: 250 FOR, 75 AGAINST, 75 ABSTAIN");
  console.log("Total: 400 votes (Quorum: 160) ✓");
  console.log("Outcome: FOR > AGAINST → SUCCEEDED");
}
```

#### Step 5: Execute Proposal

```javascript
async function executeProposal(governance, proposalId) {
  // Wait for voting period to end
  const proposal = await governance.proposals(proposalId);
  await ethers.provider.send("evm_mine", [proposal.endBlock.toString()]);
  
  // Check state
  const state = await governance.state(proposalId);
  if (state !== 2) { // 2 = Succeeded
    throw new Error("Proposal did not succeed");
  }
  
  console.log("\n=== Execution Phase ===");
  console.log("Proposal succeeded, executing...");
  
  // Execute
  const tx = await governance.executeProposal(proposalId);
  await tx.wait();
  
  console.log("✓ Proposal executed successfully!");
  console.log("10 ETH transferred to development team");
}
```

#### Complete Script

```javascript
async function main() {
  // Setup
  const { governance, owner, agent1, agent2, agent3, agent4 } = await setup();
  
  // Deploy mock treasury (for demo)
  const Treasury = await ethers.getContractFactory("Treasury");
  const treasury = await Treasury.deploy();
  
  // Create proposal
  const proposalId = await createTreasuryProposal(governance, agent1, treasury);
  
  // Monitor before voting
  await monitorProposal(governance, proposalId);
  
  // Conduct voting
  await conductVoting(governance, proposalId, { agent1, agent2, agent3, agent4 });
  
  // Monitor after voting
  await monitorProposal(governance, proposalId);
  
  // Execute
  await executeProposal(governance, proposalId);
  
  console.log("\n=== Workflow Complete ===");
}

main().catch(console.error);
```

---

## Common Use Cases

### Use Case 1: Parameter Update Governance

Update contract parameters through governance voting.

```javascript
async function proposeParameterUpdate(governance, targetContract, agent) {
  // Encode parameter update
  const iface = new ethers.Interface([
    "function updateFeeRate(uint256 newRate)"
  ]);
  
  const calldata = iface.encodeFunctionData("updateFeeRate", [250]); // 2.5%
  
  const tx = await governance.connect(agent).createProposal(
    targetContract.address,
    0,
    calldata,
    "Update protocol fee rate to 2.5%"
  );
  
  return tx;
}
```

### Use Case 2: Multi-Signature Approval

Use governance as a multi-sig alternative with weighted voting.

```javascript
async function multiSigApproval(governance, agents) {
  // 3 agents must approve (quorum 60%)
  // Total voting power: 300
  // Need: 180 votes
  
  const proposalId = await createWithdrawalProposal(governance);
  
  // Agent1 (100 votes) approves
  await governance.connect(agents[0]).castVote(proposalId, 1);
  
  // Agent2 (100 votes) approves
  await governance.connect(agents[1]).castVote(proposalId, 1);
  
  // 200 votes > 180 quorum → Can execute
  
  // Wait for voting period
  await advanceBlocks(101);
  
  // Execute
  await governance.executeProposal(proposalId);
}
```

### Use Case 3: Emergency Response

Fast-track critical proposals with reduced delay.

```javascript
async function emergencyProposal(governance, agent, emergencyContract) {
  // Update voting delay to 1 block for emergency
  await governance.updateVotingDelay(1);
  
  // Create emergency pause proposal
  const iface = new ethers.Interface(["function pause()"]);
  const calldata = iface.encodeFunctionData("pause", []);
  
  const tx = await governance.connect(agent).createProposal(
    emergencyContract.address,
    0,
    calldata,
    "EMERGENCY: Pause protocol due to detected vulnerability"
  );
  
  const receipt = await tx.wait();
  const proposalId = receipt.events[0].args.proposalId;
  
  // Fast voting
  await ethers.provider.send("evm_mine", []); // Skip 1 block
  
  // All agents vote immediately
  await governance.connect(agent).castVote(proposalId, 1);
  // ... other agents vote
  
  return proposalId;
}
```

### Use Case 4: Agent Rotation

Replace inactive agents with new ones.

```javascript
async function rotateAgent(governance, owner, oldAgent, newAgent) {
  // Deactivate old agent
  await governance.deactivateAgent(oldAgent);
  console.log(`Deactivated: ${oldAgent}`);
  
  // Register and verify new agent
  await governance.registerAgent(newAgent, 100, "ipfs://new-agent");
  await governance.verifyAgent(newAgent);
  console.log(`Activated: ${newAgent}`);
  
  // Total voting power remains constant
}
```

### Use Case 5: Dynamic Quorum Adjustment

Adjust quorum based on participation rates.

```javascript
async function adjustQuorum(governance, proposalHistory) {
  // Calculate average participation
  let totalParticipation = 0;
  for (const proposalId of proposalHistory) {
    const [, , , totalVotes] = await governance.getVotingResults(proposalId);
    const totalPower = await governance.totalVotingPower();
    totalParticipation += (totalVotes * 10000) / totalPower;
  }
  
  const avgParticipation = totalParticipation / proposalHistory.length;
  
  // Set quorum slightly below average participation
  const newQuorum = Math.floor(avgParticipation * 0.9);
  
  // Create governance proposal to update quorum
  const iface = governance.interface;
  const calldata = iface.encodeFunctionData("updateQuorum", [newQuorum]);
  
  await governance.createProposal(
    governance.address, // Self-governance
    0,
    calldata,
    `Adjust quorum to ${newQuorum / 100}% based on participation trends`
  );
}
```

---

## Integration Patterns

### Pattern 1: Frontend Integration

```javascript
// React component example
import { ethers } from 'ethers';
import { useState, useEffect } from 'react';

function GovernanceInterface({ governanceAddress, provider }) {
  const [proposals, setProposals] = useState([]);
  const [isAgent, setIsAgent] = useState(false);
  
  useEffect(() => {
    async function loadData() {
      const governance = new ethers.Contract(
        governanceAddress,
        GovernanceABI,
        provider
      );
      
      // Check if user is verified agent
      const signer = await provider.getSigner();
      const address = await signer.getAddress();
      const agentInfo = await governance.getAgentInfo(address);
      setIsAgent(agentInfo.isVerified && agentInfo.isActive);
      
      // Load active proposals
      const count = await governance.proposalCount();
      const proposalList = [];
      
      for (let i = 1; i <= count; i++) {
        const state = await governance.state(i);
        if (state === 1) { // Active
          const info = await governance.getProposalInfo(i);
          const results = await governance.getVotingResults(i);
          proposalList.push({ id: i, info, results });
        }
      }
      
      setProposals(proposalList);
    }
    
    loadData();
  }, [governanceAddress, provider]);
  
  async function vote(proposalId, support) {
    const signer = await provider.getSigner();
    const governance = new ethers.Contract(
      governanceAddress,
      GovernanceABI,
      signer
    );
    
    const tx = await governance.castVote(proposalId, support);
    await tx.wait();
    
    alert('Vote submitted successfully!');
  }
  
  return (
    <div>
      <h2>Active Proposals</h2>
      {proposals.map(p => (
        <ProposalCard 
          key={p.id} 
          proposal={p} 
          onVote={vote}
          canVote={isAgent}
        />
      ))}
    </div>
  );
}
```

### Pattern 2: Event-Driven Bot

```javascript
// Governance monitoring bot
class GovernanceBot {
  constructor(governanceAddress, provider) {
    this.governance = new ethers.Contract(
      governanceAddress,
      GovernanceABI,
      provider
    );
  }
  
  async start() {
    console.log("Bot started, monitoring governance events...");
    
    // Listen for new proposals
    this.governance.on("ProposalCreated", async (proposalId, proposer, target, value, description) => {
      console.log(`\n🆕 New Proposal #${proposalId}`);
      console.log(`Proposer: ${proposer}`);
      console.log(`Description: ${description}`);
      
      // Notify stakeholders
      await this.sendNotification({
        type: "new_proposal",
        proposalId,
        description
      });
    });
    
    // Listen for votes
    this.governance.on("VoteCast", async (voter, proposalId, support, votes) => {
      const supportText = ["Against", "For", "Abstain"][support];
      console.log(`\n🗳️ Vote Cast on Proposal #${proposalId}`);
      console.log(`Voter: ${voter}`);
      console.log(`Support: ${supportText} (${votes} votes)`);
      
      // Check if quorum reached
      const hasQuorum = await this.governance.hasReachedQuorum(proposalId);
      if (hasQuorum) {
        console.log("✅ Quorum reached!");
        await this.sendNotification({
          type: "quorum_reached",
          proposalId
        });
      }
    });
    
    // Listen for executions
    this.governance.on("ProposalExecuted", async (proposalId) => {
      console.log(`\n✅ Proposal #${proposalId} Executed`);
      
      await this.sendNotification({
        type: "proposal_executed",
        proposalId
      });
    });
  }
  
  async sendNotification(data) {
    // Integrate with Discord, Telegram, email, etc.
    console.log("Notification:", data);
  }
}

// Start bot
const bot = new GovernanceBot(GOVERNANCE_ADDRESS, provider);
bot.start();
```

### Pattern 3: Timelock Integration

```javascript
// Add timelock delay between proposal success and execution
contract TimelockGovernance {
    QuorumGovernance public governance;
    uint256 public timelockPeriod = 2 days;
    
    mapping(uint256 => uint256) public executionTime;
    
    function queueProposal(uint256 proposalId) external {
        require(governance.state(proposalId) == ProposalState.Succeeded, "Not succeeded");
        executionTime[proposalId] = block.timestamp + timelockPeriod;
    }
    
    function executeProposal(uint256 proposalId) external {
        require(block.timestamp >= executionTime[proposalId], "Timelock not expired");
        governance.executeProposal(proposalId);
    }
}
```

---

## Workflow Diagrams

### Diagram 1: Proposal Lifecycle

```
┌─────────────────────────────────────────────────────────────┐
│                    PROPOSAL LIFECYCLE                        │
└─────────────────────────────────────────────────────────────┘

    CREATE PROPOSAL
          │
          ▼
    ┌──────────┐
    │ PENDING  │ ◄─── Voting has not started yet
    └──────────┘      (waiting for votingDelay blocks)
          │
          │ votingDelay blocks pass
          ▼
    ┌──────────┐
    │  ACTIVE  │ ◄─── Agents can vote
    └──────────┘      (voting period in progress)
          │
          │ votingPeriod blocks pass
          ▼
          │
    ┌─────┴─────┐
    │           │
    ▼           ▼
┌─────────┐  ┌─────────┐
│SUCCEEDED│  │DEFEATED │
└─────────┘  └─────────┘
    │             │
    │             └─── Quorum not met OR Against > For
    │
    │ Execute
    ▼
┌─────────┐
│EXECUTED │
└─────────┘

        ┌──────────┐
        │CANCELED  │ ◄─── Can be canceled anytime before execution
        └──────────┘      (by proposer or owner)
```

### Diagram 2: Voting Process

```
┌─────────────────────────────────────────────────────────────┐
│                      VOTING PROCESS                          │
└─────────────────────────────────────────────────────────────┘

AGENT checks if proposal is ACTIVE
          │
          ▼
    ┌──────────┐
    │  Active? │───No──► Error: Voting not active
    └──────────┘
          │
         Yes
          ▼
    ┌──────────┐
    │ Voted?   │───Yes──► Error: Already voted
    └──────────┘
          │
         No
          ▼
    Choose: FOR (1) / AGAINST (0) / ABSTAIN (2)
          │
          ▼
    ┌──────────────────────────────┐
    │ Cast Vote with Voting Power  │
    └──────────────────────────────┘
          │
          ▼
    Update Proposal Tallies:
    • forVotes += votingPower
    • againstVotes += votingPower
    • abstainVotes += votingPower
          │
          ▼
    ┌──────────────────────────────┐
    │  Emit VoteCast Event         │
    └──────────────────────────────┘
```

### Diagram 3: Quorum Calculation

```
┌─────────────────────────────────────────────────────────────┐
│                   QUORUM CALCULATION                         │
└─────────────────────────────────────────────────────────────┘

Total Voting Power = Sum of all active agents' voting power

Example:
  Agent A: 100 votes
  Agent B: 150 votes
  Agent C: 75 votes
  Agent D: 75 votes
  ────────────────
  Total: 400 votes

Quorum Basis Points = 4000 (40%)

Quorum Threshold = (400 × 4000) / 10000 = 160 votes

Proposal Votes:
  FOR:     250 votes
  AGAINST: 75 votes
  ABSTAIN: 75 votes
  ────────────────
  TOTAL:   400 votes

400 >= 160 ✓ Quorum Reached!
250 > 75   ✓ FOR wins!

Result: SUCCEEDED
```

### Diagram 4: Agent Management Flow

```
┌─────────────────────────────────────────────────────────────┐
│                  AGENT MANAGEMENT FLOW                       │
└─────────────────────────────────────────────────────────────┘

    OWNER
      │
      ▼
┌─────────────┐
│  Register   │──► Agent added to system
│   Agent     │    • isRegistered = true
└─────────────┘    • isVerified = false
      │            • isActive = false
      │            • votingPower set
      ▼
┌─────────────┐
│   Verify    │──► Agent can now participate
│   Agent     │    • isVerified = true
└─────────────┘    • isActive = true
      │            • Added to totalVotingPower
      │
      │            Agent can:
      │            • Create proposals
      │            • Cast votes
      │
      ▼
┌─────────────┐
│ Deactivate  │──► Temporarily disable agent
│   Agent     │    • isActive = false
└─────────────┘    • Removed from totalVotingPower
      │            • Cannot vote or propose
      │
      ▼
┌─────────────┐
│ Reactivate  │──► Re-enable agent
│   Agent     │    • isActive = true
└─────────────┘    • Added back to totalVotingPower
      │            • Can vote and propose again
      │
      ▼
┌─────────────┐
│   Update    │──► Change voting power
│   Power     │    • totalVotingPower adjusted
└─────────────┘    • Affects future votes only
```

---

## Advanced Scenarios

### Scenario 1: Delegate Voting Power

Implement vote delegation (not in base contract, but can be added).

```solidity
// Extension contract
contract DelegatedGovernance is QuorumGovernance {
    mapping(address => address) public delegates;
    
    function delegateVote(address delegateTo) external onlyVerifiedAgent {
        delegates[msg.sender] = delegateTo;
    }
    
    function castVote(uint256 proposalId, uint8 support) external override {
        address voter = msg.sender;
        address delegate = delegates[voter];
        
        if (delegate != address(0)) {
            voter = delegate;
        }
        
        // Use delegated address for voting
        _castVote(proposalId, support, voter);
    }
}
```

### Scenario 2: Proposal Templates

Create reusable proposal templates.

```javascript
class ProposalTemplates {
  // Template: Transfer tokens
  static tokenTransfer(tokenAddress, recipient, amount) {
    const iface = new ethers.Interface([
      "function transfer(address to, uint256 amount)"
    ]);
    
    return {
      target: tokenAddress,
      value: 0,
      calldata: iface.encodeFunctionData("transfer", [recipient, amount]),
      description: `Transfer ${ethers.formatEther(amount)} tokens to ${recipient}`
    };
  }
  
  // Template: Update parameter
  static parameterUpdate(contractAddress, paramName, newValue) {
    const iface = new ethers.Interface([
      `function update${paramName}(uint256 value)`
    ]);
    
    return {
      target: contractAddress,
      value: 0,
      calldata: iface.encodeFunctionData(`update${paramName}`, [newValue]),
      description: `Update ${paramName} to ${newValue}`
    };
  }
  
  // Template: Multi-call proposal
  static multiCall(calls) {
    const iface = new ethers.Interface([
      "function multiCall(address[] targets, bytes[] calldatas)"
    ]);
    
    const targets = calls.map(c => c.target);
    const calldatas = calls.map(c => c.calldata);
    
    return {
      target: MULTICALL_CONTRACT,
      value: 0,
      calldata: iface.encodeFunctionData("multiCall", [targets, calldatas]),
      description: `Execute ${calls.length} operations`
    };
  }
}

// Usage
const proposal = ProposalTemplates.tokenTransfer(
  TOKEN_ADDRESS,
  "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
  ethers.parseEther("100")
);

await governance.createProposal(
  proposal.target,
  proposal.value,
  proposal.calldata,
  proposal.description
);
```

### Scenario 3: Snapshot Voting Integration

Combine on-chain execution with off-chain voting.

```javascript
// Off-chain: Vote on Snapshot
// On-chain: Execute if Snapshot vote passed

async function executeSnapshotProposal(governance, snapshotId, proposalData) {
  // Verify Snapshot vote results
  const snapshotResults = await fetchSnapshotResults(snapshotId);
  
  if (!snapshotResults.passed) {
    throw new Error("Snapshot vote did not pass");
  }
  
  // Create on-chain proposal with Snapshot reference
  const description = `Execute Snapshot proposal ${snapshotId}: ${proposalData.title}`;
  
  const tx = await governance.createProposal(
    proposalData.target,
    proposalData.value,
    proposalData.calldata,
    description
  );
  
  // Since off-chain vote passed, agents can vote FOR on-chain
  // This provides execution security while reducing gas costs
}
```

### Scenario 4: Conditional Execution

Execute proposals only if certain conditions are met.

```solidity
contract ConditionalGovernance is QuorumGovernance {
    mapping(uint256 => bytes32) public conditions;
    
    function createConditionalProposal(
        address target,
        uint256 value,
        bytes memory calldataParam,
        string memory description,
        bytes32 condition
    ) external returns (uint256) {
        uint256 proposalId = createProposal(target, value, calldataParam, description);
        conditions[proposalId] = condition;
        return proposalId;
    }
    
    function executeProposal(uint256 proposalId) external override returns (bytes memory) {
        bytes32 condition = conditions[proposalId];
        
        if (condition != bytes32(0)) {
            require(checkCondition(condition), "Condition not met");
        }
        
        return super.executeProposal(proposalId);
    }
    
    function checkCondition(bytes32 condition) internal view returns (bool) {
        // Implement condition checking logic
        // e.g., price oracle, time constraints, external contract state
        return true;
    }
}
```

---

## Testing Patterns

### Integration Test Example

```javascript
describe("End-to-End Governance Flow", function() {
  it("Should complete full governance cycle", async function() {
    // Setup
    const { governance, agents } = await setupGovernance();
    const [agent1, agent2, agent3] = agents;
    
    // Create proposal
    const proposalId = await createTestProposal(governance, agent1);
    expect(await governance.state(proposalId)).to.equal(0); // Pending
    
    // Wait for voting to start
    await advanceBlocks(2);
    expect(await governance.state(proposalId)).to.equal(1); // Active
    
    // Vote
    await governance.connect(agent1).castVote(proposalId, 1); // FOR
    await governance.connect(agent2).castVote(proposalId, 1); // FOR
    await governance.connect(agent3).castVote(proposalId, 0); // AGAINST
    
    // Check quorum
    expect(await governance.hasReachedQuorum(proposalId)).to.be.true;
    
    // Wait for voting to end
    await advanceBlocks(101);
    expect(await governance.state(proposalId)).to.equal(2); // Succeeded
    
    // Execute
    await governance.executeProposal(proposalId);
    expect(await governance.state(proposalId)).to.equal(4); // Executed
  });
});
```

---

## Best Practices

1. **Always check proposal state** before operations
2. **Monitor events** for real-time updates
3. **Use proper error handling** for vote transactions
4. **Validate quorum** before expecting execution
5. **Set appropriate voting periods** for your use case
6. **Document proposals thoroughly** with clear descriptions
7. **Test governance flows** extensively before deployment
8. **Consider timelock delays** for security
9. **Implement emergency procedures** for critical situations
10. **Maintain agent registry** documentation off-chain

---

## Resources

- [API Documentation](./API_DOCUMENTATION.md)
- [Security Considerations](./SECURITY.md)
- [Gas Optimization Guide](./GAS_OPTIMIZATION.md)
- [Architecture Overview](./README.md)
