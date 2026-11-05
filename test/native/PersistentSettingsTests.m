#import <Foundation/Foundation.h>
#import "HandyPersistentSettings.h"
#include <stdio.h>
#include <stdlib.h>

static void require(BOOL condition, NSString *message) {
  if (!condition) { NSLog(@"Native settings test failed: %@", message); exit(1); }
}

int main(void) {
  @autoreleasepool {
    NSString *key = @"handy-actions/state/v1";
    NSString *directory = [NSTemporaryDirectory() stringByAppendingPathComponent:NSUUID.UUID.UUIDString];
    NSFileManager *files = NSFileManager.defaultManager;
    require([files createDirectoryAtPath:directory withIntermediateDirectories:YES attributes:nil error:nil], @"Create fixture directory");
    NSString *path = [directory stringByAppendingPathComponent:@"settings-value"];
    NSString *saved = @"{\"presets\":[{\"id\":\"saved-preset\"}],\"theme\":\"paper\"}";
    require([saved writeToFile:path atomically:YES encoding:NSUTF8StringEncoding error:nil], @"Store real fixture bytes");
    NSError *fileError = nil;
    require([HandyReadPersistentFile(path, &fileError) isEqual:saved] && !fileError, @"Read actual UTF-8 storage bytes");
    require(HandyReadPersistentFile([directory stringByAppendingPathComponent:@"absent"], &fileError) == nil && !fileError, @"Only a genuine missing file returns nil without error");
    require(HandyReadPersistentFile(directory, &fileError) == nil && fileError != nil, @"A failed read of an existing path is not missing data");
    NSString *utf16Path = [directory stringByAppendingPathComponent:@"wrong-encoding"];
    require([saved writeToFile:utf16Path atomically:YES encoding:NSUTF16StringEncoding error:nil], @"Create wrong-encoding fixture");
    require(HandyReadPersistentFile(utf16Path, &fileError) == nil && fileError != nil, @"Unexpected encoding is a read error, not empty settings");
    HandyLegacyFileReader disk = ^NSString *(NSString *filePath, NSString *fileKey, NSDictionary **errorOut) {
      NSError *error = nil;
      NSString *value = HandyReadPersistentFile(filePath, &error);
      if (error && errorOut) *errorOut = @{@"message": @"Fixture read failed"};
      return value;
    };
    NSMutableDictionary *manifest = [@{key:NSNull.null, @"handy-actions/notes/v1":@"retained notes"} mutableCopy];
    NSCache *cache = [NSCache new];
    NSDictionary *error = nil;
    HandyLegacyFileReader locked = ^NSString *(NSString *filePath, NSString *fileKey, NSDictionary **errorOut) {
      if (errorOut) *errorOut = @{@"message":@"Protected file unavailable"};
      return nil;
    };
    require(HandyReadLegacyValue(key, manifest, cache, path, &error, locked) == nil && error != nil, @"Propagate read failure");
    require(manifest[key] == NSNull.null, @"Read error must preserve the manifest mapping");
    // An automatic note write can persist the manifest without any settings save.
    manifest[@"handy-actions/notes/v1"] = @"automatically imported note";
    NSData *encoded = [NSJSONSerialization dataWithJSONObject:manifest options:0 error:nil];
    NSMutableDictionary *restarted = [NSJSONSerialization JSONObjectWithData:encoded options:NSJSONReadingMutableContainers error:nil];
    error = nil;
    require([HandyReadLegacyValue(key, restarted, [NSCache new], path, &error, disk) isEqual:saved], @"Settings survive automatic unrelated writes and a fresh cache/restart");
    NSString *notesKey = @"handy-actions/notes/v1";
    NSMutableDictionary *notesManifest = [@{notesKey:NSNull.null} mutableCopy];
    error = nil;
    require(HandyReadLegacyValue(notesKey, notesManifest, [NSCache new], path, &error, locked) == nil && error != nil && notesManifest[notesKey] == NSNull.null, @"Read-error preservation also protects existing file-backed notes");
    error = nil;
    require([HandyReadLegacyValue(notesKey, notesManifest, [NSCache new], path, &error, disk) isEqual:saved], @"Existing non-settings files still load normally");

    // Reproduce an index that an earlier app has already saved without settings.
    NSMutableDictionary *orphan = [@{@"handy-actions/notes/v1":@"retained notes"} mutableCopy];
    require([HandyReadLegacyValue(key, orphan, [NSCache new], path, &error, disk) isEqual:saved], @"Recover original settings bytes when its index entry is absent");
    require(orphan[key] == NSNull.null && [orphan[@"handy-actions/notes/v1"] isEqual:@"retained notes"], @"Repair only the settings mapping and preserve notes");
    NSString *recoveryKey = @"handy-actions/state-recovery/v1";
    require([HandyReadLegacyValue(recoveryKey, orphan, [NSCache new], path, &error, disk) isEqual:saved], @"Recovery journal files are also recoverable");

    __block int reads = 0;
    HandyLegacyFileReader counted = ^NSString *(NSString *filePath, NSString *fileKey, NSDictionary **errorOut) { reads++; return saved; };
    for (NSString *unrelated in @[@"handy-actions/completed-note/receipt", @"handy-actions/pending-note/send", @"some-deleted-key"]) {
      require(HandyReadLegacyValue(unrelated, orphan, cache, path, &error, counted) == nil, @"Never resurrect delivery receipts, pending sends, or unrelated removed keys");
    }
    require(reads == 0, @"Only known settings keys may probe orphan files");
    orphan[key] = @"{\"presets\":[],\"theme\":\"paper\"}";
    require([HandyReadLegacyValue(key, orphan, cache, path, &error, counted) isEqual:orphan[key]] && reads == 0, @"An intentional inline empty state wins over an old file");
    [orphan removeObjectForKey:key];
    [cache setObject:@"stale cache" forKey:key];
    require([HandyReadLegacyValue(key, orphan, cache, path, &error, disk) isEqual:saved], @"Orphan recovery requires actual disk data, not stale cache");
    [cache removeAllObjects];
    require([files removeItemAtPath:path error:nil], @"Remove fixture file");
    require(HandyReadLegacyValue(key, orphan, cache, path, &error, disk) == nil && orphan[key] == nil, @"Confirmed missing files do not fabricate settings");
    [files removeItemAtPath:directory error:nil];
    puts("Native settings storage passed: protected-read failure, unrelated automatic write, restart, scoped orphan recovery, intentional empty state, and cache handling.");
  }
  return 0;
}
