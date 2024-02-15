// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract PixSwapStaking is Ownable {
    // Token de staking
    ERC20 public stakingToken;

    // Token de recompensa
    ERC20 public rewardToken;

    // Saldo total de staking
    uint256 public totalStaked;

    // Tempo de bloqueio (em segundos) ex: 30 dias = 2592000
    uint256 private blockingTime;

    // Valor mínimo de staking
    uint256 private minStakingAmount;

    // Ultima recompensa depositada
    uint256 private lastRewardDeposited;

    // Lista de stakers
    address[] public stakers;

    // Mapeamento de saldo de staking
    mapping (address => uint256) public stakedAmount;

    // Mapeamento de timestamp de staking
    mapping (address => uint256) public stakedTimestamp;

    // Mapeamento de saldo de recompensa
    mapping (address => uint256) public rewardAmount;

    event Staked(address indexed user, uint256 amount);
    event Unstaked(address indexed user, uint256 amount);
    event RewardDeposited(uint256 amount);
    event ClaimedReward(address indexed user, uint256 amount);
    event EmergencyWithdrawn(uint256 stakingAmount, uint256 rewardAmount);
    event EmergencyWithdrawnByAddress(address indexed user, uint256 stakingAmount, uint256 rewardAmount);
    event MinStakingAmountChanged(uint256 amount);
    event RewardTokenChanged(address indexed rewardToken);
    event StakerAdded(address indexed staker, uint256 amount);
    
    constructor(address _stakingToken, address _rewardToken, uint256 _blockingTime, uint256 _minStakingAmount)
    Ownable(msg.sender)
    {
        require(_stakingToken != address(0), "PixSwapStaking: staking token is the zero address");
        require(_rewardToken != address(0), "PixSwapStaking: reward token is the zero address");
        require(_minStakingAmount > 0, "PixSwapStaking: min staking amount must be greater than 0");
        
        stakingToken = ERC20(_stakingToken);
        rewardToken = ERC20(_rewardToken);
        blockingTime = _blockingTime;
        minStakingAmount = _minStakingAmount;
    }

    // Função para verificar o endereço do contrato do token de staking
    function getStakingToken() public view returns (address) {
        return address(stakingToken);
    }

    // Função para verificar o endereço do contrato do token de recompensa
    function getRewardToken() public view returns (address) {
        return address(rewardToken);
    }

    // Função para verificar o tempo de bloqueio
    function getBlockingTime() public view returns (uint256) {
        return blockingTime;
    }

    // Função para verificar o valor mínimo de staking
    function getMinStakingAmount() public view returns (uint256) {
        return minStakingAmount;
    }

    // Função para verificar o saldo de staking de uma carteira específica
    function balanceOf(address _user) public view returns (uint256) {
        return stakedAmount[_user];
    }

    // Função para verificar o total de tokens em staking
    function getTotalStaked() public view returns (uint256) {
        return totalStaked;
    }

    // Função para verificar o ultimo valor de recompensa depositado
    function getLastRewardDeposited() public view returns (uint256) {
        return lastRewardDeposited;
    }

    // Função para verificar a lista de stakers
    function getStakers() public view returns (address[] memory) {
        return stakers;
    }

    // Função para verificar se um endereço é um staker
    function getStaker(address _user) public view returns (bool) {
        for (uint256 i = 0; i < stakers.length; i++) {
            if (stakers[i] == _user) {
                return true;
            }
        }
        return false;
    }

    // Função para verificar o saldo de recompensa de uma carteira específica
    function getRewardAmount(address _user) public view returns (uint256) {
        return rewardAmount[_user];
    }

     // Função para verificar as informações dos stakers
    function getStakersInfo() public view returns (address[] memory, uint256[] memory, uint256[] memory) {
        uint256[] memory stakedAmounts = new uint256[](stakers.length);
        uint256[] memory rewardAmounts = new uint256[](stakers.length);

        for (uint256 i = 0; i < stakers.length; i++) {
            stakedAmounts[i] = stakedAmount[stakers[i]];
            rewardAmounts[i] = rewardAmount[stakers[i]];
        }

        return (stakers, stakedAmounts, rewardAmounts);
    }

    // Função para remover um staker da lista de stakers (função privada, só pode ser chamada internamente)
    function _removeStaker(address _user) private {
        for (uint256 i = 0; i < stakers.length; i++) {
            if (stakers[i] == _user) {
                stakers[i] = stakers[stakers.length - 1];
                stakers.pop();
                break;
            }
        }
    }

    // Função para distribuir a recompensa entre os stakers (função privada, só pode ser chamada internamente)
    function _distributionReward(uint256 _amount) private {
        for (uint256 i = 0; i < stakers.length; i++) {
            uint256 reward = (stakedAmount[stakers[i]] * _amount) / totalStaked;
            rewardAmount[stakers[i]] += reward;
        }
    }

    // Função para realizar o staking
    function stake(uint256 _amount) external {
        require(_amount > 0, "PixSwapStaking: amount must be greater than 0");
        require(_amount >= minStakingAmount, "PixSwapStaking: amount must be greater than minStakingAmount");
        require(stakingToken.balanceOf(msg.sender) >= _amount, "PixSwapStaking: insufficient balance");
        require(stakingToken.allowance(msg.sender, address(this)) >= _amount, "PixSwapStaking: insufficient allowance");

        stakingToken.transferFrom(msg.sender, address(this), _amount);
        stakedAmount[msg.sender] += _amount;
        stakedTimestamp[msg.sender] = block.timestamp;
        
        if (!getStaker(msg.sender)) {
            stakers.push(msg.sender);
        }
        totalStaked += _amount;

        emit Staked(msg.sender, _amount);
    }

    // Função para realizar o unstaking
    function unstake() external {
        require(stakedAmount[msg.sender] > 0, "PixSwapStaking: no staked amount");
        require(block.timestamp >= stakedTimestamp[msg.sender] + blockingTime, "PixSwapStaking: staking is still blocked");

        uint256 staked = stakedAmount[msg.sender];

        if (rewardAmount[msg.sender] > 0) {
            uint256 reward = rewardAmount[msg.sender];

            rewardToken.transfer(msg.sender, rewardAmount[msg.sender]);
            delete rewardAmount[msg.sender];

            emit ClaimedReward(msg.sender, reward);
        }

        stakingToken.transfer(msg.sender, stakedAmount[msg.sender]);
        totalStaked -= stakedAmount[msg.sender];

        _removeStaker(msg.sender);

        delete stakedAmount[msg.sender];
        delete stakedTimestamp[msg.sender];

        emit Unstaked(msg.sender, staked);
    }

    // Função para realizar o withdraw da recompensa
    function claimReward() external {
        require(rewardAmount[msg.sender] > 0, "PixSwapStaking: no reward amount");
        require(rewardToken.balanceOf(address(this)) >= rewardAmount[msg.sender], "PixSwapStaking: insufficient reward balance");

        uint256 reward = rewardAmount[msg.sender];

        rewardToken.transfer(msg.sender, rewardAmount[msg.sender]);

        delete rewardAmount[msg.sender];

        emit ClaimedReward(msg.sender, reward);

    }

    // Função para depositar recompensa
    function depositReward(uint256 _amount) external onlyOwner {
        require(_amount > 0, "PixSwapStaking: amount must be greater than 0");
        require(rewardToken.balanceOf(msg.sender) >= _amount, "PixSwapStaking: insufficient balance");
        require(rewardToken.allowance(msg.sender, address(this)) >= _amount, "PixSwapStaking: insufficient allowance");

        rewardToken.transferFrom(msg.sender, address(this), _amount);
        lastRewardDeposited = _amount;

        _distributionReward(_amount);

        emit RewardDeposited(_amount);
    }

    // Função para realizar o withdraw de emergência
    function emergencyWithdraw() external onlyOwner {
        uint256 staked = stakingToken.balanceOf(address(this));
        uint256 reward = rewardToken.balanceOf(address(this));
        
        
        if (stakingToken.balanceOf(address(this)) > 0) {
            stakingToken.transfer(msg.sender, stakingToken.balanceOf(address(this)));
        }

        if (rewardToken.balanceOf(address(this)) > 0) {
            rewardToken.transfer(msg.sender, rewardToken.balanceOf(address(this)));
        }


        for (uint256 i = 0; i < stakers.length; i++) {
            delete stakedAmount[stakers[i]];
            delete stakedTimestamp[stakers[i]];
            delete rewardAmount[stakers[i]];
        }

        delete stakers;
        totalStaked = 0;
        lastRewardDeposited = 0;

        emit EmergencyWithdrawn(staked, reward);
    }

    // Função para realizar o withdraw de emergência de uma carteira específica
    function emergencyWithdrawByAddress(address _user) external onlyOwner {
        uint256 staked = stakedAmount[_user];
        uint256 reward = rewardAmount[_user];

        if (stakedAmount[_user] > 0) {
            stakingToken.transfer(msg.sender, stakedAmount[_user]);
            totalStaked -= stakedAmount[_user];
            delete stakedAmount[_user];
            delete stakedTimestamp[_user];
            _removeStaker(_user);
        }

        if (rewardAmount[_user] > 0) {
            rewardToken.transfer(msg.sender, rewardAmount[_user]);
            delete rewardAmount[_user];
        }

        emit EmergencyWithdrawnByAddress(_user, staked, reward);
    }

    // Função para alternar a quantidade mínima de staking
    function setMinStakingAmount(uint256 _minStakingAmount) external onlyOwner {
        minStakingAmount = _minStakingAmount;

        emit MinStakingAmountChanged(_minStakingAmount);
    }

    // Função para alterar o endereço do contrato do token de recompensa
    function setRewardToken(address _rewardToken) external onlyOwner {
        rewardToken = ERC20(_rewardToken);

        emit RewardTokenChanged(_rewardToken);
    }

    // Função para passar adicionar um staker e saldo a ele
    function addStaker(address _staker, uint256 _amount) public onlyOwner {
        require(_staker != address(0), "PixSwapStaking: staker is the zero address");

        if (!getStaker(_staker)) {
            stakers.push(address(_staker));
        }

        stakedAmount[_staker] += _amount;
        stakedTimestamp[_staker] = block.timestamp;
        totalStaked += _amount;

        emit StakerAdded(_staker, _amount);
    }

    // Função para adicionar vários stakers e saldos a eles de uma vez
    function addStakers(address[] memory _stakers, uint256[] memory _amounts) external onlyOwner {
        require(_stakers.length == _amounts.length, "PixSwapStaking: stakers and amounts length mismatch");

        for (uint256 i = 0; i < _stakers.length; i++) {
            addStaker(_stakers[i], _amounts[i]);
        }
    }
}