#import "RubanDataEngine.h"

#import "ruban_data_engine.hpp"
#import <Security/Security.h>
#import <sqlite3.h>

static NSString *const RubanDataEngineSyncEvent = @"RubanDataEngineSyncState";
static NSString *const RubanProviderId = @"debank";
static NSString *const RubanDeBankHost = @"pro-openapi.debank.com";
static NSInteger const RubanDeBankRequestCount = 3;
static NSInteger const RubanDeBankMaxSyncDurationMs = 30000;
static NSInteger const RubanDeBankMinimumIntervalMs = 10;

static NSError *RubanDataEngineError(NSString *code, NSString *message) {
  return [NSError errorWithDomain:@"RubanDataEngine"
                             code:1
                         userInfo:@{
                           @"code" : code,
                           NSLocalizedDescriptionKey : message
                         }];
}

static long long RubanNowMs(void) {
  return (long long)(NSDate.date.timeIntervalSince1970 * 1000);
}

static long long RubanUptimeMs(void) {
  return (long long)(NSProcessInfo.processInfo.systemUptime * 1000);
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
        *error = RubanDataEngineError(@"database_write_failed",
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
      *error = RubanDataEngineError(@"database_write_failed",
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
  if (!path.length) {
    if (error) {
      *error = RubanDataEngineError(@"data_engine_not_initialized",
                                    @"Portfolio data engine is not initialized");
    }
    return nullptr;
  }
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

static NSString *RubanCredentialService(void) {
  NSString *bundleId = NSBundle.mainBundle.bundleIdentifier ?: @"com.rubanlabs.mobile";
  return [bundleId stringByAppendingString:@".ruban-data-engine"];
}

static NSDictionary *RubanCredentialQuery(void) {
  return @{
    (__bridge id)kSecClass : (__bridge id)kSecClassGenericPassword,
    (__bridge id)kSecAttrService : RubanCredentialService(),
    (__bridge id)kSecAttrAccount : @"debank.access-key"
  };
}

static BOOL RubanWriteAccessKey(NSString *accessKey, NSError **error) {
  NSCharacterSet *nullCharacter =
      [NSCharacterSet characterSetWithRange:NSMakeRange(0, 1)];
  if (!accessKey.length || accessKey.length > 4096 ||
      [accessKey rangeOfCharacterFromSet:nullCharacter].location != NSNotFound) {
    if (error) *error = RubanDataEngineError(@"invalid_access_key", @"Invalid AccessKey");
    return NO;
  }
  NSData *data = [accessKey dataUsingEncoding:NSUTF8StringEncoding];
  NSDictionary *query = RubanCredentialQuery();
  OSStatus status = SecItemCopyMatching((__bridge CFDictionaryRef)query, nullptr);
  if (status == errSecSuccess) {
    status = SecItemUpdate(
        (__bridge CFDictionaryRef)query,
        (__bridge CFDictionaryRef)@{(__bridge id)kSecValueData : data});
  } else if (status == errSecItemNotFound) {
    NSMutableDictionary *attributes = [query mutableCopy];
    attributes[(__bridge id)kSecValueData] = data;
    attributes[(__bridge id)kSecAttrAccessible] =
        (__bridge id)kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly;
    status = SecItemAdd((__bridge CFDictionaryRef)attributes, nullptr);
  }
  if (status != errSecSuccess) {
    if (error) {
      *error = RubanDataEngineError(@"credential_store_failed",
                                    @"Unable to store DeBank credential");
    }
    return NO;
  }
  return YES;
}

static NSString *RubanReadAccessKey(NSError **error) {
  NSMutableDictionary *query = [RubanCredentialQuery() mutableCopy];
  query[(__bridge id)kSecReturnData] = @YES;
  query[(__bridge id)kSecMatchLimit] = (__bridge id)kSecMatchLimitOne;
  CFTypeRef result = nullptr;
  OSStatus status = SecItemCopyMatching((__bridge CFDictionaryRef)query, &result);
  if (status == errSecItemNotFound) {
    if (error) *error = RubanDataEngineError(@"credential_missing", @"AccessKey is missing");
    return nil;
  }
  if (status != errSecSuccess || result == nullptr) {
    if (result) CFRelease(result);
    if (error) {
      *error = RubanDataEngineError(@"credential_unavailable",
                                    @"Unable to read DeBank credential");
    }
    return nil;
  }
  NSData *data = CFBridgingRelease(result);
  NSString *accessKey = [[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding];
  if (!accessKey.length) {
    if (error) {
      *error = RubanDataEngineError(@"credential_unavailable",
                                    @"Unable to read DeBank credential");
    }
    return nil;
  }
  return accessKey;
}

static BOOL RubanHasAccessKey(void) {
  return RubanReadAccessKey(nil).length > 0;
}

static BOOL RubanClearAccessKey(NSError **error) {
  OSStatus status = SecItemDelete((__bridge CFDictionaryRef)RubanCredentialQuery());
  if (status != errSecSuccess && status != errSecItemNotFound) {
    if (error) {
      *error = RubanDataEngineError(@"credential_clear_failed",
                                    @"Unable to clear DeBank credential");
    }
    return NO;
  }
  return YES;
}

static id RubanJSONObject(std::string_view json, NSError **error) {
  NSData *data = [NSData dataWithBytes:json.data() length:json.size()];
  return [NSJSONSerialization JSONObjectWithData:data options:0 error:error];
}

static NSString *RubanJSONString(id object, NSError **error) {
  NSData *data = [NSJSONSerialization dataWithJSONObject:object options:0 error:error];
  return data ? [[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding] : nil;
}

@interface RubanSyncCancellation : NSObject
@property(nonatomic, readonly) BOOL cancelled;
@property(nonatomic, copy, readonly) NSString *reason;
- (BOOL)cancelWithReason:(NSString *)reason;
- (BOOL)registerTask:(NSURLSessionDataTask *)task;
- (void)unregisterTask:(NSURLSessionDataTask *)task;
- (void)abortActiveTasks;
- (BOOL)sleepForMilliseconds:(long long)milliseconds;
@end

@implementation RubanSyncCancellation {
  BOOL _cancelled;
  NSString *_reason;
  NSMutableSet<NSURLSessionDataTask *> *_tasks;
}

- (instancetype)init {
  self = [super init];
  if (self) _tasks = [NSMutableSet set];
  return self;
}

- (BOOL)cancelled {
  @synchronized(self) {
    return _cancelled;
  }
}

- (NSString *)reason {
  @synchronized(self) {
    return _reason ?: @"sync_cancelled";
  }
}

- (BOOL)cancelWithReason:(NSString *)reason {
  @synchronized(self) {
    if (_cancelled) return NO;
    _cancelled = YES;
    _reason = [reason copy];
  }
  [self abortActiveTasks];
  return YES;
}

- (BOOL)registerTask:(NSURLSessionDataTask *)task {
  @synchronized(self) {
    if (_cancelled) {
      [task cancel];
      return NO;
    }
    [_tasks addObject:task];
    return YES;
  }
}

- (void)unregisterTask:(NSURLSessionDataTask *)task {
  @synchronized(self) {
    [_tasks removeObject:task];
  }
}

- (void)abortActiveTasks {
  NSArray<NSURLSessionDataTask *> *tasks;
  @synchronized(self) {
    tasks = _tasks.allObjects;
  }
  for (NSURLSessionDataTask *task in tasks) [task cancel];
}

- (BOOL)sleepForMilliseconds:(long long)milliseconds {
  long long remaining = milliseconds;
  while (remaining > 0) {
    if (self.cancelled) return NO;
    long long interval = MIN(remaining, 50);
    [NSThread sleepForTimeInterval:(NSTimeInterval)interval / 1000.0];
    remaining -= interval;
  }
  return !self.cancelled;
}

@end

@interface RubanSyncRun : NSObject
@property(nonatomic, copy) NSString *key;
@property(nonatomic, copy) NSString *providerId;
@property(nonatomic, copy) NSString *address;
@property(nonatomic, copy) NSString *optionsJson;
@property(nonatomic, copy) NSString *forcedMode;
@property(nonatomic, copy) NSString *fingerprint;
@property(nonatomic, copy) NSString *runId;
@property(nonatomic) long long queuedAt;
@property(nonatomic) NSInteger totalChains;
@property(nonatomic) RubanSyncCancellation *cancellation;
- (instancetype)initWithKey:(NSString *)key providerId:(NSString *)providerId
                     address:(NSString *)address optionsJson:(NSString *)optionsJson
                  forcedMode:(NSString *)forcedMode fingerprint:(NSString *)fingerprint
                       runId:(NSString *)runId queuedAt:(long long)queuedAt
                 totalChains:(NSInteger)totalChains resolve:(RCTPromiseResolveBlock)resolve
                      reject:(RCTPromiseRejectBlock)reject;
- (BOOL)addResolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject;
- (BOOL)cancelWithReason:(NSString *)reason;
- (void)markTerminal;
- (void)resolveAll:(id)value;
- (void)rejectAllWithCode:(NSString *)code error:(NSError *)error;
@end

@implementation RubanSyncRun {
  NSMutableArray<RCTPromiseResolveBlock> *_resolvers;
  NSMutableArray<RCTPromiseRejectBlock> *_rejecters;
  BOOL _settled;
  BOOL _terminal;
}

- (instancetype)initWithKey:(NSString *)key providerId:(NSString *)providerId
                     address:(NSString *)address optionsJson:(NSString *)optionsJson
                  forcedMode:(NSString *)forcedMode fingerprint:(NSString *)fingerprint
                       runId:(NSString *)runId queuedAt:(long long)queuedAt
                 totalChains:(NSInteger)totalChains resolve:(RCTPromiseResolveBlock)resolve
                      reject:(RCTPromiseRejectBlock)reject {
  self = [super init];
  if (self) {
    _key = [key copy];
    _providerId = [providerId copy];
    _address = [address copy];
    _optionsJson = [optionsJson copy];
    _forcedMode = [forcedMode copy];
    _fingerprint = [fingerprint copy];
    _runId = [runId copy];
    _queuedAt = queuedAt;
    _totalChains = totalChains;
    _cancellation = [RubanSyncCancellation new];
    _resolvers = [NSMutableArray arrayWithObject:[resolve copy]];
    _rejecters = [NSMutableArray arrayWithObject:[reject copy]];
  }
  return self;
}

- (BOOL)addResolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject {
  @synchronized(self) {
    if (_settled || _terminal || self.cancellation.cancelled) return NO;
    [_resolvers addObject:[resolve copy]];
    [_rejecters addObject:[reject copy]];
    return YES;
  }
}

- (BOOL)cancelWithReason:(NSString *)reason {
  @synchronized(self) {
    if (_settled || _terminal) return NO;
    return [self.cancellation cancelWithReason:reason];
  }
}

- (void)markTerminal {
  @synchronized(self) {
    _terminal = YES;
  }
}

- (void)resolveAll:(id)value {
  NSArray<RCTPromiseResolveBlock> *resolvers;
  @synchronized(self) {
    if (_settled) return;
    _settled = YES;
    resolvers = [_resolvers copy];
    [_resolvers removeAllObjects];
    [_rejecters removeAllObjects];
  }
  for (RCTPromiseResolveBlock resolve in resolvers) resolve(value);
}

- (void)rejectAllWithCode:(NSString *)code error:(NSError *)error {
  NSArray<RCTPromiseRejectBlock> *rejecters;
  @synchronized(self) {
    if (_settled) return;
    _settled = YES;
    rejecters = [_rejecters copy];
    [_resolvers removeAllObjects];
    [_rejecters removeAllObjects];
  }
  for (RCTPromiseRejectBlock reject in rejecters) {
    reject(code, @"Portfolio data engine failed", error);
  }
}

@end

@interface RubanNoRedirectDelegate : NSObject <NSURLSessionTaskDelegate>
@end

@implementation RubanNoRedirectDelegate
- (void)URLSession:(NSURLSession *)session
              task:(NSURLSessionTask *)task
willPerformHTTPRedirection:(NSHTTPURLResponse *)response
        newRequest:(NSURLRequest *)request
 completionHandler:(void (^)(NSURLRequest *_Nullable))completionHandler {
  completionHandler(nil);
}
@end

@interface RubanDeBankHTTPClient : NSObject
@property(nonatomic) NSURLSession *session;
@property(nonatomic) RubanNoRedirectDelegate *delegate;
@property(nonatomic) long long lastRequestAt;
- (NSArray *)executePlan:(NSArray *)plan cancellation:(RubanSyncCancellation *)cancellation
                   error:(NSError **)error;
@end

@implementation RubanDeBankHTTPClient

- (instancetype)init {
  self = [super init];
  if (self) {
    _delegate = [RubanNoRedirectDelegate new];
    NSURLSessionConfiguration *configuration =
        NSURLSessionConfiguration.ephemeralSessionConfiguration;
    configuration.URLCache = nil;
    configuration.requestCachePolicy = NSURLRequestReloadIgnoringLocalCacheData;
    configuration.HTTPMaximumConnectionsPerHost = RubanDeBankRequestCount;
    _session = [NSURLSession sessionWithConfiguration:configuration
                                             delegate:_delegate
                                        delegateQueue:nil];
  }
  return self;
}

- (NSArray *)executePlan:(NSArray *)plan cancellation:(RubanSyncCancellation *)cancellation
                   error:(NSError **)error {
  if (plan.count != RubanDeBankRequestCount) {
    if (error) {
      *error = RubanDataEngineError(@"provider_contract_invalid",
                                    @"Invalid DeBank request plan");
    }
    return nil;
  }
  long long deadline = RubanUptimeMs() + RubanDeBankMaxSyncDurationMs;
  NSMutableArray *payloads = [NSMutableArray arrayWithCapacity:plan.count];
  for (NSUInteger index = 0; index < plan.count; index += 1) {
    [payloads addObject:NSNull.null];
  }
  NSOperationQueue *queue = [NSOperationQueue new];
  queue.maxConcurrentOperationCount = RubanDeBankRequestCount;
  __block NSError *firstError = nil;
  for (NSUInteger index = 0; index < plan.count; index += 1) {
    NSDictionary *request = plan[index];
    [queue addOperationWithBlock:^{
      NSError *requestError = nil;
      NSDictionary *payload = [self executeRequest:request deadline:deadline
                                       cancellation:cancellation error:&requestError];
      @synchronized(payloads) {
        if (payload) {
          payloads[index] = payload;
        } else if (!firstError) {
          firstError = requestError ?: RubanDataEngineError(
              @"provider_transport_failed", @"Unable to reach DeBank");
        }
      }
      if (!payload) {
        [cancellation abortActiveTasks];
        [queue cancelAllOperations];
      }
    }];
  }
  [queue waitUntilAllOperationsAreFinished];
  if (cancellation.cancelled) {
    if (error) *error = RubanDataEngineError(cancellation.reason,
                                              @"Portfolio sync was cancelled");
    return nil;
  }
  if (firstError) {
    if (error) *error = firstError;
    return nil;
  }
  return payloads;
}

- (NSDictionary *)executeRequest:(NSDictionary *)request deadline:(long long)deadline
                     cancellation:(RubanSyncCancellation *)cancellation
                            error:(NSError **)error {
  NSString *endpointId = request[@"endpointId"];
  NSString *path = request[@"path"];
  NSInteger timeoutMs = [request[@"timeoutMs"] integerValue];
  NSInteger maxBodyBytes = [request[@"maxBodyBytes"] integerValue];
  NSInteger maxAttempts = [request[@"maxAttempts"] integerValue];
  if (![self validateEndpoint:endpointId path:path] || timeoutMs <= 0 ||
      maxBodyBytes <= 0 || maxAttempts <= 0 || maxAttempts > 3) {
    if (error) {
      *error = RubanDataEngineError(@"provider_endpoint_rejected",
                                    @"Rejected DeBank endpoint");
    }
    return nil;
  }

  for (NSInteger attempt = 1; attempt <= maxAttempts; attempt += 1) {
    if (cancellation.cancelled) {
      if (error) *error = RubanDataEngineError(cancellation.reason,
                                                @"Portfolio sync was cancelled");
      return nil;
    }
    long long remaining = deadline - RubanUptimeMs();
    if (remaining <= 0) {
      if (error) {
        *error = RubanDataEngineError(@"provider_budget_exceeded",
                                      @"DeBank sync budget exceeded");
      }
      return nil;
    }
    NSError *attemptError = nil;
    NSDictionary *response = [self executeOnce:path
                                      timeoutMs:MIN(timeoutMs, remaining)
                                   maxBodyBytes:maxBodyBytes
                                  cancellation:cancellation
                                          error:&attemptError];
    if (cancellation.cancelled) {
      if (error) *error = RubanDataEngineError(cancellation.reason,
                                                @"Portfolio sync was cancelled");
      return nil;
    }
    NSInteger statusCode = response ? [response[@"statusCode"] integerValue] : 0;
    long long retryAfterMs = response ? [response[@"retryAfterMs"] longLongValue] : -1;
    if (response && statusCode >= 200 && statusCode < 300) {
      return @{
        @"endpointId" : endpointId,
        @"statusCode" : @(statusCode),
        @"body" : response[@"body"],
        @"latencyMs" : response[@"latencyMs"],
        @"attempts" : @(attempt)
      };
    }
    long long delay = ruban::data::retry_delay_ms((int)statusCode, (int)attempt,
                                                   retryAfterMs, (int)maxAttempts);
    if (delay < 0) {
      if (response) {
        return @{
          @"endpointId" : endpointId,
          @"statusCode" : @(statusCode),
          @"body" : response[@"body"],
          @"latencyMs" : response[@"latencyMs"],
          @"attempts" : @(attempt)
        };
      }
      if (error) {
        *error = attemptError ?: RubanDataEngineError(
            @"provider_transport_failed", @"Unable to reach DeBank");
      }
      return nil;
    }
    if (RubanUptimeMs() + delay > deadline) {
      if (error) {
        *error = RubanDataEngineError(@"provider_budget_exceeded",
                                      @"DeBank sync budget exceeded");
      }
      return nil;
    }
    if (![cancellation sleepForMilliseconds:delay]) {
      if (error) *error = RubanDataEngineError(cancellation.reason,
                                                @"Portfolio sync was cancelled");
      return nil;
    }
  }
  if (error) {
    *error = RubanDataEngineError(@"provider_transport_failed",
                                  @"Unable to reach DeBank");
  }
  return nil;
}

- (NSDictionary *)executeOnce:(NSString *)path timeoutMs:(NSInteger)timeoutMs
                  maxBodyBytes:(NSInteger)maxBodyBytes
                 cancellation:(RubanSyncCancellation *)cancellation
                         error:(NSError **)error {
  long long waitMs = 0;
  @synchronized(self) {
    long long now = RubanUptimeMs();
    long long scheduledAt = MAX(now, self.lastRequestAt + RubanDeBankMinimumIntervalMs);
    self.lastRequestAt = scheduledAt;
    waitMs = scheduledAt - now;
  }
  if (waitMs > 0 && ![cancellation sleepForMilliseconds:waitMs]) {
    if (error) *error = RubanDataEngineError(cancellation.reason,
                                              @"Portfolio sync was cancelled");
    return nil;
  }

  NSURL *url = [NSURL URLWithString:[@"https://pro-openapi.debank.com"
                                      stringByAppendingString:path]];
  if (![url.scheme isEqualToString:@"https"] || ![url.host isEqualToString:RubanDeBankHost]) {
    if (error) {
      *error = RubanDataEngineError(@"provider_endpoint_rejected",
                                    @"Rejected DeBank endpoint");
    }
    return nil;
  }
  NSError *credentialError = nil;
  NSString *accessKey = RubanReadAccessKey(&credentialError);
  if (!accessKey) {
    if (error) *error = credentialError;
    return nil;
  }
  NSMutableURLRequest *request = [NSMutableURLRequest requestWithURL:url];
  request.HTTPMethod = @"GET";
  request.timeoutInterval = (NSTimeInterval)timeoutMs / 1000.0;
  request.cachePolicy = NSURLRequestReloadIgnoringLocalCacheData;
  [request setValue:@"application/json" forHTTPHeaderField:@"Accept"];
  [request setValue:accessKey forHTTPHeaderField:@"AccessKey"];

  __block NSData *responseData = nil;
  __block NSURLResponse *urlResponse = nil;
  __block NSError *requestError = nil;
  dispatch_semaphore_t semaphore = dispatch_semaphore_create(0);
  long long startedAt = RubanUptimeMs();
  NSURLSessionDataTask *task = [self.session
      dataTaskWithRequest:request
        completionHandler:^(NSData *data, NSURLResponse *response, NSError *failure) {
          responseData = data;
          urlResponse = response;
          requestError = failure;
          dispatch_semaphore_signal(semaphore);
        }];
  if (![cancellation registerTask:task]) {
    if (error) *error = RubanDataEngineError(cancellation.reason,
                                              @"Portfolio sync was cancelled");
    return nil;
  }
  [task resume];
  long waitStatus = dispatch_semaphore_wait(
      semaphore, dispatch_time(DISPATCH_TIME_NOW, (int64_t)(timeoutMs + 1000) * NSEC_PER_MSEC));
  [cancellation unregisterTask:task];
  if (cancellation.cancelled) {
    if (error) *error = RubanDataEngineError(cancellation.reason,
                                              @"Portfolio sync was cancelled");
    return nil;
  }
  if (waitStatus != 0) {
    [task cancel];
    if (error) {
      *error = RubanDataEngineError(@"provider_transport_failed",
                                    @"DeBank request timed out");
    }
    return nil;
  }
  if (requestError || ![urlResponse isKindOfClass:NSHTTPURLResponse.class]) {
    if (error) {
      *error = RubanDataEngineError(@"provider_transport_failed",
                                    @"Unable to reach DeBank");
    }
    return nil;
  }
  if (responseData.length > (NSUInteger)maxBodyBytes) {
    if (error) {
      *error = RubanDataEngineError(@"provider_response_too_large",
                                    @"DeBank response is too large");
    }
    return nil;
  }
  NSString *body = [[NSString alloc] initWithData:responseData
                                         encoding:NSUTF8StringEncoding];
  if (!body) {
    if (error) {
      *error = RubanDataEngineError(@"provider_contract_invalid",
                                    @"Invalid DeBank response encoding");
    }
    return nil;
  }
  NSHTTPURLResponse *http = (NSHTTPURLResponse *)urlResponse;
  NSString *retryAfter = http.allHeaderFields[@"Retry-After"];
  long long retryAfterMs = -1;
  if ([retryAfter isKindOfClass:NSString.class] && retryAfter.length) {
    NSScanner *scanner = [NSScanner scannerWithString:retryAfter];
    long long seconds = 0;
    if ([scanner scanLongLong:&seconds] && scanner.isAtEnd && seconds >= 0) {
      retryAfterMs = MIN(seconds * 1000, 5000);
    }
  }
  return @{
    @"statusCode" : @(http.statusCode),
    @"body" : body,
    @"latencyMs" : @(MAX(0, RubanUptimeMs() - startedAt)),
    @"retryAfterMs" : @(retryAfterMs)
  };
}

- (BOOL)validateEndpoint:(NSString *)endpointId path:(NSString *)path {
  if (![endpointId isKindOfClass:NSString.class] ||
      ![path isKindOfClass:NSString.class] || [path containsString:@"://"] ||
      [path containsString:@"#"]) return NO;
  if ([endpointId isEqualToString:@"total_balance"]) {
    return [path hasPrefix:@"/v1/user/total_balance?"];
  }
  if ([endpointId isEqualToString:@"all_token_list"]) {
    return [path hasPrefix:@"/v1/user/all_token_list?"];
  }
  if ([endpointId isEqualToString:@"all_simple_protocol_list"]) {
    return [path hasPrefix:@"/v1/user/all_simple_protocol_list?"];
  }
  return NO;
}

@end

@interface RubanDataEngine ()
@property(nonatomic, copy) NSString *databasePath;
@property(nonatomic) dispatch_queue_t writerQueue;
@property(nonatomic) NSMutableDictionary<NSString *, RubanSyncRun *> *inFlightSyncs;
@property(nonatomic) RubanDeBankHTTPClient *httpClient;
@end

@implementation RubanDataEngine

RCT_EXPORT_MODULE()

- (instancetype)init {
  self = [super init];
  if (self) {
    _writerQueue = dispatch_queue_create("com.rubanlabs.data-engine.writer",
                                         DISPATCH_QUEUE_SERIAL);
    _inFlightSyncs = [NSMutableDictionary dictionary];
    _httpClient = [RubanDeBankHTTPClient new];
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
  dispatch_async(self.writerQueue, ^{
    self.databasePath = databasePath;
    NSError *error = nil;
    sqlite3 *database = RubanOpenDatabase(databasePath, &error);
    if (!database) {
      self.databasePath = nil;
      [self reject:reject error:error];
      return;
    }
    long long recoveredAt = RubanNowMs();
    BOOL recovered = RubanExecute(
        database,
        @"UPDATE portfolio_sync_state SET state = ?, stage = ?, completed_at = ?, "
         "duration_ms = CASE WHEN started_at > 0 THEN MAX(0, ? - started_at) ELSE 0 END, "
         "updated_at = ?, error_code = ? WHERE state IN (?, ?)",
        @[ @"failed", @"complete", @(recoveredAt), @(recoveredAt), @(recoveredAt),
           @"sync_interrupted", @"queued", @"running" ], &error);
    sqlite3_close(database);
    if (!recovered) {
      self.databasePath = nil;
      [self reject:reject error:error];
      return;
    }
    resolve(nil);
  });
}

RCT_REMAP_METHOD(configureMockSource,
                 configureMockSourceWithProviderId:(NSString *)providerId
                 resolver:(RCTPromiseResolveBlock)resolve
                 rejecter:(RCTPromiseRejectBlock)reject) {
  dispatch_async(self.writerQueue, ^{
    [self configureSource:providerId mode:@"mock" credentialState:@"mock"
                  enabled:YES resolve:resolve reject:reject];
  });
}

RCT_REMAP_METHOD(configureByokSource,
                 configureByokSourceWithProviderId:(NSString *)providerId
                 resolver:(RCTPromiseResolveBlock)resolve
                 rejecter:(RCTPromiseRejectBlock)reject) {
  dispatch_async(self.writerQueue, ^{
    if (!RubanHasAccessKey()) {
      reject(@"credential_missing", @"Import a DeBank AccessKey first", nil);
      return;
    }
    [self configureSource:providerId mode:@"byok" credentialState:@"configured"
                  enabled:YES resolve:resolve reject:reject];
  });
}

RCT_REMAP_METHOD(importDeBankAccessKey,
                 importDeBankAccessKeyValue:(NSString *)accessKey
                 resolver:(RCTPromiseResolveBlock)resolve
                 rejecter:(RCTPromiseRejectBlock)reject) {
  dispatch_async(self.writerQueue, ^{
    NSError *error = nil;
    if (!RubanWriteAccessKey(accessKey, &error)) {
      [self reject:reject error:error];
      return;
    }
    resolve([self credentialState:YES]);
  });
}

RCT_REMAP_METHOD(clearDeBankAccessKey,
                 clearDeBankAccessKeyWithResolver:(RCTPromiseResolveBlock)resolve
                 rejecter:(RCTPromiseRejectBlock)reject) {
  dispatch_async(self.writerQueue, ^{
    NSError *error = nil;
    if (!RubanClearAccessKey(&error)) {
      [self reject:reject error:error];
      return;
    }
    sqlite3 *database = RubanOpenDatabase(self.databasePath, &error);
    if (!database) {
      [self reject:reject error:error];
      return;
    }
    BOOL written = RubanExecute(
        database,
        @"UPDATE portfolio_data_sources SET credential_state = ?, enabled = ?, updated_at = ? "
         "WHERE provider_id = ? AND mode = ?",
        @[ @"missing", @0, @(RubanNowMs()), RubanProviderId, @"byok" ], &error);
    sqlite3_close(database);
    if (!written) {
      [self reject:reject error:error];
      return;
    }
    resolve([self credentialState:NO]);
  });
}

RCT_REMAP_METHOD(getDeBankCredentialState,
                 getDeBankCredentialStateWithResolver:(RCTPromiseResolveBlock)resolve
                 rejecter:(RCTPromiseRejectBlock)reject) {
  resolve([self credentialState:RubanHasAccessKey()]);
}

RCT_REMAP_METHOD(syncPortfolio,
                 syncPortfolioWithProviderId:(NSString *)providerId
                 address:(NSString *)address
                 options:(NSDictionary *)options
                 resolver:(RCTPromiseResolveBlock)resolve
                 rejecter:(RCTPromiseRejectBlock)reject) {
  [self enqueueSync:providerId address:address options:options forcedMode:nil
             resolve:resolve reject:reject];
}

RCT_REMAP_METHOD(syncMockPortfolio,
                 syncMockPortfolioWithProviderId:(NSString *)providerId
                 address:(NSString *)address
                 resolver:(RCTPromiseResolveBlock)resolve
                 rejecter:(RCTPromiseRejectBlock)reject) {
  [self enqueueSync:providerId address:address
             options:@{ @"mode" : @"full", @"chains" : @[] }
          forcedMode:@"mock" resolve:resolve reject:reject];
}

RCT_REMAP_METHOD(cancelPortfolioSync,
                 cancelPortfolioSyncWithProviderId:(NSString *)providerId
                 address:(NSString *)address
                 resolver:(RCTPromiseResolveBlock)resolve
                 rejecter:(RCTPromiseRejectBlock)reject) {
  if (![providerId isEqualToString:RubanProviderId] ||
      ![address isKindOfClass:NSString.class]) {
    reject(@"invalid_sync_options", @"Invalid portfolio sync options", nil);
    return;
  }
  NSString *normalizedAddress = address.lowercaseString;
  NSString *key = [NSString stringWithFormat:@"%@:%@", providerId,
                                             normalizedAddress];
  RubanSyncRun *run;
  BOOL cancelled;
  @synchronized(self.inFlightSyncs) {
    run = self.inFlightSyncs[key];
    cancelled = run && [run cancelWithReason:@"sync_cancelled"];
  }
  NSMutableDictionary *result = [@{
    @"providerId" : providerId,
    @"address" : normalizedAddress,
    @"cancelled" : @(cancelled)
  } mutableCopy];
  if (run) result[@"runId"] = run.runId;
  resolve(result);
}

- (void)configureSource:(NSString *)providerId mode:(NSString *)mode
        credentialState:(NSString *)credentialState enabled:(BOOL)enabled
                 resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject {
  if (![providerId isEqualToString:RubanProviderId]) {
    reject(@"unsupported_provider", @"Unsupported portfolio provider", nil);
    return;
  }
  NSError *error = nil;
  sqlite3 *database = RubanOpenDatabase(self.databasePath, &error);
  if (!database) {
    [self reject:reject error:error];
    return;
  }
  NSNumber *updatedAt = @(RubanNowMs());
  BOOL written = RubanExecute(
      database,
      @"INSERT OR REPLACE INTO portfolio_data_sources "
       "(provider_id, mode, credential_state, enabled, updated_at) VALUES (?, ?, ?, ?, ?)",
      @[ providerId, mode, credentialState, @(enabled), updatedAt ], &error);
  sqlite3_close(database);
  if (!written) {
    [self reject:reject error:error];
    return;
  }
  resolve(@{
    @"providerId" : providerId,
    @"mode" : mode,
    @"credentialState" : credentialState,
    @"enabled" : @(enabled),
    @"updatedAt" : updatedAt
  });
}

- (NSDictionary *)credentialState:(BOOL)configured {
  return @{
    @"providerId" : RubanProviderId,
    @"credentialState" : configured ? @"configured" : @"missing"
  };
}

- (void)enqueueSync:(NSString *)providerId address:(NSString *)address
             options:(NSDictionary *)options forcedMode:(NSString *)forcedMode
             resolve:(RCTPromiseResolveBlock)resolve
              reject:(RCTPromiseRejectBlock)reject {
  if (![providerId isKindOfClass:NSString.class] ||
      ![address isKindOfClass:NSString.class]) {
    reject(@"invalid_sync_options", @"Invalid portfolio sync options", nil);
    return;
  }
  NSError *jsonError = nil;
  NSString *optionsJson = RubanJSONString(options ?: @{}, &jsonError);
  if (!optionsJson) {
    reject(@"invalid_sync_options", @"Invalid portfolio sync options", jsonError);
    return;
  }
  NSString *normalizedAddress = address.lowercaseString;
  NSString *key = [NSString stringWithFormat:@"%@:%@", providerId,
                                             normalizedAddress];
  NSString *fingerprint = [NSString stringWithFormat:@"%@:%@",
      forcedMode ?: @"current", optionsJson];
  RubanSyncRun *run;
  @synchronized(self.inFlightSyncs) {
    RubanSyncRun *current = self.inFlightSyncs[key];
    if (current && [current.fingerprint isEqualToString:fingerprint] &&
        [current addResolve:resolve reject:reject]) {
      return;
    }
    if (current) [current cancelWithReason:@"sync_superseded"];
    run = [[RubanSyncRun alloc]
        initWithKey:key providerId:providerId address:normalizedAddress
        optionsJson:optionsJson forcedMode:forcedMode fingerprint:fingerprint
        runId:NSUUID.UUID.UUIDString queuedAt:RubanNowMs()
        totalChains:[self requestedChainCount:options] resolve:resolve reject:reject];
    self.inFlightSyncs[key] = run;
  }
  [self emitProvider:providerId address:normalizedAddress runId:run.runId
               state:@"queued" stage:@"waiting" completedChains:0
         totalChains:run.totalChains updatedAt:run.queuedAt errorCode:nil];
  dispatch_async(self.writerQueue, ^{
    [self runSync:run];
    @synchronized(self.inFlightSyncs) {
      if (self.inFlightSyncs[key] == run) [self.inFlightSyncs removeObjectForKey:key];
    }
  });
}

- (void)runSync:(RubanSyncRun *)run {
  long long startedAt = RubanNowMs();
  NSError *error = nil;
  if (![run.providerId isEqualToString:RubanProviderId]) {
    error = RubanDataEngineError(@"unsupported_provider", @"Unsupported provider");
  } else {
    @synchronized(self.inFlightSyncs) {
      if (self.inFlightSyncs[run.key] != run) {
        error = RubanDataEngineError(@"sync_superseded", @"Portfolio sync was superseded");
      } else if (run.cancellation.cancelled) {
        error = RubanDataEngineError(run.cancellation.reason,
                                     @"Portfolio sync was cancelled");
      } else if (![self writeSyncStateProvider:run.providerId address:run.address
                                         runId:run.runId state:@"queued" stage:@"waiting"
                               completedChains:0 totalChains:run.totalChains
                                     startedAt:run.queuedAt completedAt:0
                                     updatedAt:run.queuedAt errorCode:nil error:&error] ||
                 ![self writeSyncStateProvider:run.providerId address:run.address
                                         runId:run.runId state:@"running" stage:@"provider"
                               completedChains:0 totalChains:run.totalChains
                                     startedAt:startedAt completedAt:0
                                     updatedAt:startedAt errorCode:nil error:&error]) {
      }
    }
  }
  if (error) {
    [self failRun:run startedAt:startedAt errorCode:[self safeErrorCode:error]
             error:error];
    return;
  }
  [self emitProvider:run.providerId address:run.address runId:run.runId
               state:@"running" stage:@"provider" completedChains:0
         totalChains:run.totalChains updatedAt:startedAt errorCode:nil];

  NSString *mode = run.forcedMode ?: [self sourceMode:run.providerId error:&error];
  NSDictionary *result = nil;
  if (!error) {
    try {
      std::string resultJson;
      if ([mode isEqualToString:@"mock"]) {
        resultJson = ruban::data::create_mock_debank_sync_result_json(
            run.address.UTF8String, startedAt, run.optionsJson.UTF8String);
      } else if ([mode isEqualToString:@"byok"]) {
        if (!RubanHasAccessKey()) {
          error = RubanDataEngineError(@"credential_missing", @"AccessKey is missing");
        } else {
          std::string planJson = ruban::data::build_debank_request_plan_json(
              run.address.UTF8String, run.optionsJson.UTF8String);
          NSArray *plan = RubanJSONObject(planJson, &error);
          NSArray *payloads = error ? nil : [self.httpClient executePlan:plan
              cancellation:run.cancellation error:&error];
          NSString *payloadsJson = error ? nil : RubanJSONString(payloads, &error);
          if (!error) {
            resultJson = ruban::data::create_debank_sync_result_json(
                run.address.UTF8String, startedAt, run.optionsJson.UTF8String,
                payloadsJson.UTF8String, "debank:cloud");
          }
        }
      } else {
        error = RubanDataEngineError(@"data_source_not_configured",
                                     @"Portfolio source is not configured");
      }
      if (!error && !resultJson.empty()) result = RubanJSONObject(resultJson, &error);
    } catch (const std::invalid_argument &exception) {
      NSString *code = [NSString stringWithUTF8String:exception.what()];
      error = RubanDataEngineError(code, @"Invalid portfolio provider data");
    } catch (const std::exception &exception) {
      NSString *code = [NSString stringWithUTF8String:exception.what()];
      error = RubanDataEngineError(code, @"Portfolio provider failed");
    }
  }
  if (![result isKindOfClass:NSDictionary.class]) {
    NSString *code = [self safeErrorCode:error];
    [self failRun:run startedAt:startedAt errorCode:code error:error];
    return;
  }

  NSString *normalizedAddress = result[@"address"];
  NSArray *chains = result[@"chains"];
  NSArray *replaceChainIds = result[@"replaceChainIds"];
  NSInteger completedChains = [result[@"replaceMode"] isEqualToString:@"full"]
                                   ? chains.count
                                   : replaceChainIds.count;
  long long completedAt = RubanNowMs();
  __block BOOL written = NO;
  @synchronized(self.inFlightSyncs) {
    if (self.inFlightSyncs[run.key] != run) {
      error = RubanDataEngineError(@"sync_superseded", @"Portfolio sync was superseded");
    } else if (run.cancellation.cancelled) {
      error = RubanDataEngineError(run.cancellation.reason,
                                   @"Portfolio sync was cancelled");
    } else {
      sqlite3 *database = RubanOpenDatabase(self.databasePath, &error);
      if (database) {
        written = RubanExecute(database, @"BEGIN IMMEDIATE", @[], &error) &&
                  [self rejectStaleProjection:database provider:run.providerId
                                      address:normalizedAddress
                                   observedAt:[result[@"observedAt"] longLongValue]
                                        error:&error] &&
                  [self replaceProjection:result database:database error:&error] &&
                  [self upsertSyncState:database provider:run.providerId
                                address:normalizedAddress runId:run.runId
                                  state:@"succeeded" stage:@"complete"
                        completedChains:completedChains totalChains:completedChains
                              startedAt:startedAt completedAt:completedAt
                             durationMs:completedAt - startedAt
                              updatedAt:completedAt errorCode:nil error:&error] &&
                  RubanExecute(database, @"COMMIT", @[], &error);
        if (!written) RubanExecute(database, @"ROLLBACK", @[], nil);
        sqlite3_close(database);
      }
      if (written) [run markTerminal];
    }
  }
  if (!written) {
    NSString *code = [self safeErrorCode:error];
    [self failRun:run startedAt:startedAt errorCode:code error:error];
    return;
  }
  [self emitProvider:run.providerId address:normalizedAddress runId:run.runId
               state:@"succeeded" stage:@"complete"
     completedChains:completedChains totalChains:completedChains
           updatedAt:completedAt errorCode:nil];
  [run resolveAll:@{
    @"providerId" : run.providerId,
    @"address" : normalizedAddress,
    @"runId" : run.runId,
    @"completedChains" : @(completedChains),
    @"totalChains" : @(completedChains),
    @"observedAt" : result[@"observedAt"],
    @"requestCount" : result[@"requestCount"],
    @"attemptCount" : result[@"attemptCount"]
  }];
}

- (BOOL)rejectStaleProjection:(sqlite3 *)database provider:(NSString *)providerId
                      address:(NSString *)address observedAt:(long long)observedAt
                        error:(NSError **)error {
  sqlite3_stmt *statement = nullptr;
  int status = sqlite3_prepare_v2(
      database,
      "SELECT observed_at FROM portfolio_account_snapshots WHERE provider_id = ? AND address = ? LIMIT 1",
      -1, &statement, nullptr);
  if (status != SQLITE_OK || statement == nullptr) {
    if (error) {
      *error = RubanDataEngineError(@"database_write_failed",
                                    @"Unable to inspect portfolio storage");
    }
    return NO;
  }
  if (!RubanBind(statement, @[ providerId, address ], error)) {
    sqlite3_finalize(statement);
    return NO;
  }
  status = sqlite3_step(statement);
  if (status == SQLITE_ROW && sqlite3_column_int64(statement, 0) > observedAt) {
    sqlite3_finalize(statement);
    if (error) {
      *error = RubanDataEngineError(@"sync_stale_response",
                                    @"Portfolio sync result is stale");
    }
    return NO;
  }
  sqlite3_finalize(statement);
  if (status != SQLITE_ROW && status != SQLITE_DONE) {
    if (error) {
      *error = RubanDataEngineError(@"database_write_failed",
                                    @"Unable to inspect portfolio storage");
    }
    return NO;
  }
  return YES;
}

- (BOOL)replaceProjection:(NSDictionary *)projection database:(sqlite3 *)database
                     error:(NSError **)error {
  NSString *providerId = projection[@"providerId"];
  NSString *address = projection[@"address"];
  NSNumber *observedAt = projection[@"observedAt"];
  NSArray *key = @[ providerId, address ];
  NSString *replaceMode = projection[@"replaceMode"];
  NSArray *replaceChainIds = projection[@"replaceChainIds"];
  if ([replaceMode isEqualToString:@"full"]) {
    if (!RubanExecute(database,
                      @"DELETE FROM portfolio_token_balances WHERE provider_id = ? AND address = ?",
                      key, error) ||
        !RubanExecute(database,
                      @"DELETE FROM portfolio_protocol_positions WHERE provider_id = ? AND address = ?",
                      key, error) ||
        !RubanExecute(database,
                      @"DELETE FROM portfolio_chain_snapshots WHERE provider_id = ? AND address = ?",
                      key, error)) return NO;
  } else if ([replaceMode isEqualToString:@"chains"] && replaceChainIds.count) {
    for (NSNumber *chainId in replaceChainIds) {
      NSArray *chainKey = @[ providerId, address, chainId ];
      if (!RubanExecute(database,
                        @"DELETE FROM portfolio_token_balances WHERE provider_id = ? AND address = ? AND chain_id = ?",
                        chainKey, error) ||
          !RubanExecute(database,
                        @"DELETE FROM portfolio_protocol_positions WHERE provider_id = ? AND address = ? AND chain_id = ?",
                        chainKey, error) ||
          !RubanExecute(database,
                        @"DELETE FROM portfolio_chain_snapshots WHERE provider_id = ? AND address = ? AND chain_id = ?",
                        chainKey, error)) return NO;
    }
  } else {
    if (error) {
      *error = RubanDataEngineError(@"provider_contract_invalid",
                                    @"Invalid replacement scope");
    }
    return NO;
  }
  if (!RubanExecute(database,
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
               chain[@"source"], observedAt ], error)) return NO;
  }
  for (NSDictionary *token in projection[@"tokens"]) {
    NSString *contractAddress = token[@"contractAddress"];
    NSString *logoUrl = [token[@"logoUrl"] isKindOfClass:NSString.class]
                            ? token[@"logoUrl"]
                            : nil;
    if (!RubanExecute(
            database,
            @"INSERT INTO portfolio_token_balances "
             "(provider_id, address, chain_id, asset_id, symbol, name, logo_url, contract_address, decimals, balance, display_balance, price_usd, value_usd, observed_at) "
             "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            @[ providerId, address, token[@"chainId"], token[@"assetId"],
               token[@"symbol"], token[@"name"], logoUrl ?: NSNull.null,
               contractAddress.length ? contractAddress : NSNull.null,
               token[@"decimals"], token[@"balance"], token[@"displayBalance"],
               token[@"priceUsd"], token[@"valueUsd"], observedAt ], error)) return NO;
  }
  for (NSDictionary *protocol in projection[@"protocols"]) {
    NSString *logoUrl = [protocol[@"logoUrl"] isKindOfClass:NSString.class]
                            ? protocol[@"logoUrl"]
                            : nil;
    if (!RubanExecute(
            database,
            @"INSERT INTO portfolio_protocol_positions "
             "(provider_id, address, chain_id, protocol_id, position_id, protocol_name, logo_url, category, asset_value_usd, debt_value_usd, net_value_usd, observed_at) "
             "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            @[ providerId, address, protocol[@"chainId"], protocol[@"protocolId"],
               protocol[@"positionId"], protocol[@"protocolName"],
               logoUrl ?: NSNull.null, protocol[@"category"], protocol[@"assetValueUsd"],
               protocol[@"debtValueUsd"], protocol[@"netValueUsd"], observedAt ], error)) return NO;
  }
  return YES;
}

- (NSString *)sourceMode:(NSString *)providerId error:(NSError **)error {
  sqlite3 *database = RubanOpenDatabase(self.databasePath, error);
  if (!database) return nil;
  sqlite3_stmt *statement = nullptr;
  int status = sqlite3_prepare_v2(
      database,
      "SELECT mode, credential_state, enabled FROM portfolio_data_sources WHERE provider_id = ? LIMIT 1",
      -1, &statement, nullptr);
  NSString *mode = nil;
  if (status == SQLITE_OK && statement &&
      sqlite3_bind_text(statement, 1, providerId.UTF8String, -1, SQLITE_TRANSIENT) == SQLITE_OK &&
      sqlite3_step(statement) == SQLITE_ROW) {
    BOOL enabled = sqlite3_column_int(statement, 2) == 1;
    NSString *credentialState = [NSString stringWithUTF8String:
        (const char *)sqlite3_column_text(statement, 1)];
    mode = [NSString stringWithUTF8String:(const char *)sqlite3_column_text(statement, 0)];
    if (!enabled) {
      mode = nil;
      if (error) *error = RubanDataEngineError(@"data_source_disabled", @"Data source is disabled");
    } else if ([mode isEqualToString:@"byok"] &&
               ![credentialState isEqualToString:@"configured"]) {
      mode = nil;
      if (error) *error = RubanDataEngineError(@"credential_missing", @"AccessKey is missing");
    }
  } else if (error) {
    *error = RubanDataEngineError(@"data_source_not_configured",
                                  @"Portfolio source is not configured");
  }
  if (statement) sqlite3_finalize(statement);
  sqlite3_close(database);
  return mode;
}

- (NSInteger)requestedChainCount:(NSDictionary *)options {
  return [options[@"mode"] isEqualToString:@"incremental"] &&
         [options[@"chains"] isKindOfClass:NSArray.class]
             ? [options[@"chains"] count]
             : 0;
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
         @(durationMs), @(updatedAt), errorCode ?: NSNull.null ], error);
}

