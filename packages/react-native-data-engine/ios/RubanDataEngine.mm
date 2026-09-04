#import "RubanDataEngine.h"

#import "ruban_data_engine.hpp"
#import <sqlite3.h>

static NSString *const RubanDataEngineSyncEvent = @"RubanDataEngineSyncState";

static NSError *RubanDataEngineError(NSString *code, NSString *message) {
  return [NSError errorWithDomain:@"RubanDataEngine"
                             code:1
                         userInfo:@{
                           @"code" : code,
                           NSLocalizedDescriptionKey : message
                         }];
}

static BOOL RubanBind(sqlite3_stmt *statement, NSArray *parameters,
                      NSError **error) {
  for (NSUInteger index = 0; index < parameters.count; index += 1) {
    id value = parameters[index];
    int position = (int)index + 1;
    int status = SQLITE_OK;
    if (value == NSNull.null) {
      status = sqlite3_bind_null(statement, position);
    } else if ([value isKindOfClass:NSString.class]) {
      status = sqlite3_bind_text(statement, position,
                                 [value UTF8String], -1, SQLITE_TRANSIENT);
    } else if ([value isKindOfClass:NSNumber.class]) {
      if (CFNumberIsFloatType((CFNumberRef)value)) {
        status = sqlite3_bind_double(statement, position, [value doubleValue]);
      } else {
        status = sqlite3_bind_int64(statement, position, [value longLongValue]);
      }
    } else {
      status = SQLITE_MISMATCH;
    }
    if (status != SQLITE_OK) {
      if (error) {
        *error = RubanDataEngineError(@"database_bind_failed",
                                      @"Unable to bind portfolio data");
      }
      return NO;
    }
  }
  return YES;
}

static BOOL RubanExecute(sqlite3 *database, NSString *sql,
                         NSArray *parameters, NSError **error) {
  sqlite3_stmt *statement = nullptr;
  int status = sqlite3_prepare_v2(database, sql.UTF8String, -1, &statement, nullptr);
  if (status != SQLITE_OK || statement == nullptr) {
    if (error) {
      *error = RubanDataEngineError(@"database_prepare_failed",
                                    @"Unable to prepare portfolio storage");
    }
    return NO;
  }
  BOOL bound = RubanBind(statement, parameters, error);
  status = bound ? sqlite3_step(statement) : SQLITE_ERROR;
  sqlite3_finalize(statement);
  if (!bound) return NO;
  if (status != SQLITE_DONE) {
    if (error) {
      *error = RubanDataEngineError(@"database_write_failed",
                                    @"Unable to write portfolio data");
    }
    return NO;
  }
  return YES;
}

static sqlite3 *RubanOpenDatabase(NSString *path, NSError **error) {
  sqlite3 *database = nullptr;
  int status = sqlite3_open_v2(path.fileSystemRepresentation, &database,
                               SQLITE_OPEN_READWRITE | SQLITE_OPEN_FULLMUTEX,
                               nullptr);
  if (status != SQLITE_OK || database == nullptr) {
    if (database) sqlite3_close(database);
    if (error) {
      *error = RubanDataEngineError(@"database_open_failed",
                                    @"Unable to open portfolio storage");
    }
    return nullptr;
  }
  sqlite3_busy_timeout(database, 5000);
  return database;
}

@interface RubanDataEngine ()
@property(nonatomic, copy) NSString *databasePath;
@property(nonatomic) dispatch_queue_t writerQueue;
@end

@implementation RubanDataEngine

RCT_EXPORT_MODULE()

- (instancetype)init {
  self = [super init];
  if (self) {
    _writerQueue = dispatch_queue_create("com.rubanlabs.data-engine.writer",
                                         DISPATCH_QUEUE_SERIAL);
  }
  return self;
}

+ (BOOL)requiresMainQueueSetup {
  return NO;
}

- (NSArray<NSString *> *)supportedEvents {
  return @[ RubanDataEngineSyncEvent ];
}

RCT_REMAP_METHOD(initialize,
                 initializeWithDatabasePath:(NSString *)databasePath
                 resolver:(RCTPromiseResolveBlock)resolve
                 rejecter:(RCTPromiseRejectBlock)reject) {
  BOOL isDirectory = NO;
  BOOL exists = [NSFileManager.defaultManager fileExistsAtPath:databasePath
                                                   isDirectory:&isDirectory];
  if (!exists || isDirectory) {
    reject(@"invalid_database_path", @"Ruban database is not initialized", nil);
    return;
  }
  self.databasePath = databasePath;
  resolve(nil);
}

