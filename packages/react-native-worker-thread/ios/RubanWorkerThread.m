#import "RubanWorkerThread.h"

@implementation RubanWorkerThread

RCT_EXPORT_MODULE(RubanWorkerThread)

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

- (NSArray<NSString *> *)supportedEvents
{
  return @[ @"rubanWorkerThreadEvent" ];
}

RCT_REMAP_METHOD(create,
                 create:(NSString *)request
                 resolve:(RCTPromiseResolveBlock)resolve
                 reject:(RCTPromiseRejectBlock)reject)
{
  reject(
      @"E_ENGINE_NOT_READY",
      @"The Hermes worker adapter is not linked in this foundation release. Main-thread fallback is disabled.",
      nil);
}

RCT_REMAP_METHOD(postMessage,
                 postMessage:(NSString *)workerId
                 message:(NSString *)message
                 resolve:(RCTPromiseResolveBlock)resolve
                 reject:(RCTPromiseRejectBlock)reject)
{
  reject(
      @"E_ENGINE_NOT_READY",
      @"The Hermes worker adapter is not linked in this foundation release.",
      nil);
}

RCT_REMAP_METHOD(terminate,
                 terminate:(NSString *)workerId
                 resolve:(RCTPromiseResolveBlock)resolve
                 reject:(RCTPromiseRejectBlock)reject)
{
  resolve(nil);
}

@end