- (void)failRun:(RubanSyncRun *)run startedAt:(long long)startedAt
      errorCode:(NSString *)errorCode error:(NSError *)error {
  long long failedAt = RubanNowMs();
  @synchronized(self.inFlightSyncs) {
    BOOL current = self.inFlightSyncs[run.key] == run;
    if (run.cancellation.cancelled) {
      errorCode = run.cancellation.reason;
    } else if (!current) {
      errorCode = @"sync_superseded";
    }
    [run markTerminal];
    BOOL cancelled = [errorCode isEqualToString:@"sync_cancelled"] ||
                     [errorCode isEqualToString:@"sync_superseded"];
    NSString *state = cancelled ? @"cancelled" : @"failed";
    if (current) {
      [self writeSyncStateProvider:run.providerId address:run.address runId:run.runId
                             state:state stage:@"complete" completedChains:0
                       totalChains:run.totalChains startedAt:startedAt
                       completedAt:failedAt updatedAt:failedAt
                         errorCode:errorCode error:nil];
    }
  }
  BOOL cancelled = [errorCode isEqualToString:@"sync_cancelled"] ||
                   [errorCode isEqualToString:@"sync_superseded"];
  NSString *state = cancelled ? @"cancelled" : @"failed";
  [self emitProvider:run.providerId address:run.address runId:run.runId state:state
               stage:@"complete" completedChains:0 totalChains:run.totalChains
           updatedAt:failedAt errorCode:errorCode];
  [run rejectAllWithCode:errorCode
                   error:error ?: RubanDataEngineError(errorCode,
                                                       @"Portfolio sync failed")];
}

