import Foundation
import Security

func fail(_ message: String, code: Int32 = 1) -> Never {
    FileHandle.standardError.write(Data("keychain-secret: \(message)\n".utf8))
    exit(code)
}

guard CommandLine.arguments.count == 4 else {
    fail("expected set|get <account> <service>", code: 2)
}

let action = CommandLine.arguments[1]
let account = CommandLine.arguments[2]
let service = CommandLine.arguments[3]
let baseQuery: [String: Any] = [
    kSecClass as String: kSecClassGenericPassword,
    kSecAttrAccount as String: account,
    kSecAttrService as String: service,
]

if action == "set" {
    let secret = FileHandle.standardInput.readDataToEndOfFile()
    guard !secret.isEmpty else { fail("refusing to store an empty secret") }
    SecItemDelete(baseQuery as CFDictionary)
    var item = baseQuery
    item[kSecValueData as String] = secret
    item[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
    let status = SecItemAdd(item as CFDictionary, nil)
    guard status == errSecSuccess else { fail("SecItemAdd failed with status \(status)") }
} else if action == "get" {
    var query = baseQuery
    query[kSecReturnData as String] = true
    query[kSecMatchLimit as String] = kSecMatchLimitOne
    var result: CFTypeRef?
    let status = SecItemCopyMatching(query as CFDictionary, &result)
    guard status == errSecSuccess, let secret = result as? Data, !secret.isEmpty else {
        fail("SecItemCopyMatching failed with status \(status)")
    }
    FileHandle.standardOutput.write(secret)
} else {
    fail("expected set or get", code: 2)
}
