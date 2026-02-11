# QuorumGovernance

A production-ready Solidity smart contract implementing agent-based governance with weighted voting, quorum enforcement, and proposal execution.

[![Solidity](https://img.shields.io/badge/Solidity-^0.8.20-blue)](https://soliditylang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Tests](https://img.shields.io/badge/Tests-100%25-brightgreen)](#testing)

---

## Overview

QuorumGovernance enables decentralized decision-making through a secure, transparent voting system where verified agents cast weighted votes on proposals. Built for DAOs, protocol governance, and multi-signature alternatives.

### Key Features

- **Agent-Based Voting** - Register and verify trusted agents with customizable voting power
- **Weighted Votes** - Each agent's influence scales with their assigned voting power
- **Quorum Enforcement** - Configurable threshold ensures minimum participation
- **Proposal Lifecycle** - Clear state machine from creation through execution
- **Two-Step Verification** - Register then verify agents for security
- **Flexible Timing** - Configurable voting delay and period
- **Gas Optimized** - Efficient storage and operations
- **Event-Rich** - Comprehensive event emission for monitoring

---

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────┐
│                    QuorumGovernance                      │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌────────────────┐        ┌─────────────────┐         │
│  │ Agent Registry │        │ Proposal System │         │
│  ├────────────────┤        ├─────────────────┤         │
│  │ • Register     │        │ • Create        │         │
│  │ • Verify       │        │ • Vote          │         │
│  │ • Activate     │        │ • Execute       │         │
│  │ • Deactivate   │        │ • Cancel        │         │
│  └────────────────┘        └─────────────────┘         │
│                                                          │
│  ┌────────────────┐        ┌─────────────────┐         │
│  │ Voting System  │        │ Configuration   │         │
│  ├────────────────┤        ├─────────────────┤         │
│  │ • Cast Vote    │        │ • Quorum        │         │
│  │ • Count Votes  │        │ • Voting Delay  │         │
│  │ • Check Quorum │        │ • Voting Period │         │
│  └────────────────┘        └─────────────────┘         │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### Proposal State Machine

```
CREATE → PENDING → ACTIVE → SUCCEEDED → EXECUTED
                      ↓
                  DEFEATED
                  
         CANCELED (anytime before execution)
```

### Core Concepts

1. **Agents** - Verified participants who can vote and create proposals
2. **Voting Power** - Weighted influence assigned to each agent
3. **Quorum** - Minimum participation threshold (e.g., 40% of total voting power)
4. **Proposals** - Executable actions voted on by agents
5. **State Machine** - Proposals progress through defined states

---

## Getting Started

### Prerequisites

- Node.js >= 16
- Hardhat or Foundry
- Solidity ^0.8.20

### Installation

```bash
# Clone repository
git clone https://github.com/your-org/quorum-governance.git
cd quorum-governance

# Install dependencies
npm install

# Compile contracts
npx hardhat compile
```

### Quick Deploy

```bash
# Deploy to local network
npx hardhat run scripts/deploy.js --network localhost

# Deploy to testnet (Goerli)
npx hardhat run scripts/deploy.js --network goerli

# With custom parameters
QUORUM_BP=5000 VOTING_DELAY=10 VOTING_PERIOD=200 npx hardhat run scripts/deploy.js
```

### Basic Usage

```javascript
const { ethers } = require("hardhat");

// Deploy
const QuorumGovernance = await ethers.getContractFactory("QuorumGovernance");
const governance = await QuorumGovernance.deploy(
  4000,  // 40% quorum
  1,     // 1 block voting delay
  100    // 100 block voting period
);

// Register agent
await governance.registerAgent(agentAddress, 100, "ipfs://metadata");
await governance.verifyAgent(agentAddress);

// Create proposal
const tx = await governance.connect(agent).createProposal(
  targetAddress,
  0,
  calldata,
  "Proposal description"
);

// Vote (0=Against, 1=For, 2=Abstain)
await governance.connect(agent).castVote(proposalId, 1);

// Execute (after voting period ends and proposal succeeds)
await governance.executeProposal(proposalId);
```

---

## Configuration

### Constructor Parameters

| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `quorumBasisPoints` | uint256 | Quorum percentage in basis points | 4000 = 40% |
| `votingDelay` | uint256 | Blocks before voting starts | 1 |
| `votingPeriod` | uint256 | Blocks voting remains active | 100 |

### Quorum Calculation

```
Quorum Threshold = (Total Voting Power × Quorum Basis Points) / 10000

Example:
Total Voting Power = 400
Quorum = 40% (4000 basis points)
Threshold = (400 × 4000) / 10000 = 160 votes needed
```

### Voting Power Distribution

Recommended distribution strategies:

**Equal Power** (Democratic)
```javascript
await governance.registerAgent(agent1, 100, "...");
await governance.registerAgent(agent2, 100, "...");
await governance.registerAgent(agent3, 100, "...");
// Each agent has equal influence
```

**Stake-Based** (Plutocratic)
```javascript
await governance.registerAgent(largeHolder, 500, "...");
await governance.registerAgent(mediumHolder, 200, "...");
await governance.registerAgent(smallHolder, 50, "...");
// Voting power proportional to stake
```

**Role-Based** (Hybrid)
```javascript
await governance.registerAgent(coreDev, 150, "...");
await governance.registerAgent(advisor, 100, "...");
await governance.registerAgent(community, 50, "...");
// Different roles have different weights
```

---

## Testing

Comprehensive test suite with 100% coverage.

```bash
# Run all tests
npx hardhat test

# Run with coverage
npx hardhat coverage

# Run specific test file
npx hardhat test test/QuorumGovernance.test.js

# Run with gas reporting
REPORT_GAS=true npx hardhat test
```

### Test Categories

- **Deployment Tests** - Constructor validation
- **Agent Management** - Registration, verification, activation
- **Proposal Creation** - Valid/invalid proposal scenarios
- **Voting** - Vote casting, double-voting prevention, weight calculation
- **Quorum** - Threshold calculation and enforcement
- **State Machine** - Proposal state transitions
- **Execution** - Successful execution and failure cases
- **Edge Cases** - Tie votes, maximum values, simultaneous proposals

---

## API Documentation

### Agent Management

#### `registerAgent(address, uint256, string)`
Register a new agent with voting power and metadata.

#### `verifyAgent(address)`
Verify a registered agent, enabling them to vote.

#### `deactivateAgent(address)`
Temporarily disable an agent.

#### `updateVotingPower(address, uint256)`
Change an agent's voting weight.

### Proposal Functions

#### `createProposal(address, uint256, bytes, string)`
Create a new governance proposal.

#### `castVote(uint256, uint8)`
Vote on an active proposal (0=Against, 1=For, 2=Abstain).

#### `executeProposal(uint256)`
Execute a succeeded proposal.

#### `cancelProposal(uint256)`
Cancel a proposal before execution.

### Query Functions

#### `state(uint256)`
Get current proposal state.

#### `hasReachedQuorum(uint256)`
Check if proposal met quorum threshold.

#### `getVotingResults(uint256)`
Get detailed vote breakdown.

#### `getProposalInfo(uint256)`
Get proposal details.

#### `getAgentInfo(address)`
Get agent details.

**Full API Reference:** [API_DOCUMENTATION.md](docs/API_DOCUMENTATION.md)

---

## Examples

### Complete Workflow

```javascript
// 1. Setup
const { governance, agents } = await deployAndSetup();

// 2. Create proposal to transfer funds
const proposalId = await governance.connect(agents[0]).createProposal(
  treasuryAddress,
  0,
  transferCalldata,
  "Allocate 10 ETH to development team"
);

// 3. Wait for voting to start
await advanceBlocks(2);

// 4. Agents vote
await governance.connect(agents[0]).castVote(proposalId, 1); // FOR
await governance.connect(agents[1]).castVote(proposalId, 1); // FOR
await governance.connect(agents[2]).castVote(proposalId, 0); // AGAINST

// 5. Check results
const [forVotes, againstVotes, abstainVotes] = 
  await governance.getVotingResults(proposalId);
console.log(`For: ${forVotes}, Against: ${againstVotes}`);

// 6. Wait for voting to end
await advanceBlocks(101);

// 7. Execute if succeeded
const state = await governance.state(proposalId);
if (state === 2) { // Succeeded
  await governance.executeProposal(proposalId);
}
```

### Multi-Signature Alternative

```javascript
// Use governance as 3-of-5 multi-sig with equal voting power
const signers = [addr1, addr2, addr3, addr4, addr5];

// Register all signers with equal power
for (const signer of signers) {
  await governance.registerAgent(signer, 100, "ipfs://...");
  await governance.verifyAgent(signer);
}

// Set quorum to 60% (need 3 out of 5)
await governance.updateQuorum(6000);

// Create withdrawal proposal
const proposalId = await createWithdrawal(recipient, amount);

// 3 signers vote FOR
await governance.connect(signer1).castVote(proposalId, 1);
await governance.connect(signer2).castVote(proposalId, 1);
await governance.connect(signer3).castVote(proposalId, 1);

// Quorum reached (300/500 = 60%), execute
await governance.executeProposal(proposalId);
```

**More Examples:** [EXAMPLES.md](docs/EXAMPLES.md)

---

## Security

### Audit Status

- **Internal Review:** ✅ Completed
- **Test Coverage:** ✅ 100%
- **Static Analysis:** ✅ Passed (Slither, Mythril)
- **External Audit:** ⏳ Pending

### Security Features

- ✅ Reentrancy protection (Checks-Effects-Interactions)
- ✅ Access control (owner-only functions)
- ✅ Double-voting prevention
- ✅ Quorum enforcement
- ✅ State validation
- ✅ Custom errors for gas efficiency

### Recommendations

For production deployment:

1. **Use Multi-Sig as Owner** - Gnosis Safe with 3/5 or 4/7 setup
2. **Add Timelock** - 24-48 hour delay between success and execution
3. **Test Thoroughly** - Deploy to testnet first, run end-to-end tests
4. **Monitor Events** - Set up real-time monitoring for governance actions
5. **Document Agents** - Maintain off-chain registry of agent identities

**Full Security Analysis:** [SECURITY_AND_GAS.md](docs/SECURITY_AND_GAS.md)

---

## Gas Optimization

### Gas Costs (Estimated)

| Operation | Gas Cost |
|-----------|----------|
| Deploy | ~3,500,000 |
| Register Agent | ~85,000 |
| Verify Agent | ~45,000 |
| Create Proposal | ~180,000 |
| Cast Vote | ~95,000 |
| Execute Proposal | ~50,000 + target |

### Optimization Tips

1. **Batch Operations** - Register multiple agents in one transaction
2. **Early Voting** - Vote early to avoid gas price spikes
3. **Custom Errors** - Using custom errors saves ~50 gas per revert
4. **Storage Packing** - Optimized struct layout reduces storage costs

**Gas Optimization Guide:** [SECURITY_AND_GAS.md](docs/SECURITY_AND_GAS.md)

---

## Deployment Guide

### Local Development

```bash
# Start local node
npx hardhat node

# Deploy (in another terminal)
npx hardhat run scripts/deploy.js --network localhost

# Setup agents
GOVERNANCE_ADDRESS=0x... npx hardhat run scripts/setup-agents.js --network localhost
```

### Testnet Deployment (Goerli)

```bash
# Configure .env
GOERLI_RPC_URL=https://goerli.infura.io/v3/YOUR_KEY
PRIVATE_KEY=your_private_key
ETHERSCAN_API_KEY=your_etherscan_key

# Deploy
npx hardhat run scripts/deploy.js --network goerli

# Verify on Etherscan
npx hardhat verify --network goerli DEPLOYED_ADDRESS 4000 1 100
```

### Mainnet Deployment

```bash
# ⚠️ Use multi-sig wallet as deployer
# ⚠️ Test extensively on testnet first
# ⚠️ Have emergency procedures ready

npx hardhat run scripts/deploy.js --network mainnet

# Immediately transfer ownership to multi-sig
npx hardhat run scripts/transfer-ownership.js --network mainnet
```

---

## Project Structure

```
quorum-governance/
├── contracts/
│   └── QuorumGovernance.sol       # Main contract
├── scripts/
│   ├── deploy.js                   # Deployment script
│   ├── setup-agents.js             # Agent setup script
│   └── agents.config.example.js    # Agent configuration template
├── test/
│   └── QuorumGovernance.test.js   # Comprehensive tests
├── docs/
│   ├── API_DOCUMENTATION.md        # Full API reference
│   ├── EXAMPLES.md                 # Usage examples
│   └── SECURITY_AND_GAS.md        # Security & optimization guide
├── hardhat.config.js
├── package.json
└── README.md
```

---

## Contributing

Contributions welcome! Please follow these guidelines:

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. **Write** tests for new functionality
4. **Ensure** all tests pass (`npx hardhat test`)
5. **Commit** changes (`git commit -m 'Add amazing feature'`)
6. **Push** to branch (`git push origin feature/amazing-feature`)
7. **Open** a Pull Request

### Development Guidelines

- Write comprehensive tests for all new features
- Follow Solidity style guide
- Document all public functions
- Add gas optimization notes where applicable
- Update documentation for API changes

---

## Roadmap

### Version 1.0 (Current)
- ✅ Core governance functionality
- ✅ Agent management system
- ✅ Weighted voting
- ✅ Quorum enforcement
- ✅ Comprehensive testing
- ✅ Full documentation

### Version 1.1 (Planned)
- ⏳ Timelock integration
- ⏳ Emergency pause mechanism
- ⏳ Batch operations
- ⏳ EIP-712 signature support
- ⏳ Vote delegation

### Version 2.0 (Future)
- 📋 Upgradeable architecture
- 📋 NFT-based voting power
- 📋 Snapshot integration
- 📋 Multi-chain support
- 📋 Governance analytics dashboard

---

## FAQ

**Q: Can I use this for token-based governance?**  
A: Yes, but you'll need to integrate with a token contract. The current version uses registered voting power, but you can extend it to query token balances.

**Q: What happens if quorum isn't reached?**  
A: The proposal automatically enters the Defeated state and cannot be executed.

**Q: Can voting power be changed during active voting?**  
A: Yes, but it only affects future votes, not votes already cast.

**Q: How do I handle proposal execution failures?**  
A: The execution returns failure data. The proposal can be re-executed if the issue is resolved, or canceled by the proposer/owner.

**Q: Is this production-ready?**  
A: Yes, with proper configuration and security measures (multi-sig owner, thorough testing, monitoring). Professional audit recommended for high-value deployments.

**Q: Can I use this on any EVM chain?**  
A: Yes! QuorumGovernance works on Ethereum, Polygon, BSC, Arbitrum, Optimism, and any EVM-compatible chain.

---

## License

MIT License - see [LICENSE](LICENSE) file for details.

---

## Support

- **Documentation:** [docs/](docs/)
- **Issues:** [GitHub Issues](https://github.com/your-org/quorum-governance/issues)
- **Discussions:** [GitHub Discussions](https://github.com/your-org/quorum-governance/discussions)
- **Security:** Report vulnerabilities to security@your-org.com

---

## Acknowledgments

Built with:
- [Hardhat](https://hardhat.org/) - Ethereum development environment
- [OpenZeppelin](https://openzeppelin.com/) - Secure smart contract standards
- [Ethers.js](https://docs.ethers.io/) - Ethereum library

---

## Related Projects

- [Compound Governance](https://github.com/compound-finance/compound-protocol/tree/master/contracts/Governance) - Token-based governance
- [OpenZeppelin Governor](https://docs.openzeppelin.com/contracts/4.x/governance) - Modular governance framework
- [Snapshot](https://snapshot.org/) - Off-chain voting platform

---

**Made with ❤️ by the QuorumGovernance team**
