#import "RubanWalletCore.h"
#import "ruban_wallet_core.h"
#import <Security/Security.h>
#import <UIKit/UIKit.h>

static NSString *const RubanKeychainService = @"com.rubanlabs.wallet-core";
static NSString *const RubanDefaultPath = @"m/44'/60'/0'/0/0";

@implementation RubanWalletCore

RCT_EXPORT_MODULE()

+ (BOOL)requiresMainQueueSetup { return NO; }

RCT_REMAP_METHOD(presentCreateMnemonic,
                 presentCreateMnemonicWithLabel:(NSString *)label
                 resolver:(RCTPromiseResolveBlock)resolve
                 rejecter:(RCTPromiseRejectBlock)reject) {
  NSError *error = nil;
  NSDictionary *generated = [self invoke:@"generateMnemonic" params:@{} error:&error];
  if (!generated) return [self reject:reject error:error];
  NSString *phrase = generated[@"phrase"];
  dispatch_async(dispatch_get_main_queue(), ^{
    UIAlertController *alert = [UIAlertController alertControllerWithTitle:@"Recovery phrase"
      message:[NSString stringWithFormat:@"Write these 12 words down in order. They are shown only during this native flow.\n\n%@", phrase]
      preferredStyle:UIAlertControllerStyleAlert];
    [alert addAction:[UIAlertAction actionWithTitle:@"Cancel" style:UIAlertActionStyleCancel handler:^(__unused UIAlertAction *action) {
      reject(@"cancelled", @"Wallet creation cancelled", nil);
    }]];
    [alert addAction:[UIAlertAction actionWithTitle:@"Store wallet" style:UIAlertActionStyleDefault handler:^(__unused UIAlertAction *action) {
      [self createSecretAccountWithLabel:label kind:@"mnemonic" secret:phrase derivationPath:RubanDefaultPath resolve:resolve reject:reject];
    }]];
    [[self topViewController] presentViewController:alert animated:YES completion:nil];
  });
}

RCT_REMAP_METHOD(presentImportMnemonic,
                 presentImportMnemonicWithLabel:(NSString *)label
                 resolver:(RCTPromiseResolveBlock)resolve
                 rejecter:(RCTPromiseRejectBlock)reject) {
  [self presentSecretInput:@"Import recovery phrase" placeholder:@"12 or 24 words" completion:^(NSString *value) {
    [self createSecretAccountWithLabel:label kind:@"mnemonic" secret:value derivationPath:RubanDefaultPath resolve:resolve reject:reject];
  } reject:reject];
}

RCT_REMAP_METHOD(presentImportPrivateKey,
                 presentImportPrivateKeyWithLabel:(NSString *)label
                 resolver:(RCTPromiseResolveBlock)resolve
                 rejecter:(RCTPromiseRejectBlock)reject) {
  [self presentSecretInput:@"Import private key" placeholder:@"0x…" completion:^(NSString *value) {
    [self createSecretAccountWithLabel:label kind:@"private-key" secret:value derivationPath:nil resolve:resolve reject:reject];
  } reject:reject];
}

RCT_REMAP_METHOD(addWatchOnly,
                 addWatchOnlyWithLabel:(NSString *)label
                 address:(NSString *)address
                 resolver:(RCTPromiseResolveBlock)resolve
                 rejecter:(RCTPromiseRejectBlock)reject) {
  NSError *error = nil;
  NSDictionary *normalized = [self invoke:@"normalizeAddress" params:@{ @"address": address ?: @"" } error:&error];
  if (!normalized) return [self reject:reject error:error];
  NSDictionary *account = @{
    @"id": NSUUID.UUID.UUIDString,
    @"label": [self normalizedLabel:label fallback:@"Watch account"],
    @"address": normalized[@"address"],
    @"kind": @"watch-only",
    @"createdAt": @((long long)([NSDate date].timeIntervalSince1970 * 1000.0))
  };
  resolve(account);
}

RCT_REMAP_METHOD(deleteSecret,
                 deleteSecretWithId:(NSString *)accountId
                 resolver:(RCTPromiseResolveBlock)resolve
                 rejecter:(RCTPromiseRejectBlock)reject) {
  [self deleteSecret:accountId];
  resolve(nil);
}

