import {
  time,
  loadFixture,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
import { ethers } from "hardhat";

describe("PixSwapStaking", function () {
  async function fixture() {
    const [owner, addr1, addr2, addr3] = await ethers.getSigners();

    const PixSwapToken = await ethers.getContractFactory("PixSwapToken");
    const pixSwapToken = await PixSwapToken.deploy();

    const USDT = await ethers.getContractFactory("USDT");
    const usdt = await USDT.deploy();

    const THIRTY_DAYS_IN_SECONDS = 60 * 60 * 24 * 30;

    const PixSwapStaking = await ethers.getContractFactory("PixSwapStaking");
    const pixSwapStaking = await PixSwapStaking.deploy(
      await pixSwapToken.getAddress(),
      await usdt.getAddress(),
      THIRTY_DAYS_IN_SECONDS,
      ethers.parseEther("1000")
    );

    return { owner, addr1, addr2, addr3, pixSwapToken, usdt, pixSwapStaking };
  }

  describe("Deployment", function () {
    it("Should set the right stakingToken", async function () {
      const { pixSwapStaking, pixSwapToken } = await loadFixture(fixture);

      expect(await pixSwapStaking.getStakingToken()).to.equal(
        await pixSwapToken.getAddress()
      );
    });

    it("Should set the right rewardToken", async function () {
      const { pixSwapStaking, usdt } = await loadFixture(fixture);

      expect(await pixSwapStaking.getRewardToken()).to.equal(
        await usdt.getAddress()
      );
    });

    it("Should set the right blockingTime", async function () {
      const { pixSwapStaking } = await loadFixture(fixture);

      expect(await pixSwapStaking.getBlockingTime()).to.equal(
        60 * 60 * 24 * 30
      );
    });

    it("Should set the right minStakingAmount", async function () {
      const { pixSwapStaking } = await loadFixture(fixture);

      expect(await pixSwapStaking.getMinStakingAmount()).to.equal(
        ethers.parseEther("1000")
      );
    });
  });

  describe("GetStakersInfo", function () {
    it("Should return the right stakers", async function () {
      const { pixSwapStaking, pixSwapToken, usdt, addr1, addr2, addr3, owner } =
        await loadFixture(fixture);

      await pixSwapToken.mint(
        await addr1.getAddress(),
        ethers.parseEther("1000")
      );
      await pixSwapToken.mint(
        await addr2.getAddress(),
        ethers.parseEther("1000")
      );
      await pixSwapToken.mint(
        await addr3.getAddress(),
        ethers.parseEther("1000")
      );

      await pixSwapToken
        .connect(addr1)
        .approve(await pixSwapStaking.getAddress(), ethers.parseEther("1000"));
      await pixSwapToken
        .connect(addr2)
        .approve(await pixSwapStaking.getAddress(), ethers.parseEther("1000"));
      await pixSwapToken
        .connect(addr3)
        .approve(await pixSwapStaking.getAddress(), ethers.parseEther("1000"));

      await pixSwapStaking.connect(addr1).stake(ethers.parseEther("1000"));
      await pixSwapStaking.connect(addr2).stake(ethers.parseEther("1000"));
      await pixSwapStaking.connect(addr3).stake(ethers.parseEther("1000"));

      // owner deposit 100 usdt
      await usdt.mint(await owner.getAddress(), ethers.parseEther("100"));

      await usdt
        .connect(owner)
        .approve(await pixSwapStaking.getAddress(), ethers.parseEther("100"));

      await pixSwapStaking.depositReward(ethers.parseEther("100"));

      expect(await pixSwapStaking.getStakersInfo()).to.deep.equal([
        [
          await addr1.getAddress(),
          await addr2.getAddress(),
          await addr3.getAddress(),
        ],
        [
          ethers.parseEther("1000"),
          ethers.parseEther("1000"),
          ethers.parseEther("1000"),
        ],
        [
          "33333333333333333333",
          "33333333333333333333",
          "33333333333333333333",
        ],
      ]);
    });
  });

  describe("Stake", function () {
    describe("Validations", function () {
      it("Should revert with the right error if the staking amount is less than 0", async function () {
        const { pixSwapStaking, addr1 } = await loadFixture(fixture);

        await expect(
          pixSwapStaking.stake(ethers.parseEther("0"))
        ).to.be.revertedWith("PixSwapStaking: amount must be greater than 0");
      });

      it("Should revert with the right error if the staking amount is less than the minStakingAmount", async function () {
        const { pixSwapStaking, addr1 } = await loadFixture(fixture);

        await expect(
          pixSwapStaking.stake(ethers.parseEther("999"))
        ).to.be.revertedWith(
          "PixSwapStaking: amount must be greater than minStakingAmount"
        );
      });

      it("Should revert with the right error if the staking amount is more than the balance", async function () {
        const { pixSwapStaking, addr1 } = await loadFixture(fixture);

        await expect(
          pixSwapStaking.stake(ethers.parseEther("1001"))
        ).to.be.revertedWith("PixSwapStaking: insufficient balance");
      });

      it("Should revert with the right error if the staking amount is more than the allowance", async function () {
        const { pixSwapStaking, pixSwapToken, addr1 } = await loadFixture(
          fixture
        );

        await pixSwapToken.mint(
          await addr1.getAddress(),
          ethers.parseEther("1000")
        );
        await pixSwapToken
          .connect(addr1)
          .approve(await pixSwapStaking.getAddress(), ethers.parseEther("999"));

        await expect(
          pixSwapStaking.connect(addr1).stake(ethers.parseEther("1000"))
        ).to.be.revertedWith("PixSwapStaking: insufficient allowance");
      });
    });

    describe("Actions", function () {
      it("Should stake the right amount", async function () {
        const { pixSwapStaking, pixSwapToken, addr1 } = await loadFixture(
          fixture
        );

        await pixSwapToken.mint(
          await addr1.getAddress(),
          ethers.parseEther("1000")
        );
        await pixSwapToken
          .connect(addr1)
          .approve(
            await pixSwapStaking.getAddress(),
            ethers.parseEther("1000")
          );

        await pixSwapStaking.connect(addr1).stake(ethers.parseEther("1000"));

        expect(
          await pixSwapStaking.balanceOf(await addr1.getAddress())
        ).to.equal(ethers.parseEther("1000"));
      });

      it("Should increase the totalStaked", async function () {
        const { pixSwapStaking, pixSwapToken, addr1 } = await loadFixture(
          fixture
        );

        await pixSwapToken.mint(
          await addr1.getAddress(),
          ethers.parseEther("1000")
        );
        await pixSwapToken
          .connect(addr1)
          .approve(
            await pixSwapStaking.getAddress(),
            ethers.parseEther("1000")
          );

        await pixSwapStaking.connect(addr1).stake(ethers.parseEther("1000"));

        expect(await pixSwapStaking.getTotalStaked()).to.equal(
          ethers.parseEther("1000")
        );
      });

      it("Should add the user to the stakers list", async function () {
        const { pixSwapStaking, pixSwapToken, addr1 } = await loadFixture(
          fixture
        );

        await pixSwapToken.mint(
          await addr1.getAddress(),
          ethers.parseEther("1000")
        );
        await pixSwapToken
          .connect(addr1)
          .approve(
            await pixSwapStaking.getAddress(),
            ethers.parseEther("1000")
          );

        await pixSwapStaking.connect(addr1).stake(ethers.parseEther("1000"));

        expect(await pixSwapStaking.getStakers()).to.include(
          await addr1.getAddress()
        );
      });

      it("Should increase the totalStaked correctly considering multiple stakes", async function () {
        const { pixSwapStaking, pixSwapToken, addr1 } = await loadFixture(
          fixture
        );

        await pixSwapToken.mint(
          await addr1.getAddress(),
          ethers.parseEther("2000")
        );
        await pixSwapToken
          .connect(addr1)
          .approve(
            await pixSwapStaking.getAddress(),
            ethers.parseEther("2000")
          );

        await pixSwapStaking.connect(addr1).stake(ethers.parseEther("1000"));
        await pixSwapStaking.connect(addr1).stake(ethers.parseEther("1000"));

        expect(await pixSwapStaking.getTotalStaked()).to.equal(
          ethers.parseEther("2000")
        );
      });

      it("Should add the user to the stakers list correctly considering multiple stakes", async function () {
        const { pixSwapStaking, pixSwapToken, addr1 } = await loadFixture(
          fixture
        );

        await pixSwapToken.mint(
          await addr1.getAddress(),
          ethers.parseEther("2000")
        );
        await pixSwapToken
          .connect(addr1)
          .approve(
            await pixSwapStaking.getAddress(),
            ethers.parseEther("2000")
          );

        await pixSwapStaking.connect(addr1).stake(ethers.parseEther("1000"));
        await pixSwapStaking.connect(addr1).stake(ethers.parseEther("1000"));

        expect(await pixSwapStaking.getStakers()).to.include(
          await addr1.getAddress()
        );
      });

      describe("Events", function () {
        it("Should emit the Staked event", async function () {
          const { pixSwapStaking, pixSwapToken, addr1 } = await loadFixture(
            fixture
          );

          await pixSwapToken.mint(
            await addr1.getAddress(),
            ethers.parseEther("1000")
          );
          await pixSwapToken
            .connect(addr1)
            .approve(
              await pixSwapStaking.getAddress(),
              ethers.parseEther("1000")
            );

          await expect(
            pixSwapStaking.connect(addr1).stake(ethers.parseEther("1000"))
          )
            .to.emit(pixSwapStaking, "Staked")
            .withArgs(await addr1.getAddress(), ethers.parseEther("1000"));
        });
      });
    });

    describe("Unstake", function () {
      describe("Validations", function () {
        it("Should revert with the right error if the staking balance is less than 0", async function () {
          const { pixSwapStaking, addr1 } = await loadFixture(fixture);

          await expect(pixSwapStaking.unstake()).to.be.revertedWith(
            "PixSwapStaking: no staked amount"
          );
        });

        it("Should revert with the right error if the blocking time has not passed", async function () {
          const { pixSwapStaking, pixSwapToken, addr1 } = await loadFixture(
            fixture
          );

          await pixSwapToken.mint(
            await addr1.getAddress(),
            ethers.parseEther("1000")
          );
          await pixSwapToken
            .connect(addr1)
            .approve(
              await pixSwapStaking.getAddress(),
              ethers.parseEther("1000")
            );

          await pixSwapStaking.connect(addr1).stake(ethers.parseEther("1000"));

          await expect(
            pixSwapStaking.connect(addr1).unstake()
          ).to.be.revertedWith("PixSwapStaking: staking is still blocked");
        });

        it("Should revert with the right error if the blocking time has not passed considering multiple stakes", async function () {
          const { pixSwapStaking, pixSwapToken, addr1 } = await loadFixture(
            fixture
          );

          await pixSwapToken.mint(
            await addr1.getAddress(),
            ethers.parseEther("2000")
          );
          await pixSwapToken
            .connect(addr1)
            .approve(
              await pixSwapStaking.getAddress(),
              ethers.parseEther("2000")
            );

          await pixSwapStaking.connect(addr1).stake(ethers.parseEther("1000"));
          await time.increase(60 * 60 * 24 * 15);
          await pixSwapStaking.connect(addr1).stake(ethers.parseEther("1000"));
          await time.increase(60 * 60 * 24 * 15);

          await expect(
            pixSwapStaking.connect(addr1).unstake()
          ).to.be.revertedWith("PixSwapStaking: staking is still blocked");
        });
      });

      describe("Actions", function () {
        it("Should unstake the right amount", async function () {
          const { pixSwapStaking, pixSwapToken, addr1 } = await loadFixture(
            fixture
          );

          await pixSwapToken.mint(
            await addr1.getAddress(),
            ethers.parseEther("1000")
          );
          await pixSwapToken
            .connect(addr1)
            .approve(
              await pixSwapStaking.getAddress(),
              ethers.parseEther("1000")
            );

          await pixSwapStaking.connect(addr1).stake(ethers.parseEther("1000"));

          await time.increase(60 * 60 * 24 * 30);

          await pixSwapStaking.connect(addr1).unstake();

          expect(
            await pixSwapStaking.balanceOf(await addr1.getAddress())
          ).to.equal(ethers.parseEther("0"));
        });

        it("Should decrease the totalStaked", async function () {
          const { pixSwapStaking, pixSwapToken, addr1 } = await loadFixture(
            fixture
          );

          await pixSwapToken.mint(
            await addr1.getAddress(),
            ethers.parseEther("1000")
          );
          await pixSwapToken
            .connect(addr1)
            .approve(
              await pixSwapStaking.getAddress(),
              ethers.parseEther("1000")
            );

          await pixSwapStaking.connect(addr1).stake(ethers.parseEther("1000"));

          await time.increase(60 * 60 * 24 * 30);

          await pixSwapStaking.connect(addr1).unstake();

          expect(await pixSwapStaking.getTotalStaked()).to.equal(
            ethers.parseEther("0")
          );
        });

        it("Should decrease the totalStaked correctly considering multiple stakes", async function () {
          const { pixSwapStaking, pixSwapToken, addr1 } = await loadFixture(
            fixture
          );

          await pixSwapToken.mint(
            await addr1.getAddress(),
            ethers.parseEther("2000")
          );
          await pixSwapToken
            .connect(addr1)
            .approve(
              await pixSwapStaking.getAddress(),
              ethers.parseEther("2000")
            );

          await pixSwapStaking.connect(addr1).stake(ethers.parseEther("1000"));
          await time.increase(60 * 60 * 24 * 15);
          await pixSwapStaking.connect(addr1).stake(ethers.parseEther("1000"));

          await time.increase(60 * 60 * 24 * 30);

          await pixSwapStaking.connect(addr1).unstake();

          expect(await pixSwapStaking.getTotalStaked()).to.equal(
            ethers.parseEther("0")
          );
        });

        it("Should remove the user from the stakers list", async function () {
          const { pixSwapStaking, pixSwapToken, addr1 } = await loadFixture(
            fixture
          );

          await pixSwapToken.mint(
            await addr1.getAddress(),
            ethers.parseEther("1000")
          );
          await pixSwapToken
            .connect(addr1)
            .approve(
              await pixSwapStaking.getAddress(),
              ethers.parseEther("1000")
            );

          await pixSwapStaking.connect(addr1).stake(ethers.parseEther("1000"));

          await time.increase(60 * 60 * 24 * 30);

          await pixSwapStaking.connect(addr1).unstake();

          expect(await pixSwapStaking.getStakers()).to.not.include(
            await addr1.getAddress()
          );
        });

        it("Should remove the user from the stakedAmount and stakedTimestamp mappings", async function () {
          const { pixSwapStaking, pixSwapToken, addr1 } = await loadFixture(
            fixture
          );

          await pixSwapToken.mint(
            await addr1.getAddress(),
            ethers.parseEther("1000")
          );
          await pixSwapToken
            .connect(addr1)
            .approve(
              await pixSwapStaking.getAddress(),
              ethers.parseEther("1000")
            );

          await pixSwapStaking.connect(addr1).stake(ethers.parseEther("1000"));

          await time.increase(60 * 60 * 24 * 30);

          await pixSwapStaking.connect(addr1).unstake();

          expect(
            await pixSwapStaking.stakedAmount(await addr1.getAddress())
          ).to.equal(ethers.parseEther("0"));
          expect(
            await pixSwapStaking.stakedTimestamp(await addr1.getAddress())
          ).to.equal(0);
        });

        it("Should claim the rewards if the user has rewards to claim", async function () {
          const { pixSwapStaking, pixSwapToken, usdt, addr1, owner } =
            await loadFixture(fixture);

          await pixSwapToken.mint(
            await addr1.getAddress(),
            ethers.parseEther("1000")
          );

          await pixSwapToken
            .connect(addr1)
            .approve(
              await pixSwapStaking.getAddress(),
              ethers.parseEther("1000")
            );

          await pixSwapStaking.connect(addr1).stake(ethers.parseEther("1000"));

          await usdt.mint(await owner.getAddress(), ethers.parseEther("100"));

          await usdt
            .connect(owner)
            .approve(
              await pixSwapStaking.getAddress(),
              ethers.parseEther("100")
            );

          await pixSwapStaking.depositReward(ethers.parseEther("100"));

          await time.increase(60 * 60 * 24 * 30);

          await pixSwapStaking.connect(addr1).unstake();

          expect(await usdt.balanceOf(await addr1.getAddress())).to.equal(
            ethers.parseEther("100")
          );
        });
      });

      describe("Events", function () {
        it("Should emit the Unstaked event", async function () {
          const { pixSwapStaking, pixSwapToken, addr1 } = await loadFixture(
            fixture
          );

          await pixSwapToken.mint(
            await addr1.getAddress(),
            ethers.parseEther("1000")
          );
          await pixSwapToken
            .connect(addr1)
            .approve(
              await pixSwapStaking.getAddress(),
              ethers.parseEther("1000")
            );

          await pixSwapStaking.connect(addr1).stake(ethers.parseEther("1000"));

          await time.increase(60 * 60 * 24 * 30);

          await expect(pixSwapStaking.connect(addr1).unstake())
            .to.emit(pixSwapStaking, "Unstaked")
            .withArgs(await addr1.getAddress(), ethers.parseEther("1000"));
        });
      });
    });

    describe("DepositReward", function () {
      describe("Validations", function () {
        it("Should revert with the right error if the caller is not the owner", async function () {
          const { pixSwapStaking, usdt, addr1 } = await loadFixture(fixture);

          await usdt.mint(await addr1.getAddress(), ethers.parseEther("1000"));

          await usdt
            .connect(addr1)
            .approve(
              await pixSwapStaking.getAddress(),
              ethers.parseEther("1000")
            );

          await expect(
            pixSwapStaking
              .connect(addr1)
              .depositReward(ethers.parseEther("1000"))
          ).to.be.revertedWithCustomError(
            pixSwapStaking,
            "OwnableUnauthorizedAccount"
          );
        });

        it("Should revert with the right error if the reward amount is less than 0", async function () {
          const { pixSwapStaking } = await loadFixture(fixture);

          await expect(pixSwapStaking.depositReward(ethers.parseEther("0"))).to
            .be.reverted;
        });

        it("Should revert with the right error if the caller has not enough balance", async function () {
          const { pixSwapStaking, usdt } = await loadFixture(fixture);

          await expect(
            pixSwapStaking.depositReward(ethers.parseEther("1000"))
          ).to.be.revertedWith("PixSwapStaking: insufficient balance");
        });

        it("Should revert with the right error if the caller has not enough allowance", async function () {
          const { pixSwapStaking, usdt, owner } = await loadFixture(fixture);

          await usdt.mint(await owner.getAddress(), ethers.parseEther("1000"));

          await expect(
            pixSwapStaking.depositReward(ethers.parseEther("1000"))
          ).to.be.revertedWith("PixSwapStaking: insufficient allowance");
        });
      });

      describe("Actions", function () {
        it("Should deposit the right amount", async function () {
          const { pixSwapStaking, usdt, owner } = await loadFixture(fixture);

          await usdt.mint(await owner.getAddress(), ethers.parseEther("1000"));

          await usdt
            .connect(owner)
            .approve(
              await pixSwapStaking.getAddress(),
              ethers.parseEther("1000")
            );

          await pixSwapStaking.depositReward(ethers.parseEther("1000"));

          expect(await pixSwapStaking.getLastRewardDeposited()).to.equal(
            ethers.parseEther("1000")
          );
        });

        it("Should distribute the rewards correctly according to the total staked", async function () {
          const { pixSwapStaking, pixSwapToken, usdt, owner, addr1, addr2 } =
            await loadFixture(fixture);

          await pixSwapToken.mint(
            await addr1.getAddress(),
            ethers.parseEther("1000")
          );
          await pixSwapToken.mint(
            await addr2.getAddress(),
            ethers.parseEther("2000")
          );

          await pixSwapToken
            .connect(addr1)
            .approve(
              await pixSwapStaking.getAddress(),
              ethers.parseEther("1000")
            );
          await pixSwapToken
            .connect(addr2)
            .approve(
              await pixSwapStaking.getAddress(),
              ethers.parseEther("2000")
            );

          await pixSwapStaking.connect(addr1).stake(ethers.parseEther("1000"));
          await pixSwapStaking.connect(addr2).stake(ethers.parseEther("2000"));

          await usdt.mint(await owner.getAddress(), ethers.parseEther("100"));

          await usdt
            .connect(owner)
            .approve(
              await pixSwapStaking.getAddress(),
              ethers.parseEther("100")
            );

          await pixSwapStaking.depositReward(ethers.parseEther("100"));

          expect(
            await pixSwapStaking.getRewardAmount(await addr1.getAddress())
          ).to.equal("33333333333333333333");
          expect(
            await pixSwapStaking.getRewardAmount(await addr2.getAddress())
          ).to.equal("66666666666666666666");
        });
      });

      describe("Events", function () {
        it("Should emit the RewardDeposited event", async function () {
          const { pixSwapStaking, usdt, owner } = await loadFixture(fixture);

          await usdt.mint(await owner.getAddress(), ethers.parseEther("1000"));

          await usdt
            .connect(owner)
            .approve(
              await pixSwapStaking.getAddress(),
              ethers.parseEther("1000")
            );

          await expect(pixSwapStaking.depositReward(ethers.parseEther("1000")))
            .to.emit(pixSwapStaking, "RewardDeposited")
            .withArgs(ethers.parseEther("1000"));
        });
      });
    });

    describe("ClaimReward", function () {
      describe("Validations", function () {
        it("Should revert with the right error if the caller has no rewards to claim", async function () {
          const { pixSwapStaking, addr1 } = await loadFixture(fixture);

          await expect(
            pixSwapStaking.connect(addr1).claimReward()
          ).to.be.revertedWith("PixSwapStaking: no reward amount");
        });
      });

      describe("Actions", function () {
        it("Should claim the right amount", async function () {
          const { pixSwapStaking, pixSwapToken, usdt, owner, addr1, addr2 } =
            await loadFixture(fixture);

          await pixSwapToken.mint(
            await addr1.getAddress(),
            ethers.parseEther("1000")
          );
          await pixSwapToken.mint(
            await addr2.getAddress(),
            ethers.parseEther("2000")
          );

          await pixSwapToken
            .connect(addr1)
            .approve(
              await pixSwapStaking.getAddress(),
              ethers.parseEther("1000")
            );
          await pixSwapToken
            .connect(addr2)
            .approve(
              await pixSwapStaking.getAddress(),
              ethers.parseEther("2000")
            );

          await pixSwapStaking.connect(addr1).stake(ethers.parseEther("1000"));
          await pixSwapStaking.connect(addr2).stake(ethers.parseEther("2000"));

          await usdt.mint(await owner.getAddress(), ethers.parseEther("100"));

          await usdt
            .connect(owner)
            .approve(
              await pixSwapStaking.getAddress(),
              ethers.parseEther("100")
            );

          await pixSwapStaking.depositReward(ethers.parseEther("100"));

          await time.increase(60 * 60 * 24 * 30);

          await pixSwapStaking.connect(addr1).claimReward();

          expect(await usdt.balanceOf(await addr1.getAddress())).to.equal(
            "33333333333333333333"
          );
        });

        it("Should delete the reward amount after the claim", async function () {
          const { pixSwapStaking, pixSwapToken, usdt, owner, addr1, addr2 } =
            await loadFixture(fixture);

          await pixSwapToken.mint(
            await addr1.getAddress(),
            ethers.parseEther("1000")
          );
          await pixSwapToken.mint(
            await addr2.getAddress(),
            ethers.parseEther("2000")
          );

          await pixSwapToken
            .connect(addr1)
            .approve(
              await pixSwapStaking.getAddress(),
              ethers.parseEther("1000")
            );
          await pixSwapToken
            .connect(addr2)
            .approve(
              await pixSwapStaking.getAddress(),
              ethers.parseEther("2000")
            );

          await pixSwapStaking.connect(addr1).stake(ethers.parseEther("1000"));
          await pixSwapStaking.connect(addr2).stake(ethers.parseEther("2000"));

          await usdt.mint(await owner.getAddress(), ethers.parseEther("100"));

          await usdt
            .connect(owner)
            .approve(
              await pixSwapStaking.getAddress(),
              ethers.parseEther("100")
            );

          await pixSwapStaking.depositReward(ethers.parseEther("100"));

          await time.increase(60 * 60 * 24 * 30);

          await pixSwapStaking.connect(addr1).claimReward();

          expect(
            await pixSwapStaking.getRewardAmount(await addr1.getAddress())
          ).to.equal("0");
        });

        it("Should claim the rewards correctly considering multiple stakes", async function () {
          const {
            pixSwapStaking,
            pixSwapToken,
            usdt,
            owner,
            addr1,
            addr2,
            addr3,
          } = await loadFixture(fixture);

          await pixSwapToken.mint(
            await addr1.getAddress(),
            ethers.parseEther("1000")
          );
          await pixSwapToken.mint(
            await addr2.getAddress(),
            ethers.parseEther("2000")
          );
          await pixSwapToken.mint(
            await addr3.getAddress(),
            ethers.parseEther("1000")
          );

          await pixSwapToken
            .connect(addr1)
            .approve(
              await pixSwapStaking.getAddress(),
              ethers.parseEther("1000")
            );
          await pixSwapToken
            .connect(addr2)
            .approve(
              await pixSwapStaking.getAddress(),
              ethers.parseEther("2000")
            );
          await pixSwapToken
            .connect(addr3)
            .approve(
              await pixSwapStaking.getAddress(),
              ethers.parseEther("1000")
            );

          await pixSwapStaking.connect(addr1).stake(ethers.parseEther("1000"));
          await pixSwapStaking.connect(addr2).stake(ethers.parseEther("2000"));

          await time.increase(60 * 60 * 24 * 15);

          await pixSwapStaking.connect(addr3).stake(ethers.parseEther("1000"));

          await time.increase(60 * 60 * 24 * 15);

          await usdt.mint(await owner.getAddress(), ethers.parseEther("200"));

          await usdt
            .connect(owner)
            .approve(
              await pixSwapStaking.getAddress(),
              ethers.parseEther("200")
            );

          await pixSwapStaking.depositReward(ethers.parseEther("200"));

          await time.increase(60 * 60 * 24 * 30);

          await pixSwapStaking.connect(addr1).claimReward();
          await pixSwapStaking.connect(addr2).claimReward();
          await pixSwapStaking.connect(addr3).claimReward();

          expect(await usdt.balanceOf(await addr1.getAddress())).to.equal(
            ethers.parseEther("50")
          );
          expect(await usdt.balanceOf(await addr2.getAddress())).to.equal(
            ethers.parseEther("100")
          );
          expect(await usdt.balanceOf(await addr3.getAddress())).to.equal(
            ethers.parseEther("50")
          );
        });
      });

      describe("Events", function () {
        it("Should emit the RewardClaimed event", async function () {
          const { pixSwapStaking, pixSwapToken, usdt, owner, addr1, addr2 } =
            await loadFixture(fixture);

          await pixSwapToken.mint(
            await addr1.getAddress(),
            ethers.parseEther("1000")
          );
          await pixSwapToken.mint(
            await addr2.getAddress(),
            ethers.parseEther("2000")
          );

          await pixSwapToken
            .connect(addr1)
            .approve(
              await pixSwapStaking.getAddress(),
              ethers.parseEther("1000")
            );
          await pixSwapToken
            .connect(addr2)
            .approve(
              await pixSwapStaking.getAddress(),
              ethers.parseEther("2000")
            );

          await pixSwapStaking.connect(addr1).stake(ethers.parseEther("1000"));
          await pixSwapStaking.connect(addr2).stake(ethers.parseEther("2000"));

          await usdt.mint(await owner.getAddress(), ethers.parseEther("100"));

          await usdt
            .connect(owner)
            .approve(
              await pixSwapStaking.getAddress(),
              ethers.parseEther("100")
            );

          await pixSwapStaking.depositReward(ethers.parseEther("100"));

          await time.increase(60 * 60 * 24 * 30);

          await expect(pixSwapStaking.connect(addr1).claimReward())
            .to.emit(pixSwapStaking, "ClaimedReward")
            .withArgs(await addr1.getAddress(), "33333333333333333333");
        });
      });
    });

    describe("EmergencyWithdraw", function () {
      describe("Validations", function () {
        it("Should revert with the right error if the caller is not the owner", async function () {
          const { pixSwapStaking, addr1 } = await loadFixture(fixture);

          await expect(
            pixSwapStaking.connect(addr1).emergencyWithdraw()
          ).to.be.revertedWithCustomError(
            pixSwapStaking,
            "OwnableUnauthorizedAccount"
          );
        });
      });

      describe("Actions", function () {
        it("Should transfer the staking token balance to the owner", async function () {
          const { pixSwapStaking, pixSwapToken, addr1, owner } =
            await loadFixture(fixture);

          await pixSwapToken.mint(
            await addr1.getAddress(),
            ethers.parseEther("1000")
          );

          await pixSwapToken
            .connect(addr1)
            .approve(
              await pixSwapStaking.getAddress(),
              ethers.parseEther("1000")
            );

          await pixSwapStaking.connect(addr1).stake(ethers.parseEther("1000"));

          await pixSwapStaking.emergencyWithdraw();

          expect(
            await pixSwapToken.balanceOf(await owner.getAddress())
          ).to.equal(ethers.parseEther("1000"));
        });

        it("Should transfer the reward token balance to the owner", async function () {
          const { pixSwapStaking, usdt, owner } = await loadFixture(fixture);

          await usdt.mint(await owner.getAddress(), ethers.parseEther("100"));

          await usdt
            .connect(owner)
            .approve(
              await pixSwapStaking.getAddress(),
              ethers.parseEther("100")
            );

          await pixSwapStaking.depositReward(ethers.parseEther("100"));

          await pixSwapStaking.emergencyWithdraw();

          expect(await usdt.balanceOf(await owner.getAddress())).to.equal(
            ethers.parseEther("100")
          );
        });

        it("Should transfer the staking and reward token balances to the owner", async function () {
          const { pixSwapStaking, pixSwapToken, usdt, addr1, owner } =
            await loadFixture(fixture);

          await pixSwapToken.mint(
            await addr1.getAddress(),
            ethers.parseEther("1000")
          );

          await pixSwapToken
            .connect(addr1)
            .approve(
              await pixSwapStaking.getAddress(),
              ethers.parseEther("1000")
            );

          await pixSwapStaking.connect(addr1).stake(ethers.parseEther("1000"));

          await usdt.mint(await owner.getAddress(), ethers.parseEther("100"));

          await usdt
            .connect(owner)
            .approve(
              await pixSwapStaking.getAddress(),
              ethers.parseEther("100")
            );

          await pixSwapStaking.depositReward(ethers.parseEther("100"));

          await pixSwapStaking.emergencyWithdraw();

          expect(
            await pixSwapToken.balanceOf(await owner.getAddress())
          ).to.equal(ethers.parseEther("1000"));
          expect(await usdt.balanceOf(await owner.getAddress())).to.equal(
            ethers.parseEther("100")
          );
        });

        it("Should reset the staking token balance to 0", async function () {
          const { pixSwapStaking, pixSwapToken, addr1, owner } =
            await loadFixture(fixture);

          await pixSwapToken.mint(
            await addr1.getAddress(),
            ethers.parseEther("1000")
          );

          await pixSwapToken
            .connect(addr1)
            .approve(
              await pixSwapStaking.getAddress(),
              ethers.parseEther("1000")
            );

          await pixSwapStaking.connect(addr1).stake(ethers.parseEther("1000"));

          await pixSwapStaking.emergencyWithdraw();

          expect(
            await pixSwapToken.balanceOf(await pixSwapStaking.getAddress())
          ).to.equal(0);
        });

        it("Should reset the reward token balance to 0", async function () {
          const { pixSwapStaking, usdt, owner } = await loadFixture(fixture);

          await usdt.mint(await owner.getAddress(), ethers.parseEther("100"));

          await usdt
            .connect(owner)
            .approve(
              await pixSwapStaking.getAddress(),
              ethers.parseEther("100")
            );

          await pixSwapStaking.depositReward(ethers.parseEther("100"));

          await pixSwapStaking.emergencyWithdraw();

          expect(
            await usdt.balanceOf(await pixSwapStaking.getAddress())
          ).to.equal(0);
        });

        it("Should reset the staking and reward token balances to 0", async function () {
          const { pixSwapStaking, pixSwapToken, usdt, addr1, owner } =
            await loadFixture(fixture);

          await pixSwapToken.mint(
            await addr1.getAddress(),
            ethers.parseEther("1000")
          );

          await pixSwapToken
            .connect(addr1)
            .approve(
              await pixSwapStaking.getAddress(),
              ethers.parseEther("1000")
            );

          await pixSwapStaking.connect(addr1).stake(ethers.parseEther("1000"));

          await usdt.mint(await owner.getAddress(), ethers.parseEther("100"));

          await usdt
            .connect(owner)
            .approve(
              await pixSwapStaking.getAddress(),
              ethers.parseEther("100")
            );

          await pixSwapStaking.depositReward(ethers.parseEther("100"));

          await pixSwapStaking.emergencyWithdraw();

          expect(
            await pixSwapToken.balanceOf(await pixSwapStaking.getAddress())
          ).to.equal(0);
          expect(
            await usdt.balanceOf(await pixSwapStaking.getAddress())
          ).to.equal(0);
        });

        it("Should delete the stakers list", async function () {
          const { pixSwapStaking, pixSwapToken, addr1, owner } =
            await loadFixture(fixture);

          await pixSwapToken.mint(
            await addr1.getAddress(),
            ethers.parseEther("1000")
          );

          await pixSwapToken
            .connect(addr1)
            .approve(
              await pixSwapStaking.getAddress(),
              ethers.parseEther("1000")
            );

          await pixSwapStaking.connect(addr1).stake(ethers.parseEther("1000"));

          await pixSwapStaking.emergencyWithdraw();

          expect(await pixSwapStaking.getStakers()).to.be.empty;
        });

        it("Should delete the stakedAmount and stakedTimestamp mappings", async function () {
          const { pixSwapStaking, pixSwapToken, addr1, owner } =
            await loadFixture(fixture);

          await pixSwapToken.mint(
            await addr1.getAddress(),
            ethers.parseEther("1000")
          );

          await pixSwapToken
            .connect(addr1)
            .approve(
              await pixSwapStaking.getAddress(),
              ethers.parseEther("1000")
            );

          await pixSwapStaking.connect(addr1).stake(ethers.parseEther("1000"));

          await pixSwapStaking.emergencyWithdraw();

          expect(
            await pixSwapStaking.stakedAmount(await addr1.getAddress())
          ).to.equal(0);
          expect(
            await pixSwapStaking.stakedTimestamp(await addr1.getAddress())
          ).to.equal(0);
        });

        it("Should delete the lastRewardDeposited", async function () {
          const { pixSwapStaking, usdt, owner } = await loadFixture(fixture);

          await usdt.mint(await owner.getAddress(), ethers.parseEther("100"));

          await usdt
            .connect(owner)
            .approve(
              await pixSwapStaking.getAddress(),
              ethers.parseEther("100")
            );

          await pixSwapStaking.depositReward(ethers.parseEther("100"));

          await pixSwapStaking.emergencyWithdraw();

          expect(await pixSwapStaking.getLastRewardDeposited()).to.equal(0);
        });

        it("Should delete the totalStaked", async function () {
          const { pixSwapStaking, pixSwapToken, addr1, owner } =
            await loadFixture(fixture);

          await pixSwapToken.mint(
            await addr1.getAddress(),
            ethers.parseEther("1000")
          );

          await pixSwapToken
            .connect(addr1)
            .approve(
              await pixSwapStaking.getAddress(),
              ethers.parseEther("1000")
            );

          await pixSwapStaking.connect(addr1).stake(ethers.parseEther("1000"));

          await pixSwapStaking.emergencyWithdraw();

          expect(await pixSwapStaking.getTotalStaked()).to.equal(0);
        });
      });

      describe("Events", function () {
        it("Should emit the EmergencyWithdrawn event only staking token", async function () {
          const { pixSwapStaking, pixSwapToken, addr1, owner } =
            await loadFixture(fixture);

          await pixSwapToken.mint(
            await addr1.getAddress(),
            ethers.parseEther("1000")
          );

          await pixSwapToken
            .connect(addr1)
            .approve(
              await pixSwapStaking.getAddress(),
              ethers.parseEther("1000")
            );

          await pixSwapStaking.connect(addr1).stake(ethers.parseEther("1000"));

          await expect(pixSwapStaking.emergencyWithdraw())
            .to.emit(pixSwapStaking, "EmergencyWithdrawn")
            .withArgs(ethers.parseEther("1000"), 0);
        });

        it("Should emit the EmergencyWithdrawn event only reward token", async function () {
          const { pixSwapStaking, usdt, owner } = await loadFixture(fixture);

          await usdt.mint(await owner.getAddress(), ethers.parseEther("100"));

          await usdt
            .connect(owner)
            .approve(
              await pixSwapStaking.getAddress(),
              ethers.parseEther("100")
            );

          await pixSwapStaking.depositReward(ethers.parseEther("100"));

          await expect(pixSwapStaking.emergencyWithdraw())
            .to.emit(pixSwapStaking, "EmergencyWithdrawn")
            .withArgs(0, ethers.parseEther("100"));
        });

        it("Should emit the EmergencyWithdrawn event both staking and reward tokens", async function () {
          const { pixSwapStaking, pixSwapToken, usdt, addr1, owner } =
            await loadFixture(fixture);

          await pixSwapToken.mint(
            await addr1.getAddress(),
            ethers.parseEther("1000")
          );

          await pixSwapToken
            .connect(addr1)
            .approve(
              await pixSwapStaking.getAddress(),
              ethers.parseEther("1000")
            );

          await pixSwapStaking.connect(addr1).stake(ethers.parseEther("1000"));

          await usdt.mint(await owner.getAddress(), ethers.parseEther("100"));

          await usdt
            .connect(owner)
            .approve(
              await pixSwapStaking.getAddress(),
              ethers.parseEther("100")
            );

          await pixSwapStaking.depositReward(ethers.parseEther("100"));

          await expect(pixSwapStaking.emergencyWithdraw())
            .to.emit(pixSwapStaking, "EmergencyWithdrawn")
            .withArgs(ethers.parseEther("1000"), ethers.parseEther("100"));
        });
      });
    });

    describe("EmergencyWithdrawByAddress", function () {
      describe("Validations", function () {
        it("Should revert with the right error if the caller is not the owner", async function () {
          const { pixSwapStaking, addr1, addr2 } = await loadFixture(fixture);

          await expect(
            pixSwapStaking
              .connect(addr1)
              .emergencyWithdrawByAddress(await addr2.getAddress())
          ).to.be.revertedWithCustomError(
            pixSwapStaking,
            "OwnableUnauthorizedAccount"
          );
        });
      });

      describe("Actions", function () {
        it("Should transfer the staking token balance to the owner", async function () {
          const { pixSwapStaking, pixSwapToken, addr1, owner } =
            await loadFixture(fixture);

          await pixSwapToken.mint(
            await addr1.getAddress(),
            ethers.parseEther("1000")
          );

          await pixSwapToken
            .connect(addr1)
            .approve(
              await pixSwapStaking.getAddress(),
              ethers.parseEther("1000")
            );

          await pixSwapStaking.connect(addr1).stake(ethers.parseEther("1000"));

          await pixSwapStaking
            .connect(owner)
            .emergencyWithdrawByAddress(await addr1.getAddress());

          expect(
            await pixSwapToken.balanceOf(await owner.getAddress())
          ).to.equal(ethers.parseEther("1000"));
        });

        it("Should transfer the reward token balance to the owner", async function () {
          const { pixSwapStaking, usdt, pixSwapToken, owner, addr1 } =
            await loadFixture(fixture);

          await pixSwapToken.mint(
            await addr1.getAddress(),
            ethers.parseEther("1000")
          );

          await pixSwapToken
            .connect(addr1)
            .approve(
              await pixSwapStaking.getAddress(),
              ethers.parseEther("1000")
            );

          await pixSwapStaking.connect(addr1).stake(ethers.parseEther("1000"));

          await usdt.mint(await owner.getAddress(), ethers.parseEther("100"));

          await usdt
            .connect(owner)
            .approve(
              await pixSwapStaking.getAddress(),
              ethers.parseEther("100")
            );

          await pixSwapStaking.depositReward(ethers.parseEther("100"));

          await pixSwapStaking
            .connect(owner)
            .emergencyWithdrawByAddress(await addr1.getAddress());

          expect(await usdt.balanceOf(await owner.getAddress())).to.equal(
            ethers.parseEther("100")
          );
          expect(
            await pixSwapToken.balanceOf(await pixSwapStaking.getAddress())
          ).to.equal(0);
        });

        it("Should transfer the staking and reward token balances to the owner", async function () {
          const { pixSwapStaking, pixSwapToken, usdt, addr1, owner } =
            await loadFixture(fixture);

          await pixSwapToken.mint(
            await addr1.getAddress(),
            ethers.parseEther("1000")
          );

          await pixSwapToken
            .connect(addr1)
            .approve(
              await pixSwapStaking.getAddress(),
              ethers.parseEther("1000")
            );

          await pixSwapStaking.connect(addr1).stake(ethers.parseEther("1000"));

          await usdt.mint(await owner.getAddress(), ethers.parseEther("100"));

          await usdt
            .connect(owner)
            .approve(
              await pixSwapStaking.getAddress(),
              ethers.parseEther("100")
            );

          await pixSwapStaking.depositReward(ethers.parseEther("100"));

          await pixSwapStaking
            .connect(owner)
            .emergencyWithdrawByAddress(await addr1.getAddress());

          expect(
            await pixSwapToken.balanceOf(await owner.getAddress())
          ).to.equal(ethers.parseEther("1000"));
          expect(await usdt.balanceOf(await owner.getAddress())).to.equal(
            ethers.parseEther("100")
          );
        });

        it("Should decrease the totalStaked", async function () {
          const { pixSwapStaking, pixSwapToken, addr1, owner } =
            await loadFixture(fixture);

          await pixSwapToken.mint(
            await addr1.getAddress(),
            ethers.parseEther("1000")
          );

          await pixSwapToken
            .connect(addr1)
            .approve(
              await pixSwapStaking.getAddress(),
              ethers.parseEther("1000")
            );

          await pixSwapStaking.connect(addr1).stake(ethers.parseEther("1000"));

          await pixSwapStaking
            .connect(owner)
            .emergencyWithdrawByAddress(await addr1.getAddress());

          expect(await pixSwapStaking.getTotalStaked()).to.equal(0);
        });

        it("Should delete the stakers list", async function () {
          const { pixSwapStaking, pixSwapToken, addr1, owner } =
            await loadFixture(fixture);

          await pixSwapToken.mint(
            await addr1.getAddress(),
            ethers.parseEther("1000")
          );

          await pixSwapToken
            .connect(addr1)
            .approve(
              await pixSwapStaking.getAddress(),
              ethers.parseEther("1000")
            );

          await pixSwapStaking.connect(addr1).stake(ethers.parseEther("1000"));

          await pixSwapStaking
            .connect(owner)
            .emergencyWithdrawByAddress(await addr1.getAddress());

          expect(await pixSwapStaking.getStakers()).to.be.empty;
        });

        it("Should delete the stakedAmount and stakedTimestamp mappings", async function () {
          const { pixSwapStaking, pixSwapToken, addr1, owner } =
            await loadFixture(fixture);

          await pixSwapToken.mint(
            await addr1.getAddress(),
            ethers.parseEther("1000")
          );

          await pixSwapToken
            .connect(addr1)
            .approve(
              await pixSwapStaking.getAddress(),
              ethers.parseEther("1000")
            );

          await pixSwapStaking.connect(addr1).stake(ethers.parseEther("1000"));

          await pixSwapStaking
            .connect(owner)
            .emergencyWithdrawByAddress(await addr1.getAddress());

          expect(
            await pixSwapStaking.stakedAmount(await addr1.getAddress())
          ).to.equal(0);
          expect(
            await pixSwapStaking.stakedTimestamp(await addr1.getAddress())
          ).to.equal(0);
        });

        it("Should delete the reward amount", async function () {
          const { pixSwapStaking, usdt, owner, addr1 } = await loadFixture(
            fixture
          );

          await usdt.mint(await owner.getAddress(), ethers.parseEther("100"));

          await usdt
            .connect(owner)
            .approve(
              await pixSwapStaking.getAddress(),
              ethers.parseEther("100")
            );

          await pixSwapStaking.depositReward(ethers.parseEther("100"));

          await pixSwapStaking
            .connect(owner)
            .emergencyWithdrawByAddress(await addr1.getAddress());

          expect(
            await pixSwapStaking.getRewardAmount(await addr1.getAddress())
          ).to.equal(0);
        });

        it("Should transfer the reward and staking token balance to the owner correctly considering multiple stakers", async function () {
          const { pixSwapStaking, usdt, pixSwapToken, owner, addr1, addr2 } =
            await loadFixture(fixture);

          await pixSwapToken.mint(
            await addr1.getAddress(),
            ethers.parseEther("1000")
          );
          await pixSwapToken.mint(
            await addr2.getAddress(),
            ethers.parseEther("1000")
          );

          await pixSwapToken
            .connect(addr1)
            .approve(
              await pixSwapStaking.getAddress(),
              ethers.parseEther("1000")
            );
          await pixSwapToken
            .connect(addr2)
            .approve(
              await pixSwapStaking.getAddress(),
              ethers.parseEther("1000")
            );

          await pixSwapStaking.connect(addr1).stake(ethers.parseEther("1000"));
          await pixSwapStaking.connect(addr2).stake(ethers.parseEther("1000"));

          await usdt.mint(await owner.getAddress(), ethers.parseEther("100"));

          await usdt
            .connect(owner)
            .approve(
              await pixSwapStaking.getAddress(),
              ethers.parseEther("100")
            );

          await pixSwapStaking.depositReward(ethers.parseEther("100"));

          await pixSwapStaking
            .connect(owner)
            .emergencyWithdrawByAddress(await addr1.getAddress());

          expect(await usdt.balanceOf(await owner.getAddress())).to.equal(
            ethers.parseEther("50")
          );
          expect(
            await pixSwapToken.balanceOf(await owner.getAddress())
          ).to.equal(ethers.parseEther("1000"));
        });
      });

      describe("Events", function () {
        it("Should emit the EmergencyWithdrawnByAddress event only staking token", async function () {
          const { pixSwapStaking, pixSwapToken, addr1, owner } =
            await loadFixture(fixture);

          await pixSwapToken.mint(
            await addr1.getAddress(),
            ethers.parseEther("1000")
          );

          await pixSwapToken
            .connect(addr1)
            .approve(
              await pixSwapStaking.getAddress(),
              ethers.parseEther("1000")
            );

          await pixSwapStaking.connect(addr1).stake(ethers.parseEther("1000"));

          await expect(
            pixSwapStaking
              .connect(owner)
              .emergencyWithdrawByAddress(await addr1.getAddress())
          )
            .to.emit(pixSwapStaking, "EmergencyWithdrawnByAddress")
            .withArgs(await addr1.getAddress(), ethers.parseEther("1000"), 0);
        });

        it("Should emit the EmergencyWithdrawnByAddress event both staking and reward tokens", async function () {
          const { pixSwapStaking, pixSwapToken, usdt, owner, addr1 } =
            await loadFixture(fixture);

          await pixSwapToken.mint(
            await addr1.getAddress(),
            ethers.parseEther("1000")
          );

          await pixSwapToken
            .connect(addr1)
            .approve(
              await pixSwapStaking.getAddress(),
              ethers.parseEther("1000")
            );

          await pixSwapStaking.connect(addr1).stake(ethers.parseEther("1000"));

          await usdt.mint(await owner.getAddress(), ethers.parseEther("100"));

          await usdt
            .connect(owner)
            .approve(
              await pixSwapStaking.getAddress(),
              ethers.parseEther("100")
            );

          await pixSwapStaking.depositReward(ethers.parseEther("100"));

          await expect(
            pixSwapStaking
              .connect(owner)
              .emergencyWithdrawByAddress(await addr1.getAddress())
          )
            .to.emit(pixSwapStaking, "EmergencyWithdrawnByAddress")
            .withArgs(
              await addr1.getAddress(),
              ethers.parseEther("1000"),
              ethers.parseEther("100")
            );
        });
      });
    });

    describe("SetMinStakingAmount", function () {
      describe("Validations", function () {
        it("Should revert with the right error if the caller is not the owner", async function () {
          const { pixSwapStaking, addr1 } = await loadFixture(fixture);

          await expect(
            pixSwapStaking
              .connect(addr1)
              .setMinStakingAmount(ethers.parseEther("1"))
          ).to.be.revertedWithCustomError(
            pixSwapStaking,
            "OwnableUnauthorizedAccount"
          );
        });
      });

      describe("Actions", function () {
        it("Should set the minStakingAmount correctly", async function () {
          const { pixSwapStaking, owner } = await loadFixture(fixture);

          await pixSwapStaking
            .connect(owner)
            .setMinStakingAmount(ethers.parseEther("1"));

          expect(await pixSwapStaking.getMinStakingAmount()).to.equal(
            ethers.parseEther("1")
          );
        });
      });

      describe("Events", function () {
        it("Should emit the MinStakingAmountSet event", async function () {
          const { pixSwapStaking, owner } = await loadFixture(fixture);

          await expect(
            pixSwapStaking
              .connect(owner)
              .setMinStakingAmount(ethers.parseEther("1"))
          )
            .to.emit(pixSwapStaking, "MinStakingAmountChanged")
            .withArgs(ethers.parseEther("1"));
        });
      });
    });

    describe("SetRewardToken", function () {
      describe("Validations", function () {
        it("Should revert with the right error if the caller is not the owner", async function () {
          const { pixSwapStaking, addr1, usdt } = await loadFixture(fixture);

          await expect(
            pixSwapStaking
              .connect(addr1)
              .setRewardToken(await usdt.getAddress())
          ).to.be.revertedWithCustomError(
            pixSwapStaking,
            "OwnableUnauthorizedAccount"
          );
        });
      });

      describe("Actions", function () {
        it("Should set the rewardToken correctly", async function () {
          const { pixSwapStaking, owner, usdt } = await loadFixture(fixture);

          await pixSwapStaking
            .connect(owner)
            .setRewardToken(await usdt.getAddress());

          expect(await pixSwapStaking.getRewardToken()).to.equal(
            await usdt.getAddress()
          );
        });
      });

      describe("Events", function () {
        it("Should emit the RewardTokenSet event", async function () {
          const { pixSwapStaking, owner, usdt } = await loadFixture(fixture);

          await expect(
            pixSwapStaking
              .connect(owner)
              .setRewardToken(await usdt.getAddress())
          )
            .to.emit(pixSwapStaking, "RewardTokenChanged")
            .withArgs(await usdt.getAddress());
        });
      });
    });

    describe("AddStaker", function () {
      describe("Validations", function () {
        it("Should revert with the right error if the caller is not the owner", async function () {
          const { pixSwapStaking, addr1, addr2 } = await loadFixture(fixture);

          await expect(
            pixSwapStaking
              .connect(addr1)
              .addStaker(await addr2.getAddress(), ethers.parseEther("1000"))
          ).to.be.revertedWithCustomError(
            pixSwapStaking,
            "OwnableUnauthorizedAccount"
          );
        });
      });

      describe("Actions", function () {
        it("Should add the staker correctly", async function () {
          const { pixSwapStaking, owner, addr1 } = await loadFixture(fixture);

          await pixSwapStaking
            .connect(owner)
            .addStaker(await addr1.getAddress(), ethers.parseEther("1000"));

          expect(await pixSwapStaking.getStakers()).to.include(
            await addr1.getAddress()
          );
        });
      });

      describe("Events", function () {
        it("Should emit the StakerAdded event", async function () {
          const { pixSwapStaking, owner, addr1 } = await loadFixture(fixture);

          await expect(
            pixSwapStaking
              .connect(owner)
              .addStaker(await addr1.getAddress(), ethers.parseEther("1000"))
          )
            .to.emit(pixSwapStaking, "StakerAdded")
            .withArgs(await addr1.getAddress(), ethers.parseEther("1000"));
        });
      });
    }),
      describe("AddStakers", function () {
        describe("Validations", function () {
          it("Should revert with the right error if the caller is not the owner", async function () {
            const { pixSwapStaking, addr1, addr2, addr3 } = await loadFixture(
              fixture
            );

            await expect(
              pixSwapStaking
                .connect(addr1)
                .addStakers(
                  [await addr2.getAddress(), await addr3.getAddress()],
                  [ethers.parseEther("1000"), ethers.parseEther("2000")]
                )
            ).to.be.revertedWithCustomError(
              pixSwapStaking,
              "OwnableUnauthorizedAccount"
            );
          });
        });

        describe("Actions", function () {
          it("Should add the stakers correctly", async function () {
            const { pixSwapStaking, owner, addr1, addr2, addr3 } =
              await loadFixture(fixture);

            await pixSwapStaking
              .connect(owner)
              .addStakers(
                [
                  await addr1.getAddress(),
                  await addr2.getAddress(),
                  await addr3.getAddress(),
                ],
                [
                  ethers.parseEther("1000"),
                  ethers.parseEther("2000"),
                  ethers.parseEther("3000"),
                ]
              );

            expect(await pixSwapStaking.getStakers()).to.include(
              await addr1.getAddress()
            );
            expect(await pixSwapStaking.getStakers()).to.include(
              await addr2.getAddress()
            );
            expect(await pixSwapStaking.getStakers()).to.include(
              await addr3.getAddress()
            );
            expect(await pixSwapStaking.getStakers()).to.have.lengthOf(3);
          });
        });
      });
    describe("E2E", function () {
      it("Should work correctly", async function () {
        const {
          pixSwapStaking,
          pixSwapToken,
          usdt,
          owner,
          addr1,
          addr2,
          addr3,
        } = await loadFixture(fixture);
        await pixSwapToken.mint(
          await addr1.getAddress(),
          ethers.parseEther("1000")
        );

        await pixSwapToken.mint(
          await addr2.getAddress(),
          ethers.parseEther("2000")
        );

        await pixSwapToken.mint(
          await addr3.getAddress(),
          ethers.parseEther("1000")
        );

        await pixSwapToken
          .connect(addr1)
          .approve(
            await pixSwapStaking.getAddress(),
            ethers.parseEther("1000")
          );

        await pixSwapToken
          .connect(addr2)
          .approve(
            await pixSwapStaking.getAddress(),
            ethers.parseEther("2000")
          );

        await pixSwapToken
          .connect(addr3)
          .approve(
            await pixSwapStaking.getAddress(),
            ethers.parseEther("1000")
          );

        await pixSwapStaking.connect(addr1).stake(ethers.parseEther("1000"));
        await pixSwapStaking.connect(addr2).stake(ethers.parseEther("1000"));

        await time.increase(60 * 60 * 24 * 15);

        await pixSwapStaking.connect(addr2).stake(ethers.parseEther("1000"));
        await pixSwapStaking.connect(addr3).stake(ethers.parseEther("1000"));

        await time.increase(60 * 60 * 24 * 15);

        await usdt.mint(await owner.getAddress(), ethers.parseEther("200"));

        await usdt
          .connect(owner)
          .approve(await pixSwapStaking.getAddress(), ethers.parseEther("200"));

        await pixSwapStaking.depositReward(ethers.parseEther("200"));

        await pixSwapStaking.connect(addr1).unstake();

        await time.increase(60 * 60 * 24 * 30);

        await usdt.mint(await owner.getAddress(), ethers.parseEther("200"));

        await usdt
          .connect(owner)
          .approve(await pixSwapStaking.getAddress(), ethers.parseEther("200"));

        await pixSwapStaking.depositReward(ethers.parseEther("200"));

        await pixSwapStaking.connect(addr2).unstake();

        await time.increase(60 * 60 * 24 * 30);

        await usdt.mint(await owner.getAddress(), ethers.parseEther("200"));

        await usdt
          .connect(owner)
          .approve(await pixSwapStaking.getAddress(), ethers.parseEther("200"));

        await pixSwapStaking.depositReward(ethers.parseEther("200"));

        await pixSwapStaking.connect(addr3).unstake();

        expect(await usdt.balanceOf(await addr1.getAddress())).to.equal(
          "50000000000000000000"
        );
        expect(await usdt.balanceOf(await addr2.getAddress())).to.equal(
          "233333333333333333333"
        );
        expect(await usdt.balanceOf(await addr3.getAddress())).to.equal(
          "316666666666666666666"
        );
      });
    });
  });
});
