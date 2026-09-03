#ifndef RUBAN_WALLET_CORE_H
#define RUBAN_WALLET_CORE_H

#ifdef __cplusplus
extern "C" {
#endif

const char *ruban_wallet_invoke(const char *request_json);
void ruban_wallet_string_free(char *value);

#ifdef __cplusplus
}
#endif

#endif
