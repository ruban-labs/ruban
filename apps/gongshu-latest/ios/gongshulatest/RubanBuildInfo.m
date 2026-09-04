#import <React/RCTBridgeModule.h>

@interface RubanBuildInfo : NSObject <RCTBridgeModule>
@end

@implementation RubanBuildInfo

RCT_EXPORT_MODULE()

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

- (NSDictionary *)constantsToExport
{
  NSString *environment = [[NSBundle mainBundle] objectForInfoDictionaryKey:@"RubanAppEnvironment"];
  return @{ @"environment": environment ?: @"production" };
}

@end