RCT_REMAP_METHOD(signPersonalMessage,
                 signPersonalMessageWithAccountId:(NSString *)accountId
                 messageHex:(NSString *)messageHex
                 context:(NSDictionary *)context
                 resolver:(RCTPromiseResolveBlock)resolve
                 rejecter:(RCTPromiseRejectBlock)reject) {
  [self confirmSigning:accountId title:@"Sign message" context:context operation:@"signPersonalMessage"
    additionalParams:@{ @"messageHex": messageHex ?: @"" } resolve:resolve reject:reject resultKey:@"signature"];
}

RCT_REMAP_METHOD(signTypedData,
                 signTypedDataWithAccountId:(NSString *)accountId
                 typedDataJson:(NSString *)typedDataJson
                 context:(NSDictionary *)context
                 resolver:(RCTPromiseResolveBlock)resolve
                 rejecter:(RCTPromiseRejectBlock)reject) {
  NSData *data = [typedDataJson dataUsingEncoding:NSUTF8StringEncoding];
  id typedData = data ? [NSJSONSerialization JSONObjectWithData:data options:0 error:nil] : nil;
  if (![typedData isKindOfClass:NSDictionary.class]) return reject(@"invalid_request", @"Typed data must be a JSON object", nil);
  [self confirmSigning:accountId title:@"Sign typed data" context:context operation:@"signTypedData"
    additionalParams:@{ @"typedData": typedData } resolve:resolve reject:reject resultKey:@"signature"];
}

RCT_REMAP_METHOD(signEip1559Transaction,
                 signEip1559TransactionWithAccountId:(NSString *)accountId
                 transaction:(NSDictionary *)transaction
                 context:(NSDictionary *)context
                 resolver:(RCTPromiseResolveBlock)resolve
                 rejecter:(RCTPromiseRejectBlock)reject) {
  [self confirmSigning:accountId title:@"Sign transaction" context:context operation:@"signEip1559Transaction"
    additionalParams:@{ @"transaction": transaction ?: @{} } resolve:resolve reject:reject resultKey:nil];
}

- (void)presentSecretInput:(NSString *)title placeholder:(NSString *)placeholder completion:(void (^)(NSString *))completion reject:(RCTPromiseRejectBlock)reject {
  dispatch_async(dispatch_get_main_queue(), ^{
    UIAlertController *alert = [UIAlertController alertControllerWithTitle:title message:nil preferredStyle:UIAlertControllerStyleAlert];
    [alert addTextFieldWithConfigurationHandler:^(UITextField *field) {
      field.placeholder = placeholder;
      field.autocorrectionType = UITextAutocorrectionTypeNo;
      field.autocapitalizationType = UITextAutocapitalizationTypeNone;
      field.spellCheckingType = UITextSpellCheckingTypeNo;
      field.secureTextEntry = NO;
    }];
    [alert addAction:[UIAlertAction actionWithTitle:@"Cancel" style:UIAlertActionStyleCancel handler:^(__unused UIAlertAction *action) {
      reject(@"cancelled", @"Import cancelled", nil);
    }]];
    [alert addAction:[UIAlertAction actionWithTitle:@"Import" style:UIAlertActionStyleDefault handler:^(__unused UIAlertAction *action) {
      NSString *value = alert.textFields.firstObject.text ?: @"";
      alert.textFields.firstObject.text = @"";
      completion(value);
    }]];
    [[self topViewController] presentViewController:alert animated:YES completion:nil];
  });
}

