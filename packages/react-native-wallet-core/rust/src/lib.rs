use alloy_consensus::{SignableTransaction, TxEip1559};
use alloy_dyn_abi::TypedData;
use alloy_network::TxSignerSync;
use alloy_primitives::{hex, Address, Bytes, TxKind, B256, U256};
use alloy_signer::SignerSync;
use alloy_signer_local::{coins_bip39::English, MnemonicBuilder, PrivateKeySigner};
use bip39::{Language, Mnemonic};
use serde::{Deserialize, Deserializer, Serialize};
use serde_json::{json, Value};
use std::ffi::{CStr, CString};
use std::os::raw::c_char;
use std::panic::{catch_unwind, AssertUnwindSafe};
use std::str::FromStr;
use thiserror::Error;
use zeroize::{Zeroize, Zeroizing};

const DEFAULT_DERIVATION_PATH: &str = "m/44'/60'/0'/0/0";

#[derive(Debug, Error)]
enum WalletError {
    #[error("invalid request")]
    InvalidRequest,
    #[error("invalid secret")]
    InvalidSecret,
    #[error("invalid derivation path")]
    InvalidDerivationPath,
    #[error("invalid hexadecimal value")]
    InvalidHex,
    #[error("invalid address")]
    InvalidAddress,
    #[error("invalid numeric quantity")]
    InvalidQuantity,
    #[error("unsupported operation")]
    UnsupportedOperation,
    #[error("signing failed")]
    SigningFailed,
}