RCT_REMAP_METHOD(configureMockSource,
                 configureMockSourceWithProviderId:(NSString *)providerId
                 resolver:(RCTPromiseResolveBlock)resolve
                 rejecter:(RCTPromiseRejectBlock)reject) {
  dispatch_async(self.writerQueue, ^{
    if (![providerId isEqualToString:@"debank"]) {
      reject(@"unsupported_provider", @"Unsupported portfolio provider", nil);
      return;
    }
    NSError *error = nil;
    sqlite3 *database = RubanOpenDatabase(self.databasePath, &error);
    if (!database) {
      [self reject:reject error:error];
      return;
    }
    NSNumber *updatedAt = @((long long)(NSDate.date.timeIntervalSince1970 * 1000));
    BOOL written = RubanExecute(
        database,
        @"INSERT OR REPLACE INTO portfolio_data_sources "
         "(provider_id, mode, credential_state, enabled, updated_at) "
         "VALUES (?, ?, ?, ?, ?)",
        @[ providerId, @"mock", @"mock", @1, updatedAt ], &error);
    sqlite3_close(database);
    if (!written) {
      [self reject:reject error:error];
      return;
    }
    resolve(@{
      @"providerId" : providerId,
      @"mode" : @"mock",
      @"credentialState" : @"mock",
      @"enabled" : @YES,
      @"updatedAt" : updatedAt
    });
  });
}

RCT_REMAP_METHOD(syncMockPortfolio,
                 syncMockPortfolioWithProviderId:(NSString *)providerId
                 address:(NSString *)address
                 resolver:(RCTPromiseResolveBlock)resolve
                 rejecter:(RCTPromiseRejectBlock)reject) {
  NSString *runId = NSUUID.UUID.UUIDString;
  long long queuedAt = (long long)(NSDate.date.timeIntervalSince1970 * 1000);
  [self emitProvider:providerId address:address runId:runId state:@"queued"
               stage:@"waiting" completedChains:0 totalChains:5
           updatedAt:queuedAt errorCode:nil];
  dispatch_async(self.writerQueue, ^{
    [self runMockSync:providerId address:address runId:runId
               resolve:resolve reject:reject];
  });
}

- (void)runMockSync:(NSString *)providerId address:(NSString *)address
              runId:(NSString *)runId resolve:(RCTPromiseResolveBlock)resolve
             reject:(RCTPromiseRejectBlock)reject {
  long long startedAt = (long long)(NSDate.date.timeIntervalSince1970 * 1000);
  NSError *error = nil;
  if (![providerId isEqualToString:@"debank"]) {
    [self reject:reject
           error:RubanDataEngineError(@"unsupported_provider",
                                      @"Unsupported portfolio provider")];
    return;
  }
  if (![self writeSyncStateProvider:providerId address:address runId:runId
                              state:@"running" stage:@"portfolio"
                    completedChains:0 totalChains:5 startedAt:startedAt
                        completedAt:0 updatedAt:startedAt errorCode:nil
                              error:&error]) {
    [self reject:reject error:error];
    return;
  }
  [self emitProvider:providerId address:address runId:runId state:@"running"
               stage:@"portfolio" completedChains:0 totalChains:5
           updatedAt:startedAt errorCode:nil];

  NSDictionary *projection = nil;
  try {
    ruban::data::MockDeBankProvider provider;
    auto nativeProjection = provider.fetch(address.UTF8String, startedAt);
    auto json = ruban::data::serialize_projection_json(nativeProjection);
    NSData *data = [NSData dataWithBytes:json.data() length:json.size()];
    projection = [NSJSONSerialization JSONObjectWithData:data options:0 error:&error];
  } catch (const std::invalid_argument &) {
    error = RubanDataEngineError(@"invalid_evm_address",
                                 @"Invalid EVM address");
  } catch (const std::exception &) {
    error = RubanDataEngineError(@"projection_failed",
                                 @"Unable to generate portfolio projection");
  }

  if (![projection isKindOfClass:NSDictionary.class]) {
    [self failRun:providerId address:address runId:runId startedAt:startedAt
        errorCode:@"projection_failed" reject:reject error:error];
    return;
  }

  NSString *normalizedAddress = projection[@"address"];
  NSArray *chains = projection[@"chains"];
  NSArray *tokens = projection[@"tokens"];
  NSArray *protocols = projection[@"protocols"];
  long long completedAt = (long long)(NSDate.date.timeIntervalSince1970 * 1000);
  sqlite3 *database = RubanOpenDatabase(self.databasePath, &error);
  if (!database) {
    [self failRun:providerId address:address runId:runId startedAt:startedAt
        errorCode:@"database_open_failed" reject:reject error:error];
    return;
  }

  BOOL written = RubanExecute(database, @"BEGIN IMMEDIATE", @[], &error) &&
                 [self replaceProjection:projection database:database error:&error] &&
                 [self upsertSyncState:database provider:providerId
                               address:normalizedAddress runId:runId
                                 state:@"succeeded" stage:@"complete"
                       completedChains:chains.count totalChains:chains.count
                             startedAt:startedAt completedAt:completedAt
                            durationMs:completedAt - startedAt
                             updatedAt:completedAt errorCode:nil error:&error] &&
                 RubanExecute(database, @"COMMIT", @[], &error);
  if (!written) RubanExecute(database, @"ROLLBACK", @[], nil);
  sqlite3_close(database);
  if (!written) {
    [self failRun:providerId address:address runId:runId startedAt:startedAt
        errorCode:@"database_write_failed" reject:reject error:error];
    return;
  }

  [self emitProvider:providerId address:normalizedAddress runId:runId
               state:@"succeeded" stage:@"complete"
     completedChains:chains.count totalChains:chains.count
           updatedAt:completedAt errorCode:nil];
  resolve(@{
    @"providerId" : providerId,
    @"address" : normalizedAddress,
    @"runId" : runId,
    @"completedChains" : @(chains.count),
    @"totalChains" : @(chains.count),
    @"observedAt" : projection[@"observedAt"]
  });
}

