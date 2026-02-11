const hre = require("hardhat");

/**
 * @title QuorumGovernance Deployment Script
 * @notice Deploys the QuorumGovernance contract with configurable parameters
 */

async function main() {
  console.log("\n========================================");
  console.log("  QuorumGovernance Deployment Script");
  console.log("========================================\n");

  // Configuration
  const config = {
    quorumBasisPoints: process.env.QUORUM_BASIS_POINTS || 4000, // 40% default
    votingPeriod: process.env.VOTING_PERIOD || 50400, // ~7 days (12s blocks)
    votingDelay: process.env.VOTING_DELAY || 7200, // ~1 day
  };

  console.log("Deployment Configuration:");
  console.log(`- Quorum: ${config.quorumBasisPoints / 100}%`);
  console.log(`- Voting Period: ${config.votingPeriod} blocks`);
  console.log(`- Voting Delay: ${config.votingDelay} blocks\n`);

  // Get deployer
  const [deployer] = await hre.ethers.getSigners();
  console.log(`Deploying from: ${deployer.address}`);
  console.log(`Balance: ${hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address))} ETH\n`);

  // Deploy contract
  console.log("Deploying QuorumGovernance...");
  const QuorumGovernance = await hre.ethers.getContractFactory("QuorumGovernance");
  const governance = await QuorumGovernance.deploy(
    config.quorumBasisPoints,
    config.votingPeriod,
    config.votingDelay
  );

  await governance.waitForDeployment();
  const address = await governance.getAddress();

  console.log(`✅ QuorumGovernance deployed to: ${address}\n`);

  // Verification info
  console.log("========================================");
  console.log("  Deployment Summary");
  console.log("========================================");
  console.log(`Contract Address: ${address}`);
  console.log(`Deployer (Owner): ${deployer.address}`);
  console.log(`Network: ${hre.network.name}`);
  console.log(`\nTo verify on Etherscan:");
  console.log(`npx hardhat verify --network ${hre.network.name} ${address} ${config.quorumBasisPoints} ${config.votingPeriod} ${config.votingDelay}\n`);

  return { governance, address, config };
}

// Execute deployment
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = { main };