impl WalletError {
    fn code(&self) -> &'static str {
        match self {
            Self::InvalidRequest => "invalid_request",
            Self::InvalidSecret => "invalid_secret",
            Self::InvalidDerivationPath => "invalid_derivation_path",
            Self::InvalidHex => "invalid_hex",
            Self::InvalidAddress => "invalid_address",
            Self::InvalidQuantity => "invalid_quantity",
            Self::UnsupportedOperation => "unsupported_operation",
            Self::SigningFailed => "signing_failed",
        }
    }
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct InvokeRequest {
    operation: String,
    #[serde(default)]
    params: Value,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct SecretParams {
    kind: SecretKind,
    #[serde(deserialize_with = "deserialize_zeroizing_string")]
    secret: Zeroizing<String>,
    #[serde(default = "default_derivation_path")]
    derivation_path: String,
}

#[derive(Clone, Copy, Deserialize)]
#[serde(rename_all = "kebab-case")]
enum SecretKind {
    Mnemonic,
    PrivateKey,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct SignPersonalParams {
    #[serde(flatten)]
    secret: SecretParams,
    message_hex: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct SignTypedDataParams {
    #[serde(flatten)]
    secret: SecretParams,
    typed_data: Value,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct SignTransactionParams {
    #[serde(flatten)]
    secret: SecretParams,
    transaction: Eip1559TransactionParams,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Eip1559TransactionParams {
    chain_id: u64,
    nonce: String,
    gas_limit: String,
    max_fee_per_gas: String,
    max_priority_fee_per_gas: String,
    to: Option<String>,
    value: String,
    #[serde(default = "empty_hex")]
    data: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct DerivedAccount {
    address: String,
    derivation_path: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct AddressParams {
    address: String,
}

fn default_derivation_path() -> String {
    DEFAULT_DERIVATION_PATH.to_owned()
}

fn empty_hex() -> String {
    "0x".to_owned()
}

fn deserialize_zeroizing_string<'de, D>(deserializer: D) -> Result<Zeroizing<String>, D::Error>
where
    D: Deserializer<'de>,
{
    String::deserialize(deserializer).map(Zeroizing::new)
}

fn signer_from_secret(params: &SecretParams) -> Result<PrivateKeySigner, WalletError> {
    match params.kind {
        SecretKind::Mnemonic => MnemonicBuilder::<English>::default()
            .phrase(params.secret.as_str())
            .derivation_path(&params.derivation_path)
            .map_err(|_| WalletError::InvalidDerivationPath)?
            .build()
            .map_err(|_| WalletError::InvalidSecret),
        SecretKind::PrivateKey => {
            let normalized = params.secret.trim().strip_prefix("0x").unwrap_or(params.secret.trim());
            let bytes = hex::decode(normalized).map_err(|_| WalletError::InvalidSecret)?;
            PrivateKeySigner::from_slice(&bytes).map_err(|_| WalletError::InvalidSecret)
        }
    }
}

fn derive_account(params: SecretParams) -> Result<DerivedAccount, WalletError> {
    let signer = signer_from_secret(&params)?;
    Ok(DerivedAccount {
        address: format!("{:#x}", signer.address()),
        derivation_path: match params.kind {
            SecretKind::Mnemonic => Some(params.derivation_path),
            SecretKind::PrivateKey => None,
        },
    })
}

fn decode_hex(value: &str) -> Result<Vec<u8>, WalletError> {
    let normalized = value.strip_prefix("0x").unwrap_or(value);
    hex::decode(normalized).map_err(|_| WalletError::InvalidHex)
}

fn parse_u128_quantity(value: &str) -> Result<u128, WalletError> {
    if let Some(hex_value) = value.strip_prefix("0x") {
        u128::from_str_radix(hex_value, 16).map_err(|_| WalletError::InvalidQuantity)
    } else {
        value.parse::<u128>().map_err(|_| WalletError::InvalidQuantity)
    }
}

fn parse_u64_quantity(value: &str) -> Result<u64, WalletError> {
    let parsed = parse_u128_quantity(value)?;
    u64::try_from(parsed).map_err(|_| WalletError::InvalidQuantity)
}

fn parse_u256_quantity(value: &str) -> Result<U256, WalletError> {
    if let Some(hex_value) = value.strip_prefix("0x") {
        U256::from_str_radix(hex_value, 16).map_err(|_| WalletError::InvalidQuantity)
    } else {
        U256::from_str(value).map_err(|_| WalletError::InvalidQuantity)
    }
}

fn signature_hex(signature: alloy_primitives::Signature) -> String {
    format!("0x{}", hex::encode(signature.as_bytes()))
}

fn invoke(request_json: &str) -> Result<Value, WalletError> {
    let request: InvokeRequest = serde_json::from_str(request_json).map_err(|_| WalletError::InvalidRequest)?;

    match request.operation.as_str() {
        "generateMnemonic" => {
            let mnemonic = Mnemonic::generate_in(Language::English, 12)
                .map_err(|_| WalletError::SigningFailed)?;
            let phrase = Zeroizing::new(mnemonic.to_string());
            Ok(json!({"phrase": phrase.as_str()}))
        }
        "deriveAccount" => {
            let params: SecretParams = serde_json::from_value(request.params)
                .map_err(|_| WalletError::InvalidRequest)?;
            serde_json::to_value(derive_account(params)?).map_err(|_| WalletError::InvalidRequest)
        }
        "normalizeAddress" => {
            let params: AddressParams = serde_json::from_value(request.params)
                .map_err(|_| WalletError::InvalidRequest)?;
            let address = Address::from_str(&params.address).map_err(|_| WalletError::InvalidAddress)?;
            Ok(json!({"address": format!("{address:#x}")}))
        }
        "signPersonalMessage" => {
            let params: SignPersonalParams = serde_json::from_value(request.params)
                .map_err(|_| WalletError::InvalidRequest)?;
            let signer = signer_from_secret(&params.secret)?;
            let mut message = decode_hex(&params.message_hex)?;
            let signature = signer
                .sign_message_sync(&message)
                .map_err(|_| WalletError::SigningFailed)?;
            message.zeroize();
            Ok(json!({"signature": signature_hex(signature)}))
        }
        "signTypedData" => {
            let params: SignTypedDataParams = serde_json::from_value(request.params)
                .map_err(|_| WalletError::InvalidRequest)?;
            let signer = signer_from_secret(&params.secret)?;
            let typed_data: TypedData = serde_json::from_value(params.typed_data)
                .map_err(|_| WalletError::InvalidRequest)?;
            let hash = typed_data
                .eip712_signing_hash()
                .map_err(|_| WalletError::InvalidRequest)?;
            let signature = signer
                .sign_hash_sync(&hash)
                .map_err(|_| WalletError::SigningFailed)?;
            Ok(json!({"signature": signature_hex(signature), "hash": format!("{hash:#x}")}))
        }
        "signEip1559Transaction" => {
            let params: SignTransactionParams = serde_json::from_value(request.params)
                .map_err(|_| WalletError::InvalidRequest)?;
            let signer = signer_from_secret(&params.secret)?;
            let transaction = params.transaction;
            let to = match transaction.to {
                Some(value) => TxKind::Call(Address::from_str(&value).map_err(|_| WalletError::InvalidAddress)?),
                None => TxKind::Create,
            };
            let mut tx = TxEip1559 {
                chain_id: transaction.chain_id,
                nonce: parse_u64_quantity(&transaction.nonce)?,
                gas_limit: parse_u64_quantity(&transaction.gas_limit)?,
                max_fee_per_gas: parse_u128_quantity(&transaction.max_fee_per_gas)?,
                max_priority_fee_per_gas: parse_u128_quantity(&transaction.max_priority_fee_per_gas)?,
                to,
                value: parse_u256_quantity(&transaction.value)?,
                access_list: Default::default(),
                input: Bytes::from(decode_hex(&transaction.data)?),
            };
            let signature = signer
                .sign_transaction_sync(&mut tx)
                .map_err(|_| WalletError::SigningFailed)?;
            let signed = tx.into_signed(signature);
            let mut encoded = Vec::with_capacity(signed.eip2718_encoded_length());
            signed.eip2718_encode(&mut encoded);
            let transaction_hash = B256::from_slice(signed.hash().as_slice());
            Ok(json!({
                "rawTransaction": format!("0x{}", hex::encode(encoded)),
                "transactionHash": format!("{transaction_hash:#x}")
            }))
        }
        _ => Err(WalletError::UnsupportedOperation),
    }
}

fn response_json(request_json: &str) -> String {
    match catch_unwind(AssertUnwindSafe(|| invoke(request_json))) {
        Ok(Ok(result)) => json!({"ok": true, "result": result}).to_string(),
        Ok(Err(error)) => json!({
            "ok": false,
            "error": {"code": error.code(), "message": error.to_string()}
        })
        .to_string(),
        Err(_) => json!({
            "ok": false,
            "error": {"code": "internal_error", "message": "wallet core failed"}
        })
        .to_string(),
    }
}

#[no_mangle]
pub unsafe extern "C" fn ruban_wallet_invoke(request_json: *const c_char) -> *mut c_char {
    if request_json.is_null() {
        return CString::new(response_json("{}")).expect("static response").into_raw();
    }

    let request = CStr::from_ptr(request_json).to_string_lossy();
    CString::new(response_json(&request)).expect("JSON response contains no NUL").into_raw()
}

#[no_mangle]
pub unsafe extern "C" fn ruban_wallet_string_free(value: *mut c_char) {
    if !value.is_null() {
        drop(CString::from_raw(value));
    }
}

#[cfg(target_os = "android")]
#[no_mangle]
pub extern "system" fn Java_com_rubanlabs_walletcore_RubanWalletCoreBindings_invoke<'local>(
    mut env: jni::JNIEnv<'local>,
    _class: jni::objects::JClass<'local>,
    request: jni::objects::JString<'local>,
) -> jni::sys::jstring {
    let request_string: String = match env.get_string(&request) {
        Ok(value) => value.into(),
        Err(_) => "{}".to_owned(),
    };
    match env.new_string(response_json(&request_string)) {
        Ok(value) => value.into_raw(),
        Err(_) => std::ptr::null_mut(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const TEST_MNEMONIC: &str =
        "test test test test test test test test test test test junk";

    fn secret_params() -> SecretParams {
        SecretParams {
            kind: SecretKind::Mnemonic,
            secret: Zeroizing::new(TEST_MNEMONIC.to_owned()),
            derivation_path: DEFAULT_DERIVATION_PATH.to_owned(),
        }
    }

    #[test]
    fn derives_the_standard_test_account() {
        let account = derive_account(secret_params()).expect("derive account");
        assert_eq!(account.address, "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266");
    }

    #[test]
    fn signs_and_recovers_a_personal_message() {
        let signer = signer_from_secret(&secret_params()).expect("create signer");
        let message = b"Ruban native speed";
        let signature = signer.sign_message_sync(message).expect("sign message");
        assert_eq!(
            signature.recover_address_from_msg(message).expect("recover signer"),
            signer.address()
        );
    }

    #[test]
    fn rejects_unknown_operations_without_echoing_input() {
        let response = response_json(
            r#"{"operation":"unknown","params":{"secret":"never echo this"}}"#,
        );
        assert!(response.contains("unsupported_operation"));
        assert!(!response.contains("never echo this"));
    }

    #[test]
    fn normalizes_an_evm_address() {
        let response = invoke(
            r#"{"operation":"normalizeAddress","params":{"address":"0xF39Fd6e51aad88F6F4ce6aB8827279cffFb92266"}}"#,
        )
        .expect("normalize address");
        assert_eq!(
            response["address"],
            "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266"
        );
    }
}