- (BOOL)replaceProjection:(NSDictionary *)projection database:(sqlite3 *)database
                     error:(NSError **)error {
  NSString *providerId = projection[@"providerId"];
  NSString *address = projection[@"address"];
  NSNumber *observedAt = projection[@"observedAt"];
  NSArray *key = @[ providerId, address ];
  if (!RubanExecute(database,
                    @"DELETE FROM portfolio_token_balances WHERE provider_id = ? AND address = ?",
                    key, error) ||
      !RubanExecute(database,
                    @"DELETE FROM portfolio_protocol_positions WHERE provider_id = ? AND address = ?",
                    key, error) ||
      !RubanExecute(database,
                    @"DELETE FROM portfolio_chain_snapshots WHERE provider_id = ? AND address = ?",
                    key, error) ||
      !RubanExecute(database,
                    @"DELETE FROM portfolio_account_snapshots WHERE provider_id = ? AND address = ?",
                    key, error) ||
      !RubanExecute(database,
                    @"INSERT INTO portfolio_account_snapshots "
                     "(provider_id, address, total_value_usd, observed_at) VALUES (?, ?, ?, ?)",
                    @[ providerId, address, projection[@"totalValueUsd"], observedAt ], error)) {
    return NO;
  }

  for (NSDictionary *chain in projection[@"chains"]) {
    if (!RubanExecute(
            database,
            @"INSERT INTO portfolio_chain_snapshots "
             "(provider_id, address, chain_id, chain_key, chain_name, value_usd, latency_ms, source, observed_at) "
             "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            @[ providerId, address, chain[@"chainId"], chain[@"chainKey"],
               chain[@"chainName"], chain[@"valueUsd"], chain[@"latencyMs"],
               chain[@"source"], observedAt ],
            error)) return NO;
  }
  for (NSDictionary *token in projection[@"tokens"]) {
    NSString *contractAddress = token[@"contractAddress"];
    id storedAddress = contractAddress.length ? contractAddress : NSNull.null;
    if (!RubanExecute(
            database,
            @"INSERT INTO portfolio_token_balances "
             "(provider_id, address, chain_id, asset_id, symbol, name, contract_address, decimals, balance, display_balance, price_usd, value_usd, observed_at) "
             "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            @[ providerId, address, token[@"chainId"], token[@"assetId"],
               token[@"symbol"], token[@"name"], storedAddress,
               token[@"decimals"], token[@"balance"], token[@"displayBalance"],
               token[@"priceUsd"], token[@"valueUsd"], observedAt ],
            error)) return NO;
  }
  for (NSDictionary *protocol in projection[@"protocols"]) {
    if (!RubanExecute(
            database,
            @"INSERT INTO portfolio_protocol_positions "
             "(provider_id, address, chain_id, protocol_id, position_id, protocol_name, category, asset_value_usd, debt_value_usd, net_value_usd, observed_at) "
             "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            @[ providerId, address, protocol[@"chainId"], protocol[@"protocolId"],
               protocol[@"positionId"], protocol[@"protocolName"],
               protocol[@"category"], protocol[@"assetValueUsd"],
               protocol[@"debtValueUsd"], protocol[@"netValueUsd"], observedAt ],
            error)) return NO;
  }
  return YES;
}