- (void)createSecretAccountWithLabel:(NSString *)label kind:(NSString *)kind secret:(NSString *)secret derivationPath:(NSString *)path resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject {
  NSMutableDictionary *params = [@{ @"kind": kind, @"secret": secret } mutableCopy];
  if (path) params[@"derivationPath"] = path;
  NSError *error = nil;
  NSDictionary *derived = [self invoke:@"deriveAccount" params:params error:&error];
  if (!derived) return [self reject:reject error:error];
  NSString *accountId = NSUUID.UUID.UUIDString;
  NSMutableDictionary *account = [@{
    @"id": accountId,
    @"label": [self normalizedLabel:label fallback:@"Account"],
    @"address": derived[@"address"],
    @"kind": kind,
    @"createdAt": @((long long)([NSDate date].timeIntervalSince1970 * 1000.0))
  } mutableCopy];
  if (path) account[@"derivationPath"] = path;
  NSDictionary *stored = path ? @{ @"kind": kind, @"derivationPath": path, @"value": secret } : @{ @"kind": kind, @"value": secret };
  NSData *storedData = [NSJSONSerialization dataWithJSONObject:stored options:0 error:&error];
  if (!storedData || ![self storeSecret:storedData accountId:accountId error:&error]) return [self reject:reject error:error];
  resolve(account);
}

- (void)confirmSigning:(NSString *)accountId title:(NSString *)title context:(NSDictionary *)context operation:(NSString *)operation additionalParams:(NSDictionary *)additional resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject resultKey:(NSString *)resultKey {
  if (![self hasSecret:accountId]) return reject(@"secret_not_found", @"Account secret not found", nil);
  NSString *origin = [context[@"origin"] isKindOfClass:NSString.class] ? context[@"origin"] : @"Unknown origin";
  NSNumber *chainId = [context[@"chainId"] isKindOfClass:NSNumber.class] ? context[@"chainId"] : @0;
  NSString *address = [context[@"accountAddress"] isKindOfClass:NSString.class] ? context[@"accountAddress"] : accountId;
  NSString *message = [NSString stringWithFormat:@"%@\nChain ID %@\n\n%@", origin, chainId, address];
  dispatch_async(dispatch_get_main_queue(), ^{
    UIAlertController *alert = [UIAlertController alertControllerWithTitle:title message:message preferredStyle:UIAlertControllerStyleAlert];
    [alert addAction:[UIAlertAction actionWithTitle:@"Reject" style:UIAlertActionStyleCancel handler:^(__unused UIAlertAction *action) {
      reject(@"user_rejected", @"Signing request rejected", nil);
    }]];
    [alert addAction:[UIAlertAction actionWithTitle:@"Confirm" style:UIAlertActionStyleDefault handler:^(__unused UIAlertAction *action) {
      NSError *error = nil;
      NSDictionary *secret = [self readSecret:accountId error:&error];
      if (!secret) return [self reject:reject error:error];
      NSMutableDictionary *params = [additional mutableCopy];
      params[@"kind"] = secret[@"kind"];
      params[@"secret"] = secret[@"value"];
      if (secret[@"derivationPath"]) params[@"derivationPath"] = secret[@"derivationPath"];
      NSDictionary *result = [self invoke:operation params:params error:&error];
      if (!result) return [self reject:reject error:error];
      resolve(resultKey ? result[resultKey] : result);
    }]];
    [[self topViewController] presentViewController:alert animated:YES completion:nil];
  });
}

- (NSDictionary *)invoke:(NSString *)operation params:(NSDictionary *)params error:(NSError **)error {
  NSData *requestData = [NSJSONSerialization dataWithJSONObject:@{ @"operation": operation, @"params": params } options:0 error:error];
  if (!requestData) return nil;
  NSString *request = [[NSString alloc] initWithData:requestData encoding:NSUTF8StringEncoding];
  char *raw = (char *)ruban_wallet_invoke(request.UTF8String);
  if (!raw) {
    if (error) *error = [NSError errorWithDomain:@"RubanWalletCore" code:1 userInfo:@{NSLocalizedDescriptionKey: @"Wallet core failed"}];
    return nil;
  }
  NSString *responseString = [NSString stringWithUTF8String:raw];
  ruban_wallet_string_free(raw);
  NSDictionary *response = [NSJSONSerialization JSONObjectWithData:[responseString dataUsingEncoding:NSUTF8StringEncoding] options:0 error:error];
  if (![response[@"ok"] boolValue]) {
    NSDictionary *failure = response[@"error"];
    if (error) *error = [NSError errorWithDomain:@"RubanWalletCore" code:2 userInfo:@{
      NSLocalizedDescriptionKey: failure[@"message"] ?: @"Wallet core failed",
      @"code": failure[@"code"] ?: @"native_error"
    }];
    return nil;
  }
  return response[@"result"];
}

