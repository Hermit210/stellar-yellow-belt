#![cfg(test)]

use super::*;
use soroban_sdk::{testutils::Address as _, vec, Env};

#[test]
fn create_split_and_pay_full_flow() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(SplitTrackerContract, ());
    let client = SplitTrackerContractClient::new(&env, &contract_id);

    let creator = Address::generate(&env);
    let alice = Address::generate(&env);
    let bob = Address::generate(&env);

    let participants = vec![&env, alice.clone(), bob.clone()];
    let shares = vec![&env, 500i128, 500i128];

    let split_id = client.create_split(
        &creator,
        &String::from_str(&env, "Builders on Court dues"),
        &1000i128,
        &participants,
        &shares,
    );

    assert_eq!(split_id, 0);

    let split = client.get_split(&split_id);
    assert_eq!(split.total_amount, 1000);
    assert_eq!(split.participants.len(), 2);

    client.pay_share(&split_id, &alice, &500i128);

    let (total, paid) = client.get_split_progress(&split_id);
    assert_eq!(total, 1000);
    assert_eq!(paid, 500);

    client.pay_share(&split_id, &bob, &500i128);

    let (total, paid) = client.get_split_progress(&split_id);
    assert_eq!(total, 1000);
    assert_eq!(paid, 1000);

    let recent = client.get_recent_splits();
    assert_eq!(recent.get(0).unwrap(), 0);
}

#[test]
fn pay_share_rejects_non_participant() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(SplitTrackerContract, ());
    let client = SplitTrackerContractClient::new(&env, &contract_id);

    let creator = Address::generate(&env);
    let alice = Address::generate(&env);
    let stranger = Address::generate(&env);

    let participants = vec![&env, alice.clone()];
    let shares = vec![&env, 100i128];

    let split_id = client.create_split(
        &creator,
        &String::from_str(&env, "Solo split"),
        &100i128,
        &participants,
        &shares,
    );

    let result = client.try_pay_share(&split_id, &stranger, &100i128);
    assert!(result.is_err());
}

#[test]
fn create_split_rejects_mismatched_lengths() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(SplitTrackerContract, ());
    let client = SplitTrackerContractClient::new(&env, &contract_id);

    let creator = Address::generate(&env);
    let alice = Address::generate(&env);

    let participants = vec![&env, alice.clone()];
    let shares = vec![&env, 50i128, 50i128];

    let result = client.try_create_split(
        &creator,
        &String::from_str(&env, "Bad split"),
        &100i128,
        &participants,
        &shares,
    );

    assert!(result.is_err());
}