- (BOOL)writeSyncStateProvider:(NSString *)providerId address:(NSString *)address
                         runId:(NSString *)runId state:(NSString *)state
                         stage:(NSString *)stage completedChains:(NSInteger)completedChains
                   totalChains:(NSInteger)totalChains startedAt:(long long)startedAt
                   completedAt:(long long)completedAt updatedAt:(long long)updatedAt
                     errorCode:(NSString *)errorCode error:(NSError **)error {
  sqlite3 *database = RubanOpenDatabase(self.databasePath, error);
  if (!database) return NO;
  BOOL result = [self upsertSyncState:database provider:providerId
                               address:address.lowercaseString runId:runId
                                 state:state stage:stage
                       completedChains:completedChains totalChains:totalChains
                             startedAt:startedAt completedAt:completedAt
                            durationMs:completedAt ? completedAt - startedAt : 0
                             updatedAt:updatedAt errorCode:errorCode error:error];
  sqlite3_close(database);
  return result;
}

- (BOOL)upsertSyncState:(sqlite3 *)database provider:(NSString *)providerId
                 address:(NSString *)address runId:(NSString *)runId
                   state:(NSString *)state stage:(NSString *)stage
         completedChains:(NSInteger)completedChains totalChains:(NSInteger)totalChains
               startedAt:(long long)startedAt completedAt:(long long)completedAt
              durationMs:(long long)durationMs updatedAt:(long long)updatedAt
               errorCode:(NSString *)errorCode error:(NSError **)error {
  return RubanExecute(
      database,
      @"INSERT OR REPLACE INTO portfolio_sync_state "
       "(provider_id, address, run_id, state, stage, completed_chains, total_chains, started_at, completed_at, duration_ms, updated_at, error_code) "
       "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      @[ providerId, address, runId, state, stage, @(completedChains),
         @(totalChains), @(startedAt), completedAt ? @(completedAt) : NSNull.null,
         @(durationMs), @(updatedAt), errorCode ?: NSNull.null ],
      error);
}

- (void)failRun:(NSString *)providerId address:(NSString *)address
          runId:(NSString *)runId startedAt:(long long)startedAt
      errorCode:(NSString *)errorCode reject:(RCTPromiseRejectBlock)reject
          error:(NSError *)error {
  long long failedAt = (long long)(NSDate.date.timeIntervalSince1970 * 1000);
  [self writeSyncStateProvider:providerId address:address runId:runId
                         state:@"failed" stage:@"complete" completedChains:0
                   totalChains:5 startedAt:startedAt completedAt:failedAt
                     updatedAt:failedAt errorCode:errorCode error:nil];
  [self emitProvider:providerId address:address runId:runId state:@"failed"
               stage:@"complete" completedChains:0 totalChains:5
           updatedAt:failedAt errorCode:errorCode];
  [self reject:reject error:error ?: RubanDataEngineError(errorCode,
                                                         @"Portfolio sync failed")];
}

- (void)emitProvider:(NSString *)providerId address:(NSString *)address
               runId:(NSString *)runId state:(NSString *)state stage:(NSString *)stage
     completedChains:(NSInteger)completedChains totalChains:(NSInteger)totalChains
           updatedAt:(long long)updatedAt errorCode:(NSString *)errorCode {
  NSMutableDictionary *payload = [@{
    @"providerId" : providerId ?: @"debank",
    @"address" : address.lowercaseString ?: @"",
    @"runId" : runId,
    @"state" : state,
    @"stage" : stage,
    @"completedChains" : @(completedChains),
    @"totalChains" : @(totalChains),
    @"updatedAt" : @(updatedAt)
  } mutableCopy];
  if (errorCode) payload[@"errorCode"] = errorCode;
  [self sendEventWithName:RubanDataEngineSyncEvent body:payload];
}

- (void)reject:(RCTPromiseRejectBlock)reject error:(NSError *)error {
  NSString *code = [error.userInfo[@"code"] isKindOfClass:NSString.class]
                       ? error.userInfo[@"code"]
                       : @"data_engine_failed";
  reject(code, error.localizedDescription ?: @"Portfolio data engine failed", error);
}

@end
