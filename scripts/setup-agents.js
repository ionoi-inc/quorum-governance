const hre = require("hardhat");

/**
 * Agent setup script for QuorumGovernance
 * 
 * This script helps initialize the governance system with agents
 * 
 * Configuration via agents.config.js or environment variables
 * 
 * Usage:
 * npx hardhat run scripts/setup-agents.js --network <network-name>
 */

async function main() {
  console.log("========================================");
  console.log("QuorumGovernance Agent Setup");
  console.log("========================================\n");

  // Load contract address from environment
  const contractAddress = process.env.GOVERNANCE_ADDRESS;
  if (!contractAddress) {
    throw new Error("GOVERNANCE_ADDRESS environment variable not set");
  }

  console.log("Governance Contract:", contractAddress);
  console.log();

  // Get signer
  const [owner] = await hre.ethers.getSigners();
  console.log("Setup from account:", owner.address);
  console.log();

  // Connect to deployed contract
  const QuorumGovernance = await hre.ethers.getContractFactory("QuorumGovernance");
  const governance = QuorumGovernance.attach(contractAddress);

  // Verify contract ownership
  const contractOwner = await governance.owner();
  if (contractOwner.toLowerCase() !== owner.address.toLowerCase()) {
    throw new Error(`Not contract owner. Owner is: ${contractOwner}`);
  }

  // Load agent configuration
  let agents;
  try {
    const config = require('./agents.config.js');
    agents = config.agents;
  } catch (error) {
    // Use default test agents if config not found
    console.log("No agents.config.js found, using example configuration\n");
    agents = [
      {
        address: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
        votingPower: 100,
        metadata: "ipfs://QmExample1"
      },
      {
        address: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
        votingPower: 150,
        metadata: "ipfs://QmExample2"
      },
      {
        address: "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
        votingPower: 50,
        metadata: "ipfs://QmExample3"
      }
    ];
  }

  console.log(`Setting up ${agents.length} agents...\n`);

  // Register agents
  for (let i = 0; i < agents.length; i++) {
    const agent = agents[i];
    console.log(`Agent ${i + 1}/${agents.length}`);
    console.log(`- Address: ${agent.address}`);
    console.log(`- Voting Power: ${agent.votingPower}`);
    console.log(`- Metadata: ${agent.metadata}`);

    try {
      // Check if already registered
      const agentInfo = await governance.agents(agent.address);
      
      if (agentInfo.isRegistered) {
        console.log("⚠ Already registered, skipping...");
      } else {
        // Register agent
        const tx = await governance.registerAgent(
          agent.address,
          agent.votingPower,
          agent.metadata
        );
        await tx.wait();
        console.log("✓ Registered");

        // Verify agent if specified
        if (agent.autoVerify !== false) {
          const verifyTx = await governance.verifyAgent(agent.address);
          await verifyTx.wait();
          console.log("✓ Verified");
        }
      }
    } catch (error) {
      console.error("✗ Error:", error.message);
    }

    console.log();
  }

  // Display final state
  console.log("========================================");
  console.log("Setup Complete");
  console.log("========================================");
  
  const totalVotingPower = await governance.totalVotingPower();
  const quorum = await governance.quorum();
  const quorumBp = await governance.quorumBasisPoints();

  console.log(`Total Voting Power: ${totalVotingPower}`);
  console.log(`Quorum Threshold: ${quorum} votes (${quorumBp / 100}%)`);
  console.log();

  // List all registered agents
  console.log("Registered Agents:");
  for (const agent of agents) {
    const info = await governance.agents(agent.address);
    if (info.isRegistered) {
      console.log(`- ${agent.address}: ${info.votingPower} votes, verified: ${info.isVerified}, active: ${info.isActive}`);
    }
  }
  console.log();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

module.exports = { main };
