/**
 * Agent Configuration for QuorumGovernance
 * 
 * Copy this file to agents.config.js and customize for your deployment
 */

module.exports = {
  agents: [
    {
      // Agent wallet address
      address: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
      
      // Voting power (weight) for this agent
      votingPower: 100,
      
      // Metadata (IPFS hash, identifier, or description)
      metadata: "ipfs://QmAgentProfile1",
      
      // Auto-verify after registration (default: true)
      autoVerify: true
    },
    {
      address: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
      votingPower: 150,
      metadata: "ipfs://QmAgentProfile2",
      autoVerify: true
    },
    {
      address: "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
      votingPower: 50,
      metadata: "ipfs://QmAgentProfile3",
      autoVerify: true
    }
  ]
};