- (BOOL)storeSecret:(NSData *)data accountId:(NSString *)accountId error:(NSError **)error {
  NSDictionary *query = @{
    (__bridge id)kSecClass: (__bridge id)kSecClassGenericPassword,
    (__bridge id)kSecAttrService: RubanKeychainService,
    (__bridge id)kSecAttrAccount: accountId
  };
  SecItemDelete((__bridge CFDictionaryRef)query);
  NSMutableDictionary *item = [query mutableCopy];
  item[(__bridge id)kSecValueData] = data;
  item[(__bridge id)kSecAttrAccessible] = (__bridge id)kSecAttrAccessibleWhenUnlockedThisDeviceOnly;
  OSStatus status = SecItemAdd((__bridge CFDictionaryRef)item, NULL);
  if (status == errSecSuccess) return YES;
  if (error) *error = [NSError errorWithDomain:NSOSStatusErrorDomain code:status userInfo:@{NSLocalizedDescriptionKey: @"Unable to store wallet secret"}];
  return NO;
}

- (NSDictionary *)readSecret:(NSString *)accountId error:(NSError **)error {
  NSDictionary *query = @{
    (__bridge id)kSecClass: (__bridge id)kSecClassGenericPassword,
    (__bridge id)kSecAttrService: RubanKeychainService,
    (__bridge id)kSecAttrAccount: accountId,
    (__bridge id)kSecReturnData: @YES,
    (__bridge id)kSecMatchLimit: (__bridge id)kSecMatchLimitOne
  };
  CFTypeRef result = NULL;
  OSStatus status = SecItemCopyMatching((__bridge CFDictionaryRef)query, &result);
  if (status != errSecSuccess) {
    if (error) *error = [NSError errorWithDomain:NSOSStatusErrorDomain code:status userInfo:@{NSLocalizedDescriptionKey: @"Account secret not found"}];
    return nil;
  }
  NSData *data = CFBridgingRelease(result);
  return [NSJSONSerialization JSONObjectWithData:data options:0 error:error];
}

- (BOOL)hasSecret:(NSString *)accountId {
  NSDictionary *query = @{
    (__bridge id)kSecClass: (__bridge id)kSecClassGenericPassword,
    (__bridge id)kSecAttrService: RubanKeychainService,
    (__bridge id)kSecAttrAccount: accountId,
    (__bridge id)kSecMatchLimit: (__bridge id)kSecMatchLimitOne
  };
  return SecItemCopyMatching((__bridge CFDictionaryRef)query, NULL) == errSecSuccess;
}

- (void)deleteSecret:(NSString *)accountId {
  NSDictionary *query = @{
    (__bridge id)kSecClass: (__bridge id)kSecClassGenericPassword,
    (__bridge id)kSecAttrService: RubanKeychainService,
    (__bridge id)kSecAttrAccount: accountId
  };
  SecItemDelete((__bridge CFDictionaryRef)query);
}

- (UIViewController *)topViewController {
  UIWindow *window = nil;
  for (UIScene *scene in UIApplication.sharedApplication.connectedScenes) {
    if (scene.activationState != UISceneActivationStateForegroundActive || ![scene isKindOfClass:UIWindowScene.class]) continue;
    for (UIWindow *candidate in ((UIWindowScene *)scene).windows) if (candidate.isKeyWindow) window = candidate;
  }
  if (!window) window = UIApplication.sharedApplication.delegate.window;
  UIViewController *controller = window.rootViewController;
  while (controller.presentedViewController) controller = controller.presentedViewController;
  return controller;
}

- (NSString *)normalizedLabel:(NSString *)label fallback:(NSString *)fallback {
  NSString *value = [label stringByTrimmingCharactersInSet:NSCharacterSet.whitespaceAndNewlineCharacterSet];
  return value.length ? value : fallback;
}

- (void)reject:(RCTPromiseRejectBlock)reject error:(NSError *)error {
  NSString *code = [error.userInfo[@"code"] isKindOfClass:NSString.class] ? error.userInfo[@"code"] : @"wallet_core_failed";
  reject(code, error.localizedDescription ?: @"Wallet core failed", error);
}

@end
