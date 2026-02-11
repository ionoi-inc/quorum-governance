const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time, loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("QuorumGovernance", function () {
  // ============ Fixtures ============
  
  async function deployGovernanceFixture() {
    const [owner, agent1, agent2, agent3, nonAgent, proposer] = await ethers.getSigners();
    
    const QuorumGovernance = await ethers.getContractFactory("QuorumGovernance");
    const governance = await QuorumGovernance.deploy(
      4000, // 40% quorum
      1,    // 1 block voting delay
      100   // 100 blocks voting period
    );
    
    return { governance, owner, agent1, agent2, agent3, nonAgent, proposer };
  }
  
  async function deployWithAgentsFixture() {
    const fixture = await deployGovernanceFixture();
    const { governance, agent1, agent2, agent3 } = fixture;
    
    // Register and verify agents
    await governance.registerAgent(agent1.address, 100, "ipfs://agent1");
    await governance.registerAgent(agent2.address, 150, "ipfs://agent2");
    await governance.registerAgent(agent3.address, 50, "ipfs://agent3");
    
    await governance.verifyAgent(agent1.address);
    await governance.verifyAgent(agent2.address);
    await governance.verifyAgent(agent3.address);
    
    return fixture;
  }
  
  async function deployWithProposalFixture() {
    const fixture = await deployWithAgentsFixture();
    const { governance, agent1 } = fixture;
    
    // Create a proposal
    const target = ethers.ZeroAddress;
    const value = 0;
    const callData = "0x";
    const description = "Test Proposal #1";
    
    const tx = await governance.connect(agent1).createProposal(
      target,
      value,
      callData,
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
    
    // Advance past voting delay
    await time.advanceBlock(2);
    
    return { ...fixture, proposalId, target, value, callData, description };
  }

  // ============ Deployment Tests ============
  
  describe("Deployment", function () {
    it("Should set the correct owner", async function () {
      const { governance, owner } = await loadFixture(deployGovernanceFixture);
      expect(await governance.owner()).to.equal(owner.address);
    });

    it("Should set the correct quorum basis points", async function () {
      const { governance } = await loadFixture(deployGovernanceFixture);
      expect(await governance.quorumBasisPoints()).to.equal(4000);
    });

    it("Should set the correct voting delay", async function () {
      const { governance } = await loadFixture(deployGovernanceFixture);
      expect(await governance.votingDelay()).to.equal(1);
    });

    it("Should set the correct voting period", async function () {
      const { governance } = await loadFixture(deployGovernanceFixture);
      expect(await governance.votingPeriod()).to.equal(100);
    });

    it("Should revert with invalid quorum (>10000)", async function () {
      const QuorumGovernance = await ethers.getContractFactory("QuorumGovernance");
      await expect(
        QuorumGovernance.deploy(10001, 1, 100)
      ).to.be.revertedWith("Quorum must be <= 10000 basis points");
    });

    it("Should revert with zero voting period", async function () {
      const QuorumGovernance = await ethers.getContractFactory("QuorumGovernance");
      await expect(
        QuorumGovernance.deploy(4000, 1, 0)
      ).to.be.revertedWith("Voting period must be > 0");
    });
  });

  // ============ Agent Management Tests ============
  
  describe("Agent Management", function () {
    describe("Registration", function () {
      it("Should register an agent successfully", async function () {
        const { governance, agent1 } = await loadFixture(deployGovernanceFixture);
        
        await expect(governance.registerAgent(agent1.address, 100, "ipfs://agent1"))
          .to.emit(governance, "AgentRegistered")
          .withArgs(agent1.address, 100, "ipfs://agent1");
        
        const agent = await governance.agents(agent1.address);
        expect(agent.isRegistered).to.be.true;
        expect(agent.isVerified).to.be.false;
        expect(agent.votingPower).to.equal(100);
      });

      it("Should revert when non-owner tries to register", async function () {
        const { governance, agent1, agent2 } = await loadFixture(deployGovernanceFixture);
        
        await expect(
          governance.connect(agent1).registerAgent(agent2.address, 100, "ipfs://agent2")
        ).to.be.revertedWith("Only owner can call this function");
      });

      it("Should revert when registering zero address", async function () {
        const { governance } = await loadFixture(deployGovernanceFixture);
        
        await expect(
          governance.registerAgent(ethers.ZeroAddress, 100, "ipfs://agent")
        ).to.be.revertedWith("Invalid agent address");
      });

      it("Should revert when registering with zero voting power", async function () {
        const { governance, agent1 } = await loadFixture(deployGovernanceFixture);
        
        await expect(
          governance.registerAgent(agent1.address, 0, "ipfs://agent1")
        ).to.be.revertedWith("Voting power must be > 0");
      });

      it("Should revert when agent already registered", async function () {
        const { governance, agent1 } = await loadFixture(deployGovernanceFixture);
        
        await governance.registerAgent(agent1.address, 100, "ipfs://agent1");
        
        await expect(
          governance.registerAgent(agent1.address, 100, "ipfs://agent1")
        ).to.be.revertedWith("Agent already registered");
      });

      it("Should update total voting power correctly", async function () {
        const { governance, agent1, agent2 } = await loadFixture(deployGovernanceFixture);
        
        await governance.registerAgent(agent1.address, 100, "ipfs://agent1");
        expect(await governance.totalVotingPower()).to.equal(100);
        
        await governance.registerAgent(agent2.address, 150, "ipfs://agent2");
        expect(await governance.totalVotingPower()).to.equal(250);
      });
    });

    describe("Verification", function () {
      it("Should verify a registered agent", async function () {
        const { governance, agent1 } = await loadFixture(deployGovernanceFixture);
        
        await governance.registerAgent(agent1.address, 100, "ipfs://agent1");
        
        await expect(governance.verifyAgent(agent1.address))
          .to.emit(governance, "AgentVerified")
          .withArgs(agent1.address);
        
        const agent = await governance.agents(agent1.address);
        expect(agent.isVerified).to.be.true;
      });

      it("Should revert when verifying non-registered agent", async function () {
        const { governance, agent1 } = await loadFixture(deployGovernanceFixture);
        
        await expect(
          governance.verifyAgent(agent1.address)
        ).to.be.revertedWith("Agent not registered");
      });

      it("Should revert when non-owner tries to verify", async function () {
        const { governance, agent1, agent2 } = await loadFixture(deployGovernanceFixture);
        
        await governance.registerAgent(agent1.address, 100, "ipfs://agent1");
        
        await expect(
          governance.connect(agent2).verifyAgent(agent1.address)
        ).to.be.revertedWith("Only owner can call this function");
      });
    });

    describe("Deactivation", function () {
      it("Should deactivate an agent", async function () {
        const { governance, agent1 } = await loadFixture(deployWithAgentsFixture);
        
        await expect(governance.deactivateAgent(agent1.address))
          .to.emit(governance, "AgentDeactivated")
          .withArgs(agent1.address);
        
        const agent = await governance.agents(agent1.address);
        expect(agent.isActive).to.be.false;
      });

      it("Should decrease total voting power on deactivation", async function () {
        const { governance, agent1 } = await loadFixture(deployWithAgentsFixture);
        
        const beforePower = await governance.totalVotingPower();
        const agentPower = (await governance.agents(agent1.address)).votingPower;
        
        await governance.deactivateAgent(agent1.address);
        
        const afterPower = await governance.totalVotingPower();
        expect(afterPower).to.equal(beforePower - agentPower);
      });
    });

    describe("Reactivation", function () {
      it("Should reactivate a deactivated agent", async function () {
        const { governance, agent1 } = await loadFixture(deployWithAgentsFixture);
        
        await governance.deactivateAgent(agent1.address);
        
        await expect(governance.reactivateAgent(agent1.address))
          .to.emit(governance, "AgentReactivated")
          .withArgs(agent1.address);
        
        const agent = await governance.agents(agent1.address);
        expect(agent.isActive).to.be.true;
      });

      it("Should increase total voting power on reactivation", async function () {
        const { governance, agent1 } = await loadFixture(deployWithAgentsFixture);
        
        await governance.deactivateAgent(agent1.address);
        const beforePower = await governance.totalVotingPower();
        const agentPower = (await governance.agents(agent1.address)).votingPower;
        
        await governance.reactivateAgent(agent1.address);
        
        const afterPower = await governance.totalVotingPower();
        expect(afterPower).to.equal(beforePower + agentPower);
      });
    });

    describe("Update Voting Power", function () {
      it("Should update agent voting power", async function () {
        const { governance, agent1 } = await loadFixture(deployWithAgentsFixture);
        
        await expect(governance.updateVotingPower(agent1.address, 200))
          .to.emit(governance, "VotingPowerUpdated")
          .withArgs(agent1.address, 100, 200);
        
        const agent = await governance.agents(agent1.address);
        expect(agent.votingPower).to.equal(200);
      });

      it("Should update total voting power correctly", async function () {
        const { governance, agent1 } = await loadFixture(deployWithAgentsFixture);
        
        const beforeTotal = await governance.totalVotingPower();
        const oldPower = (await governance.agents(agent1.address)).votingPower;
        const newPower = 200;
        
        await governance.updateVotingPower(agent1.address, newPower);
        
        const afterTotal = await governance.totalVotingPower();
        expect(afterTotal).to.equal(beforeTotal - oldPower + newPower);
      });

      it("Should revert when updating to zero power", async function () {
        const { governance, agent1 } = await loadFixture(deployWithAgentsFixture);
        
        await expect(
          governance.updateVotingPower(agent1.address, 0)
        ).to.be.revertedWith("Voting power must be > 0");
      });
    });
  });

  // ============ Proposal Tests ============
  
  describe("Proposal Creation", function () {
    it("Should create a proposal successfully", async function () {
      const { governance, agent1 } = await loadFixture(deployWithAgentsFixture);
      
      const target = ethers.ZeroAddress;
      const value = 0;
      const callData = "0x";
      const description = "Test Proposal";
      
      const currentBlock = await time.latestBlock();
      const votingDelay = await governance.votingDelay();
      const votingPeriod = await governance.votingPeriod();
      
      await expect(
        governance.connect(agent1).createProposal(target, value, callData, description)
      ).to.emit(governance, "ProposalCreated");
      
      const proposalId = 1;
      const proposal = await governance.proposals(proposalId);
      
      expect(proposal.proposer).to.equal(agent1.address);
      expect(proposal.target).to.equal(target);
      expect(proposal.value).to.equal(value);
      expect(proposal.startBlock).to.equal(currentBlock + votingDelay + 1n);
      expect(proposal.endBlock).to.equal(currentBlock + votingDelay + votingPeriod + 1n);
    });

    it("Should revert when non-verified agent creates proposal", async function () {
      const { governance, nonAgent } = await loadFixture(deployWithAgentsFixture);
      
      await expect(
        governance.connect(nonAgent).createProposal(
          ethers.ZeroAddress, 0, "0x", "Test"
        )
      ).to.be.revertedWith("Only verified and active agents");
    });

    it("Should revert when inactive agent creates proposal", async function () {
      const { governance, agent1 } = await loadFixture(deployWithAgentsFixture);
      
      await governance.deactivateAgent(agent1.address);
      
      await expect(
        governance.connect(agent1).createProposal(
          ethers.ZeroAddress, 0, "0x", "Test"
        )
      ).to.be.revertedWith("Only verified and active agents");
    });

    it("Should increment proposal count", async function () {
      const { governance, agent1 } = await loadFixture(deployWithAgentsFixture);
      
      expect(await governance.proposalCount()).to.equal(0);
      
      await governance.connect(agent1).createProposal(
        ethers.ZeroAddress, 0, "0x", "Test 1"
      );
      expect(await governance.proposalCount()).to.equal(1);
      
      await governance.connect(agent1).createProposal(
        ethers.ZeroAddress, 0, "0x", "Test 2"
      );
      expect(await governance.proposalCount()).to.equal(2);
    });
  });

  describe("Voting", function () {
    it("Should allow verified agent to vote", async function () {
      const { governance, agent1, proposalId } = await loadFixture(deployWithProposalFixture);
      
      await expect(governance.connect(agent1).castVote(proposalId, 1)) // Vote For
        .to.emit(governance, "VoteCast")
        .withArgs(agent1.address, proposalId, 1, 100);
      
      const receipt = await governance.getReceipt(proposalId, agent1.address);
      expect(receipt.hasVoted).to.be.true;
      expect(receipt.support).to.equal(1);
      expect(receipt.votes).to.equal(100);
    });

    it("Should count votes correctly", async function () {
      const { governance, agent1, agent2, agent3, proposalId } = await loadFixture(deployWithProposalFixture);
      
      // agent1: 100 votes FOR
      // agent2: 150 votes AGAINST
      // agent3: 50 votes ABSTAIN
      
      await governance.connect(agent1).castVote(proposalId, 1);
      await governance.connect(agent2).castVote(proposalId, 0);
      await governance.connect(agent3).castVote(proposalId, 2);
      
      const proposal = await governance.proposals(proposalId);
      expect(proposal.forVotes).to.equal(100);
      expect(proposal.againstVotes).to.equal(150);
      expect(proposal.abstainVotes).to.equal(50);
    });

    it("Should revert when voting twice", async function () {
      const { governance, agent1, proposalId } = await loadFixture(deployWithProposalFixture);
      
      await governance.connect(agent1).castVote(proposalId, 1);
      
      await expect(
        governance.connect(agent1).castVote(proposalId, 1)
      ).to.be.revertedWith("Already voted");
    });

    it("Should revert when non-verified agent votes", async function () {
      const { governance, nonAgent, proposalId } = await loadFixture(deployWithProposalFixture);
      
      await expect(
        governance.connect(nonAgent).castVote(proposalId, 1)
      ).to.be.revertedWith("Only verified and active agents");
    });

    it("Should revert when voting on non-existent proposal", async function () {
      const { governance, agent1 } = await loadFixture(deployWithAgentsFixture);
      
      await expect(
        governance.connect(agent1).castVote(999, 1)
      ).to.be.revertedWith("Invalid proposal");
    });

    it("Should revert when voting before start", async function () {
      const { governance, agent1 } = await loadFixture(deployWithAgentsFixture);
      
      const tx = await governance.connect(agent1).createProposal(
        ethers.ZeroAddress, 0, "0x", "Test"
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
      
      await expect(
        governance.connect(agent1).castVote(proposalId, 1)
      ).to.be.revertedWith("Voting not active");
    });

    it("Should revert when voting after end", async function () {
      const { governance, agent1, proposalId } = await loadFixture(deployWithProposalFixture);
      
      const proposal = await governance.proposals(proposalId);
      await time.advanceBlockTo(proposal.endBlock + 1n);
      
      await expect(
        governance.connect(agent1).castVote(proposalId, 1)
      ).to.be.revertedWith("Voting not active");
    });

    it("Should revert with invalid vote type", async function () {
      const { governance, agent1, proposalId } = await loadFixture(deployWithProposalFixture);
      
      await expect(
        governance.connect(agent1).castVote(proposalId, 3)
      ).to.be.revertedWith("Invalid vote type");
    });
  });

  // ============ Quorum Tests ============
  
  describe("Quorum", function () {
    it("Should calculate quorum correctly", async function () {
      const { governance } = await loadFixture(deployWithAgentsFixture);
      
      // Total voting power: 100 + 150 + 50 = 300
      // Quorum: 40% of 300 = 120
      const quorum = await governance.quorum();
      expect(quorum).to.equal(120);
    });

    it("Should detect when quorum is reached", async function () {
      const { governance, agent1, agent2, proposalId } = await loadFixture(deployWithProposalFixture);
      
      // Need 120 votes for quorum (40% of 300)
      // agent1: 100, agent2: 150 = 250 total (FOR + AGAINST + ABSTAIN)
      
      await governance.connect(agent1).castVote(proposalId, 1);
      await governance.connect(agent2).castVote(proposalId, 1);
      
      expect(await governance.hasReachedQuorum(proposalId)).to.be.true;
    });

    it("Should detect when quorum is not reached", async function () {
      const { governance, agent1, proposalId } = await loadFixture(deployWithProposalFixture);
      
      // Need 120 votes for quorum
      // agent1: 100 votes (not enough)
      
      await governance.connect(agent1).castVote(proposalId, 1);
      
      expect(await governance.hasReachedQuorum(proposalId)).to.be.false;
    });

    it("Should count abstain votes toward quorum", async function () {
      const { governance, agent1, agent3, proposalId } = await loadFixture(deployWithProposalFixture);
      
      // Need 120 votes for quorum
      // agent1: 100 FOR, agent3: 50 ABSTAIN = 150 total
      
      await governance.connect(agent1).castVote(proposalId, 1);
      await governance.connect(agent3).castVote(proposalId, 2);
      
      expect(await governance.hasReachedQuorum(proposalId)).to.be.true;
    });
  });

  // ============ Proposal State Tests ============
  
  describe("Proposal State", function () {
    it("Should return Pending state before voting starts", async function () {
      const { governance, agent1 } = await loadFixture(deployWithAgentsFixture);
      
      const tx = await governance.connect(agent1).createProposal(
        ethers.ZeroAddress, 0, "0x", "Test"
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
      
      expect(await governance.state(proposalId)).to.equal(0); // Pending
    });

    it("Should return Active state during voting period", async function () {
      const { governance, proposalId } = await loadFixture(deployWithProposalFixture);
      
      expect(await governance.state(proposalId)).to.equal(1); // Active
    });

    it("Should return Defeated when no quorum", async function () {
      const { governance, agent3, proposalId } = await loadFixture(deployWithProposalFixture);
      
      // Only 50 votes (agent3), need 120 for quorum
      await governance.connect(agent3).castVote(proposalId, 1);
      
      const proposal = await governance.proposals(proposalId);
      await time.advanceBlockTo(proposal.endBlock + 1n);
      
      expect(await governance.state(proposalId)).to.equal(3); // Defeated
    });

    it("Should return Defeated when against > for", async function () {
      const { governance, agent1, agent2, proposalId } = await loadFixture(deployWithProposalFixture);
      
      // agent1: 100 FOR, agent2: 150 AGAINST
      await governance.connect(agent1).castVote(proposalId, 1);
      await governance.connect(agent2).castVote(proposalId, 0);
      
      const proposal = await governance.proposals(proposalId);
      await time.advanceBlockTo(proposal.endBlock + 1n);
      
      expect(await governance.state(proposalId)).to.equal(3); // Defeated
    });

    it("Should return Succeeded when for > against with quorum", async function () {
      const { governance, agent1, agent2, proposalId } = await loadFixture(deployWithProposalFixture);
      
      // agent2: 150 FOR, agent1: 100 AGAINST = quorum met, FOR wins
      await governance.connect(agent2).castVote(proposalId, 1);
      await governance.connect(agent1).castVote(proposalId, 0);
      
      const proposal = await governance.proposals(proposalId);
      await time.advanceBlockTo(proposal.endBlock + 1n);
      
      expect(await governance.state(proposalId)).to.equal(2); // Succeeded
    });

    it("Should return Executed after execution", async function () {
      const { governance, agent1, agent2, proposalId } = await loadFixture(deployWithProposalFixture);
      
      await governance.connect(agent2).castVote(proposalId, 1);
      await governance.connect(agent1).castVote(proposalId, 1);
      
      const proposal = await governance.proposals(proposalId);
      await time.advanceBlockTo(proposal.endBlock + 1n);
      
      await governance.executeProposal(proposalId);
      
      expect(await governance.state(proposalId)).to.equal(4); // Executed
    });

    it("Should return Canceled after cancellation", async function () {
      const { governance, agent1, proposalId } = await loadFixture(deployWithProposalFixture);
      
      await governance.connect(agent1).cancelProposal(proposalId);
      
      expect(await governance.state(proposalId)).to.equal(5); // Canceled
    });
  });

  // ============ Execution Tests ============
  
  describe("Proposal Execution", function () {
    it("Should execute a succeeded proposal", async function () {
      const { governance, agent1, agent2, proposalId } = await loadFixture(deployWithProposalFixture);
      
      await governance.connect(agent2).castVote(proposalId, 1);
      await governance.connect(agent1).castVote(proposalId, 1);
      
      const proposal = await governance.proposals(proposalId);
      await time.advanceBlockTo(proposal.endBlock + 1n);
      
      await expect(governance.executeProposal(proposalId))
        .to.emit(governance, "ProposalExecuted")
        .withArgs(proposalId);
    });

    it("Should revert when executing non-succeeded proposal", async function () {
      const { governance, agent1, proposalId } = await loadFixture(deployWithProposalFixture);
      
      await governance.connect(agent1).castVote(proposalId, 0); // Vote against
      
      const proposal = await governance.proposals(proposalId);
      await time.advanceBlockTo(proposal.endBlock + 1n);
      
      await expect(
        governance.executeProposal(proposalId)
      ).to.be.revertedWith("Proposal not in succeeded state");
    });

    it("Should revert when executing already executed proposal", async function () {
      const { governance, agent1, agent2, proposalId } = await loadFixture(deployWithProposalFixture);
      
      await governance.connect(agent2).castVote(proposalId, 1);
      await governance.connect(agent1).castVote(proposalId, 1);
      
      const proposal = await governance.proposals(proposalId);
      await time.advanceBlockTo(proposal.endBlock + 1n);
      
      await governance.executeProposal(proposalId);
      
      await expect(
        governance.executeProposal(proposalId)
      ).to.be.revertedWith("Proposal not in succeeded state");
    });
  });

  // ============ Cancellation Tests ============
  
  describe("Proposal Cancellation", function () {
    it("Should allow proposer to cancel", async function () {
      const { governance, agent1, proposalId } = await loadFixture(deployWithProposalFixture);
      
      await expect(governance.connect(agent1).cancelProposal(proposalId))
        .to.emit(governance, "ProposalCanceled")
        .withArgs(proposalId);
    });

    it("Should allow owner to cancel", async function () {
      const { governance, proposalId } = await loadFixture(deployWithProposalFixture);
      
      await expect(governance.cancelProposal(proposalId))
        .to.emit(governance, "ProposalCanceled")
        .withArgs(proposalId);
    });

    it("Should revert when non-proposer/non-owner cancels", async function () {
      const { governance, agent2, proposalId } = await loadFixture(deployWithProposalFixture);
      
      await expect(
        governance.connect(agent2).cancelProposal(proposalId)
      ).to.be.revertedWith("Only proposer or owner");
    });

    it("Should revert when canceling executed proposal", async function () {
      const { governance, agent1, agent2, proposalId } = await loadFixture(deployWithProposalFixture);
      
      await governance.connect(agent2).castVote(proposalId, 1);
      await governance.connect(agent1).castVote(proposalId, 1);
      
      const proposal = await governance.proposals(proposalId);
      await time.advanceBlockTo(proposal.endBlock + 1n);
      
      await governance.executeProposal(proposalId);
      
      await expect(
        governance.connect(agent1).cancelProposal(proposalId)
      ).to.be.revertedWith("Cannot cancel executed proposal");
    });
  });

  // ============ Getter Function Tests ============
  
  describe("Getter Functions", function () {
    it("Should return correct voting results", async function () {
      const { governance, agent1, agent2, agent3, proposalId } = await loadFixture(deployWithProposalFixture);
      
      await governance.connect(agent1).castVote(proposalId, 1); // 100 FOR
      await governance.connect(agent2).castVote(proposalId, 0); // 150 AGAINST
      await governance.connect(agent3).castVote(proposalId, 2); // 50 ABSTAIN
      
      const [forVotes, againstVotes, abstainVotes, totalVotes] = 
        await governance.getVotingResults(proposalId);
      
      expect(forVotes).to.equal(100);
      expect(againstVotes).to.equal(150);
      expect(abstainVotes).to.equal(50);
      expect(totalVotes).to.equal(300);
    });

    it("Should return correct proposal info", async function () {
      const { governance, agent1, proposalId, target, value, callData, description } = 
        await loadFixture(deployWithProposalFixture);
      
      const info = await governance.getProposalInfo(proposalId);
      
      expect(info.proposer).to.equal(agent1.address);
      expect(info.target).to.equal(target);
      expect(info.value).to.equal(value);
      expect(info.calldataHash).to.equal(ethers.keccak256(callData));
      expect(info.description).to.equal(description);
    });

    it("Should return correct vote receipt", async function () {
      const { governance, agent1, proposalId } = await loadFixture(deployWithProposalFixture);
      
      await governance.connect(agent1).castVote(proposalId, 1);
      
      const receipt = await governance.getReceipt(proposalId, agent1.address);
      
      expect(receipt.hasVoted).to.be.true;
      expect(receipt.support).to.equal(1);
      expect(receipt.votes).to.equal(100);
    });

    it("Should return correct agent info", async function () {
      const { governance, agent1 } = await loadFixture(deployWithAgentsFixture);
      
      const info = await governance.getAgentInfo(agent1.address);
      
      expect(info.isRegistered).to.be.true;
      expect(info.isVerified).to.be.true;
      expect(info.isActive).to.be.true;
      expect(info.votingPower).to.equal(100);
      expect(info.metadata).to.equal("ipfs://agent1");
    });
  });

  // ============ Configuration Update Tests ============
  
  describe("Configuration Updates", function () {
    it("Should update quorum", async function () {
      const { governance } = await loadFixture(deployGovernanceFixture);
      
      await expect(governance.updateQuorum(5000))
        .to.emit(governance, "QuorumUpdated")
        .withArgs(4000, 5000);
      
      expect(await governance.quorumBasisPoints()).to.equal(5000);
    });

    it("Should update voting delay", async function () {
      const { governance } = await loadFixture(deployGovernanceFixture);
      
      await expect(governance.updateVotingDelay(10))
        .to.emit(governance, "VotingDelayUpdated")
        .withArgs(1, 10);
      
      expect(await governance.votingDelay()).to.equal(10);
    });

    it("Should update voting period", async function () {
      const { governance } = await loadFixture(deployGovernanceFixture);
      
      await expect(governance.updateVotingPeriod(200))
        .to.emit(governance, "VotingPeriodUpdated")
        .withArgs(100, 200);
      
      expect(await governance.votingPeriod()).to.equal(200);
    });

    it("Should revert invalid quorum update", async function () {
      const { governance } = await loadFixture(deployGovernanceFixture);
      
      await expect(
        governance.updateQuorum(10001)
      ).to.be.revertedWith("Quorum must be <= 10000 basis points");
    });

    it("Should revert invalid voting period update", async function () {
      const { governance } = await loadFixture(deployGovernanceFixture);
      
      await expect(
        governance.updateVotingPeriod(0)
      ).to.be.revertedWith("Voting period must be > 0");
    });
  });

  // ============ Edge Cases ============
  
  describe("Edge Cases", function () {
    it("Should handle tie votes as defeated", async function () {
      const { governance, agent1, agent2, proposalId } = await loadFixture(deployWithProposalFixture);
      
      // agent1: 100 FOR, agent2: 150 AGAINST, but let's make it 100 vs 100
      await governance.updateVotingPower(agent1.address, 100);
      await governance.updateVotingPower(agent2.address, 100);
      
      await governance.connect(agent1).castVote(proposalId, 1);
      await governance.connect(agent2).castVote(proposalId, 0);
      
      const proposal = await governance.proposals(proposalId);
      await time.advanceBlockTo(proposal.endBlock + 1n);
      
      expect(await governance.state(proposalId)).to.equal(3); // Defeated (ties lose)
    });

    it("Should handle maximum voting power", async function () {
      const { governance, agent1 } = await loadFixture(deployGovernanceFixture);
      
      const maxPower = ethers.MaxUint256;
      await governance.registerAgent(agent1.address, maxPower, "ipfs://max");
      
      const agent = await governance.agents(agent1.address);
      expect(agent.votingPower).to.equal(maxPower);
    });

    it("Should handle multiple proposal workflows simultaneously", async function () {
      const { governance, agent1, agent2, agent3 } = await loadFixture(deployWithAgentsFixture);
      
      // Create 3 proposals
      await governance.connect(agent1).createProposal(ethers.ZeroAddress, 0, "0x", "Proposal 1");
      await governance.connect(agent2).createProposal(ethers.ZeroAddress, 0, "0x", "Proposal 2");
      await governance.connect(agent3).createProposal(ethers.ZeroAddress, 0, "0x", "Proposal 3");
      
      await time.advanceBlock(2);
      
      // Vote on all
      await governance.connect(agent1).castVote(1, 1);
      await governance.connect(agent2).castVote(2, 1);
      await governance.connect(agent3).castVote(3, 0);
      
      // Verify independent states
      expect(await governance.proposals(1)).to.have.property("forVotes", 100n);
      expect(await governance.proposals(2)).to.have.property("forVotes", 150n);
      expect(await governance.proposals(3)).to.have.property("againstVotes", 50n);
    });
  });
});
