#![no_std]

//! SplitTracker — a Soroban contract for group bill splitting on Stellar.
//!
//! Different from a plain "payment logger": this contract models a *group*
//! payment obligation. One person creates a split (a bill + a list of people
//! who owe a share of it); each participant calls `pay_share` to mark their
//! portion paid; anyone can read back the split's live status.
//!
//! This is the Yellow Belt building block for SplitStellar's group-payments
//! idea — White Belt was "send one payment," this is "track who owes what
//! in a group and who's paid."

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, symbol_short, Address, Env, String, Vec,
};

#[derive(Clone)]
#[contracttype]
pub struct Split {
    pub id: u64,
    pub description: String,
    pub creator: Address,
    pub total_amount: i128,
    pub participants: Vec<Address>,
    /// Parallel array to `participants` — how much each participant owes.
    pub shares: Vec<i128>,
    /// Parallel array to `participants` — how much each participant has paid so far.
    pub paid: Vec<i128>,
    pub created_at: u64,
}

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Split(u64),
    NextId,
    RecentSplits,
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
pub enum SplitError {
    ParticipantsSharesMismatch = 1,
    SplitNotFound = 2,
    NotAParticipant = 3,
    OverpaidShare = 4,
    EmptyParticipants = 5,
}

const RECENT_LIMIT: u32 = 20;

#[contract]
pub struct SplitTrackerContract;

#[contractimpl]
impl SplitTrackerContract {
    /// Creates a new split. `participants[i]` owes `shares[i]` of `total_amount`.
    /// Emits a `("split", "created")` event with the new split id.
    pub fn create_split(
        env: Env,
        creator: Address,
        description: String,
        total_amount: i128,
        participants: Vec<Address>,
        shares: Vec<i128>,
    ) -> Result<u64, SplitError> {
        creator.require_auth();

        if participants.is_empty() {
            return Err(SplitError::EmptyParticipants);
        }
        if participants.len() != shares.len() {
            return Err(SplitError::ParticipantsSharesMismatch);
        }

        let id: u64 = env
            .storage()
            .instance()
            .get(&DataKey::NextId)
            .unwrap_or(0u64);

        let paid: Vec<i128> = {
            let mut v = Vec::new(&env);
            for _ in participants.iter() {
                v.push_back(0i128);
            }
            v
        };

        let split = Split {
            id,
            description,
            creator: creator.clone(),
            total_amount,
            participants: participants.clone(),
            shares,
            paid,
            created_at: env.ledger().timestamp(),
        };

        env.storage().instance().set(&DataKey::Split(id), &split);
        env.storage().instance().set(&DataKey::NextId, &(id + 1));

        Self::push_recent(&env, id);

        env.events()
            .publish((symbol_short!("split"), symbol_short!("created")), id);

        Ok(id)
    }

    /// A participant pays some or all of their share. `amount` is added to
    /// their running paid total for this split. Emits a
    /// `("split", "paid")` event with (split_id, payer).
    pub fn pay_share(
        env: Env,
        split_id: u64,
        participant: Address,
        amount: i128,
    ) -> Result<(), SplitError> {
        participant.require_auth();

        let mut split: Split = env
            .storage()
            .instance()
            .get(&DataKey::Split(split_id))
            .ok_or(SplitError::SplitNotFound)?;

        let mut idx: Option<u32> = None;
        for (i, p) in split.participants.iter().enumerate() {
            if p == participant {
                idx = Some(i as u32);
                break;
            }
        }
        let idx = idx.ok_or(SplitError::NotAParticipant)?;

        let share = split.shares.get(idx).unwrap();
        let already_paid = split.paid.get(idx).unwrap();
        let new_paid = already_paid + amount;

        if new_paid > share {
            return Err(SplitError::OverpaidShare);
        }

        split.paid.set(idx, new_paid);
        env.storage()
            .instance()
            .set(&DataKey::Split(split_id), &split);

        env.events().publish(
            (symbol_short!("split"), symbol_short!("paid")),
            (split_id, participant),
        );

        Ok(())
    }

    /// Reads back a single split's full current state.
    pub fn get_split(env: Env, split_id: u64) -> Result<Split, SplitError> {
        env.storage()
            .instance()
            .get(&DataKey::Split(split_id))
            .ok_or(SplitError::SplitNotFound)
    }

    /// Returns the most recently created split ids, newest first
    /// (capped at RECENT_LIMIT entries).
    pub fn get_recent_splits(env: Env) -> Vec<u64> {
        env.storage()
            .instance()
            .get(&DataKey::RecentSplits)
            .unwrap_or(Vec::new(&env))
    }

    /// Convenience read: total owed vs total paid so far for a split.
    pub fn get_split_progress(env: Env, split_id: u64) -> Result<(i128, i128), SplitError> {
        let split: Split = env
            .storage()
            .instance()
            .get(&DataKey::Split(split_id))
            .ok_or(SplitError::SplitNotFound)?;

        let mut total_paid: i128 = 0;
        for amt in split.paid.iter() {
            total_paid += amt;
        }

        Ok((split.total_amount, total_paid))
    }

    fn push_recent(env: &Env, id: u64) {
        let mut recent: Vec<u64> = env
            .storage()
            .instance()
            .get(&DataKey::RecentSplits)
            .unwrap_or(Vec::new(env));

        recent.push_front(id);
        while recent.len() > RECENT_LIMIT {
            recent.pop_back();
        }

        env.storage().instance().set(&DataKey::RecentSplits, &recent);
    }
}

mod test;