- (void)emitProvider:(NSString *)providerId address:(NSString *)address
               runId:(NSString *)runId state:(NSString *)state stage:(NSString *)stage
     completedChains:(NSInteger)completedChains totalChains:(NSInteger)totalChains
           updatedAt:(long long)updatedAt errorCode:(NSString *)errorCode {
  NSMutableDictionary *payload = [@{
    @"providerId" : providerId ?: RubanProviderId,
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

- (NSString *)safeErrorCode:(NSError *)error {
  NSString *code = [error.userInfo[@"code"] isKindOfClass:NSString.class]
                       ? error.userInfo[@"code"]
                       : @"data_engine_failed";
  NSSet *allowed = [NSSet setWithArray:@[
    @"credential_clear_failed", @"credential_missing", @"credential_store_failed",
    @"credential_unavailable", @"data_engine_not_initialized",
    @"data_source_disabled", @"data_source_not_configured", @"database_open_failed",
    @"database_write_failed", @"invalid_access_key", @"invalid_database_path",
    @"invalid_evm_address", @"invalid_incremental_chains", @"invalid_sync_options",
    @"provider_budget_exceeded", @"provider_contract_invalid",
    @"provider_endpoint_rejected", @"provider_http_failed",
    @"provider_response_too_large", @"provider_transport_failed",
    @"sync_already_running", @"sync_cancelled", @"sync_stale_response",
    @"sync_superseded", @"unsupported_provider"
  ]];
  return [allowed containsObject:code] ? code : @"data_engine_failed";
}

- (void)reject:(RCTPromiseRejectBlock)reject error:(NSError *)error {
  NSString *code = [self safeErrorCode:error];
  reject(code, @"Portfolio data engine failed", error);
}

@end
